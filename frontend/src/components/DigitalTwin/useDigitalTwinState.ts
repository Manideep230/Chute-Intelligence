/**
 * useDigitalTwinState
 * -------------------
 * Manages all LOCAL interaction state for the ChuteDigitalTwin:
 *   - Dev-mode blockage creation flow
 *   - Solenoid selection & blast lifecycle
 *   - Demo mode state machine (10-step sequence)
 *
 * Does NOT touch MQTT, RBAC, or telemetry store APIs.
 */

import { useState, useRef, useCallback } from 'react';
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

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useDigitalTwinState() {

  // ── Blockage creation ──────────────────────────────────────────────────────
  const [devBlocking, setDevBlocking] = useState<DevBlockingState>({
    enabled: false,
    severity: 'medium',
    pendingPlacement: false,
  });

  const enableBlockingMode = useCallback((severity: BlockingSeverity) => {
    setDevBlocking({ enabled: true, severity, pendingPlacement: true });
  }, []);

  const disableBlockingMode = useCallback(() => {
    setDevBlocking(s => ({ ...s, enabled: false, pendingPlacement: false }));
  }, []);

  const setSeverity = useCallback((severity: BlockingSeverity) => {
    setDevBlocking(s => ({ ...s, severity }));
  }, []);

  // ── Solenoid selection ─────────────────────────────────────────────────────
  const [solenoidSelection, setSolenoidSelection] = useState<SolenoidSelection>({
    blasterNumber: null,
    solenoidPosition: null,
    blastRadius: 1.8,
    impactPoint: null,
  });

  const selectSolenoid = useCallback((
    blasterNumber: number,
    position: THREE.Vector3,
    radius: number,
    impactPoint: THREE.Vector3 | null,
  ) => {
    setSolenoidSelection({ blasterNumber, solenoidPosition: position, blastRadius: radius, impactPoint });
  }, []);

  const deselectSolenoid = useCallback(() => {
    setSolenoidSelection({
      blasterNumber: null,
      solenoidPosition: null,
      blastRadius: 1.8,
      impactPoint: null,
    });
  }, []);

  // ── Blast lifecycle ────────────────────────────────────────────────────────
  const [blast, setBlast] = useState<BlastState>({
    active: false,
    blasterNumber: null,
    solenoidPosition: null,
    lifecycle: 'idle',
    t: 0,
    startTime: 0,
    duration: 1500,
    hitBlockage: false,
    partialHit: false,
  });

  const blastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireBlast = useCallback((
    blasterNumber: number,
    solenoidPosition: THREE.Vector3,
    hitBlockage: boolean,
    partialHit: boolean,
    onComplete: () => void,
  ) => {
    const now = performance.now();
    setBlast({
      active: true,
      blasterNumber,
      solenoidPosition,
      lifecycle: 'valve_open',
      t: 0,
      startTime: now,
      duration: 1500,
      hitBlockage,
      partialHit,
    });

    // Sequence transitions
    const t1 = setTimeout(() => setBlast(b => ({ ...b, lifecycle: 'jet_active' })), 200);
    const t2 = setTimeout(() => setBlast(b => ({ ...b, lifecycle: 'pressure_wave' })), 900);
    const t3 = setTimeout(() => setBlast(b => ({ ...b, lifecycle: 'dissipating' })), 1300);
    const t4 = setTimeout(() => {
      setBlast(b => ({ ...b, active: false, lifecycle: 'idle', t: 0 }));
      onComplete();
    }, 1800);

    blastTimerRef.current = t4;
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const cancelBlast = useCallback(() => {
    if (blastTimerRef.current) clearTimeout(blastTimerRef.current);
    setBlast(b => ({ ...b, active: false, lifecycle: 'idle', t: 0 }));
  }, []);

  // ── Demo state machine ─────────────────────────────────────────────────────
  const [demo, setDemo] = useState<DemoState>({
    running: false,
    paused: false,
    step: 'idle',
    stepLabel: '',
    stepProgress: 0,
  });

  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoStepIdxRef = useRef(0);
  const onDemoCallbacks = useRef<{
    onBlockage?: () => void;
    onBlast?: () => void;
    onClear?: () => void;
    onComplete?: () => void;
  }>({});

  const advanceDemoStep = useCallback((idx: number) => {
    if (idx >= DEMO_STEPS.length) {
      setDemo({ running: false, paused: false, step: 'kpi_updated', stepLabel: DEMO_STEPS[DEMO_STEPS.length - 1].label, stepProgress: 1 });
      onDemoCallbacks.current.onComplete?.();
      return;
    }
    const cfg = DEMO_STEPS[idx];
    demoStepIdxRef.current = idx;
    setDemo(d => ({ ...d, step: cfg.step, stepLabel: cfg.label, stepProgress: 0 }));

    // Trigger side-effects for key steps
    if (cfg.step === 'creating_blockage') onDemoCallbacks.current.onBlockage?.();
    if (cfg.step === 'blast_animation')   onDemoCallbacks.current.onBlast?.();
    if (cfg.step === 'block_clears')      onDemoCallbacks.current.onClear?.();

    demoTimerRef.current = setTimeout(() => {
      advanceDemoStep(idx + 1);
    }, cfg.durationMs);
  }, []);

  const startDemo = useCallback((callbacks: {
    onBlockage?: () => void;
    onBlast?: () => void;
    onClear?: () => void;
    onComplete?: () => void;
  }) => {
    onDemoCallbacks.current = callbacks;
    setDemo({ running: true, paused: false, step: 'material_flowing', stepLabel: DEMO_STEPS[0].label, stepProgress: 0 });
    advanceDemoStep(0);
  }, [advanceDemoStep]);

  const stopDemo = useCallback(() => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    setDemo({ running: false, paused: false, step: 'idle', stepLabel: '', stepProgress: 0 });
  }, []);

  const pauseDemo = useCallback(() => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    setDemo(d => ({ ...d, paused: true }));
  }, []);

  const resumeDemo = useCallback(() => {
    setDemo(d => ({ ...d, paused: false }));
    advanceDemoStep(demoStepIdxRef.current);
  }, [advanceDemoStep]);

  return {
    // Blockage creation
    devBlocking,
    enableBlockingMode,
    disableBlockingMode,
    setSeverity,

    // Solenoid selection
    solenoidSelection,
    selectSolenoid,
    deselectSolenoid,

    // Blast
    blast,
    fireBlast,
    cancelBlast,

    // Demo
    demo,
    startDemo,
    stopDemo,
    pauseDemo,
    resumeDemo,

    // Constants for blast radius by severity
    BLAST_RADII: { small: 1.2, medium: 1.8, large: 2.5 } as Record<BlockingSeverity, number>,
    SEVERITY_SCALE: { small: 0.18, medium: 0.32, large: 0.50 } as Record<BlockingSeverity, number>,
  };
}
