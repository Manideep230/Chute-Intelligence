/**
 * useDigitalTwinState
 * -------------------
 * Manages SHARED interaction state for the ChuteDigitalTwin & TwinControlPanel:
 *   - Dev-mode blockage creation flow
 *   - Solenoid selection & blast lifecycle
 *   - Demo mode state machine (10-step sequence)
 */

import { create } from 'zustand';
import * as THREE from 'three';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type BlockingSeverity = 'small' | 'medium' | 'large';

export type BlastLifecycle =
  | 'idle'
  | 'valve_open'   // 0.0–0.15s  solenoid valve opens
  | 'jet_active'   // 0.15–0.9s  air cone + dust burst
  | 'pressure_wave'// 0.9–1.3s   shockwave ring expands
  | 'dissipating'; // 1.3–1.5s   fades out

export type DemoStep =
  | 'idle'
  | 'material_flowing'
  | 'creating_blockage'
  | 'flow_stops'
  | 'blockage_highlighted'
  | 'recommend_solenoid'
  | 'operator_approval'
  | 'blast_animation'
  | 'block_clears'
  | 'material_restored'
  | 'kpi_updated';

export interface BlastState {
  active: boolean;
  blasterNumber: number | null;   // which blaster (1–4)
  solenoidPosition: THREE.Vector3 | null;
  lifecycle: BlastLifecycle;
  t: number;                      // 0..1 normalized time
  startTime: number;              // performance.now() at start
  duration: number;               // ms
  hitBlockage: boolean;
  partialHit: boolean;
}

export interface SolenoidSelection {
  blasterNumber: number | null;
  solenoidPosition: THREE.Vector3 | null;
  blastRadius: number;            // world units
  impactPoint: THREE.Vector3 | null;
}

export interface DevBlockingState {
  enabled: boolean;
  severity: BlockingSeverity;
  pendingPlacement: boolean;      // cursor shows crosshair
}

export interface DemoState {
  running: boolean;
  paused: boolean;
  step: DemoStep;
  stepLabel: string;
  stepProgress: number;           // 0..1 within current step
}

export interface DigitalTwinStoreState {
  devBlocking: DevBlockingState;
  solenoidSelection: SolenoidSelection;
  blast: BlastState;
  demo: DemoState;

  enableBlockingMode: (severity: BlockingSeverity) => void;
  disableBlockingMode: () => void;
  setSeverity: (severity: BlockingSeverity) => void;

  selectSolenoid: (blasterNumber: number, position: THREE.Vector3, radius: number, impactPoint: THREE.Vector3 | null) => void;
  deselectSolenoid: () => void;

  fireBlast: (blasterNumber: number, solenoidPosition: THREE.Vector3, hitBlockage: boolean, partialHit: boolean, onComplete: () => void) => void;
  cancelBlast: () => void;

  startDemo: (callbacks: { onBlockage?: () => void; onBlast?: () => void; onClear?: () => void; onComplete?: () => void; }) => void;
  advanceDemoStep: (idx: number) => void;
  stopDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;

  BLAST_RADII: Record<BlockingSeverity, number>;
  SEVERITY_SCALE: Record<BlockingSeverity, number>;
}

// ─── DEMO STEP CONFIG ─────────────────────────────────────────────────────────

const DEMO_STEPS: Array<{ step: DemoStep; label: string; durationMs: number }> = [
  { step: 'material_flowing',    label: '① Material flowing normally through active path', durationMs: 2500 },
  { step: 'creating_blockage',   label: '② Creating blockage on active slant…',            durationMs: 1800 },
  { step: 'flow_stops',          label: '③ Material flow blocked — buildup detected',       durationMs: 2000 },
  { step: 'blockage_highlighted',label: '④ Radar localizes blockage — position confirmed',  durationMs: 2200 },
  { step: 'recommend_solenoid',  label: '⑤ AI recommends nearest solenoid group',          durationMs: 2500 },
  { step: 'operator_approval',   label: '⑥ Awaiting operator blast confirmation…',          durationMs: 2000 },
  { step: 'blast_animation',     label: '⑦ BLAST FIRED — compressed air jet active',       durationMs: 2000 },
  { step: 'block_clears',        label: '⑧ Blockage fragmenting — path clearing',          durationMs: 2000 },
  { step: 'material_restored',   label: '⑨ Material flow resumed — chute clear',           durationMs: 2000 },
  { step: 'kpi_updated',         label: '⑩ KPIs updated — Blast Success | Block Cleared',  durationMs: 3000 },
];

let blastTimers: ReturnType<typeof setTimeout>[] = [];
let demoTimer: ReturnType<typeof setTimeout> | null = null;
let demoStepIdx = 0;
let demoCallbacks: {
  onBlockage?: () => void;
  onBlast?: () => void;
  onClear?: () => void;
  onComplete?: () => void;
} = {};

// ─── ZUSTAND STORE ────────────────────────────────────────────────────────────

export const useDigitalTwinState = create<DigitalTwinStoreState>((set, get) => ({
  devBlocking: {
    enabled: false,
    severity: 'medium',
    pendingPlacement: false,
  },
  solenoidSelection: {
    blasterNumber: null,
    solenoidPosition: null,
    blastRadius: 1.8,
    impactPoint: null,
  },
  blast: {
    active: false,
    blasterNumber: null,
    solenoidPosition: null,
    lifecycle: 'idle',
    t: 0,
    startTime: 0,
    duration: 1500,
    hitBlockage: false,
    partialHit: false,
  },
  demo: {
    running: false,
    paused: false,
    step: 'idle',
    stepLabel: '',
    stepProgress: 0,
  },

  enableBlockingMode: (severity) => set({ devBlocking: { enabled: true, severity, pendingPlacement: true } }),
  disableBlockingMode: () => set(s => ({ devBlocking: { ...s.devBlocking, enabled: false, pendingPlacement: false } })),
  setSeverity: (severity) => set(s => ({ devBlocking: { ...s.devBlocking, severity } })),

  selectSolenoid: (blasterNumber, position, radius, impactPoint) => set({
    solenoidSelection: { blasterNumber, solenoidPosition: position, blastRadius: radius, impactPoint }
  }),
  deselectSolenoid: () => set({
    solenoidSelection: { blasterNumber: null, solenoidPosition: null, blastRadius: 1.8, impactPoint: null }
  }),

  fireBlast: (blasterNumber, solenoidPosition, hitBlockage, partialHit, onComplete) => {
    blastTimers.forEach(clearTimeout);
    blastTimers = [];
    const now = performance.now();
    set({
      blast: {
        active: true,
        blasterNumber,
        solenoidPosition,
        lifecycle: 'valve_open',
        t: 0,
        startTime: now,
        duration: 1500,
        hitBlockage,
        partialHit,
      }
    });

    const t1 = setTimeout(() => set(s => ({ blast: { ...s.blast, lifecycle: 'jet_active' } })), 200);
    const t2 = setTimeout(() => set(s => ({ blast: { ...s.blast, lifecycle: 'pressure_wave' } })), 900);
    const t3 = setTimeout(() => set(s => ({ blast: { ...s.blast, lifecycle: 'dissipating' } })), 1300);
    const t4 = setTimeout(() => {
      set(s => ({ blast: { ...s.blast, active: false, lifecycle: 'idle', t: 0 } }));
      if (onComplete) onComplete();
    }, 1800);

    blastTimers = [t1, t2, t3, t4];
  },

  cancelBlast: () => {
    blastTimers.forEach(clearTimeout);
    blastTimers = [];
    set(s => ({ blast: { ...s.blast, active: false, lifecycle: 'idle', t: 0 } }));
  },

  startDemo: (callbacks) => {
    demoCallbacks = callbacks;
    set({ demo: { running: true, paused: false, step: 'material_flowing', stepLabel: DEMO_STEPS[0].label, stepProgress: 0 } });
    get().advanceDemoStep(0);
  },

  advanceDemoStep: (idx) => {
    if (idx >= DEMO_STEPS.length) {
      set({ demo: { running: false, paused: false, step: 'kpi_updated', stepLabel: DEMO_STEPS[DEMO_STEPS.length - 1].label, stepProgress: 1 } });
      demoCallbacks.onComplete?.();
      return;
    }
    const cfg = DEMO_STEPS[idx];
    demoStepIdx = idx;
    set(s => ({ demo: { ...s.demo, step: cfg.step, stepLabel: cfg.label, stepProgress: 0 } }));

    if (cfg.step === 'creating_blockage') demoCallbacks.onBlockage?.();
    if (cfg.step === 'blast_animation')   demoCallbacks.onBlast?.();
    if (cfg.step === 'block_clears')      demoCallbacks.onClear?.();

    demoTimer = setTimeout(() => {
      get().advanceDemoStep(idx + 1);
    }, cfg.durationMs);
  },

  stopDemo: () => {
    if (demoTimer) clearTimeout(demoTimer);
    set({ demo: { running: false, paused: false, step: 'idle', stepLabel: '', stepProgress: 0 } });
  },

  pauseDemo: () => {
    if (demoTimer) clearTimeout(demoTimer);
    set(s => ({ demo: { ...s.demo, paused: true } }));
  },

  resumeDemo: () => {
    set(s => ({ demo: { ...s.demo, paused: false } }));
    get().advanceDemoStep(demoStepIdx);
  },

  BLAST_RADII: { small: 1.2, medium: 1.8, large: 2.5 },
  SEVERITY_SCALE: { small: 0.18, medium: 0.32, large: 0.50 },
}));
