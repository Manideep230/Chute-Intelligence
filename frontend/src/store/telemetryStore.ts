import { create } from 'zustand';

export interface RadarData {
  zone: number;
  distance: number;
  buildupDetected: boolean;
}

// ─── DEV-MODE BLOCKAGE (local only, never sent over MQTT) ─────────────────────
export interface DevBlockage {
  id: string;
  worldPosition: [number, number, number];
  normalizedT: number;    // 0..1 along slant path
  severity: 'small' | 'medium' | 'large';
  cleared: boolean;
  fragmenting: boolean;
}

// ─── DEMO KPIs ───────────────────────────────────────────────────────────────
export interface DemoKpis {
  blastSuccess: boolean;
  blockCleared: boolean;
  effectiveness: number; // 0–100
}

export interface AirBlasterData {
  _id?: string;
  blasterNumber: number;
  totalBlasts: number;
  lifespanBlasts: number;
  healthScore: number;
}

export interface SolenoidData {
  _id?: string;
  valveNumber: number;
  totalCycles: number;
  lifespanCycles: number;
  healthScore: number;
}

export interface CompressorData {
  pressure: number;
  runtimeHours: number;
  refillDuration: number;
  refillFrequency: number;
  motorTemperature: number;
  efficiency: number;
  healthScore: number;
}

export interface AiPredictionData {
  blockageProbability: number;
  compressorFailureProbability: number;
  solenoidWearProbability: number;
  airBlasterMaintenanceProbability: number;
  recommendedActions: string[];
}

// ─── LOCALIZATION EVENT ───────────────────────────────────────────────────────
// Emitted by the backend after every radar scan (production mode) or immediately
// after a simulation-mode change. This is the single source of truth for:
//   activePath, blockagePosition, blockageDistance, nearestSolenoidGroup, status.
export interface LocalizationData {
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  simulationMode: boolean;
  blockagePosition: string;
  blockageDistance: number;
  nearestSolenoidGroup: number;
  status: 'Normal' | 'Buildup' | 'Blocked' | 'Blasting';
}

// ─── SOLENOID GROUP HELPER ────────────────────────────────────────────────────
// Returns the 4-solenoid label array for a given group (1–4)
export function getSolenoidGroupLabels(group: number): string[] {
  return [`S${group}A`, `S${group}B`, `S${group}C`, `S${group}D`];
}

export interface TelemetryState {
  activeChuteId: string | null;
  chuteStatus: 'Normal' | 'Buildup' | 'Blocked' | 'Blasting';
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  simulationMode: boolean;
  blockagePosition: string;
  blockageDistance: number;
  nearestSolenoidGroup: number;
  radars: RadarData[];
  blasters: AirBlasterData[];
  solenoids: SolenoidData[];
  compressor: CompressorData | null;
  prediction: AiPredictionData | null;
  health: { isOnline: boolean; localLogsCount: number; lastPing?: string } | null;
  activeAlerts: any[];
  telemetryHistory: any[];
  isMqttConnected: boolean;
  gpsCoordinates: { lat: number; lng: number } | null;
  activeBlasterNumber: number | null;
  activeSolenoidValves: number[];
  liveTemperature: number;
  liveHumidity: number;
  unreadAlerts: number;
  commandsList: any[];

  // ── Dev/Demo-only state (never transmitted over MQTT) ────────────────────
  devBlockages: DevBlockage[];
  demoKpis: DemoKpis | null;

  setActiveChute: (chuteId: string | null) => void;
  setChuteData: (data: any) => void;
  setMqttConnected: (connected: boolean) => void;
  updateRadarData: (zone: number, distance: number, buildupDetected: boolean) => void;
  updateCompressorData: (data: Partial<CompressorData>) => void;
  updateAiPredictionData: (data: AiPredictionData) => void;
  updateStatus: (status: 'Normal' | 'Buildup' | 'Blocked' | 'Blasting') => void;
  addAlert: (alert: any) => void;
  setAlerts: (alerts: any[]) => void;
  setActiveBlasterNumber: (num: number | null) => void;
  setActiveSolenoidValves: (valves: number[]) => void;
  updateEnvironmental: (type: 'temperature' | 'humidity', value: number) => void;
  clearUnreadAlerts: () => void;
  updateLocation: (lat: number, lng: number) => void;

  // ── New actions ──────────────────────────────────────────────────────────
  applyLocalization: (data: LocalizationData) => void;
  setSimulationModeState: (enabled: boolean) => void;
  setActivePath: (path: 'LEFT_SLANT' | 'RIGHT_SLANT') => void;
  setBlockageInfo: (position: string, distance: number, solenoidGroup: number) => void;

  // ── Dev/Demo actions ─────────────────────────────────────────────────────
  addDevBlockage: (b: DevBlockage) => void;
  clearDevBlockages: () => void;
  updateDevBlockage: (id: string, changes: Partial<DevBlockage>) => void;
  setDemoKpis: (kpis: DemoKpis | null) => void;
  fetchCommandsList: (chuteId: string | null, token: string | null) => Promise<void>;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  activeChuteId: null,
  chuteStatus: 'Normal',
  activePath: 'LEFT_SLANT',
  simulationMode: false,
  blockagePosition: 'None',
  blockageDistance: 3.5,
  nearestSolenoidGroup: 1,
  radars: [
    { zone: 1, distance: 3.5, buildupDetected: false },
    { zone: 2, distance: 3.5, buildupDetected: false },
    { zone: 3, distance: 3.5, buildupDetected: false },
    { zone: 4, distance: 3.5, buildupDetected: false },
  ],
  blasters: [],
  solenoids: [],
  compressor: null,
  prediction: null,
  health: null,
  activeAlerts: [],
  telemetryHistory: [],
  isMqttConnected: false,
  gpsCoordinates: null,
  activeBlasterNumber: null,
  activeSolenoidValves: [],
  liveTemperature: 30,
  liveHumidity: 45,
  unreadAlerts: 0,
  devBlockages: [],
  demoKpis: null,
  commandsList: [],

  setActiveChute: (chuteId) => set({ activeChuteId: chuteId }),
  setActiveBlasterNumber: (num) => set({ activeBlasterNumber: num }),
  setActiveSolenoidValves: (valves) => set({ activeSolenoidValves: valves }),

  setChuteData: (data) => set({
    activeChuteId: data.chute._id,
    chuteStatus: data.chute.status,
    activePath: data.chute.activePath || 'LEFT_SLANT',
    simulationMode: data.chute.simulationMode ?? false,
    blockagePosition: data.chute.blockagePosition || 'None',
    blockageDistance: data.chute.blockageDistance ?? 3.5,
    nearestSolenoidGroup: data.chute.nearestSolenoidGroup ?? 1,
    radars: data.radars.length ? data.radars : [
      { zone: 1, distance: 3.5, buildupDetected: false },
      { zone: 2, distance: 3.5, buildupDetected: false },
      { zone: 3, distance: 3.5, buildupDetected: false },
      { zone: 4, distance: 3.5, buildupDetected: false },
    ],
    blasters: data.blasters,
    solenoids: data.solenoids,
    compressor: data.compressor,
    prediction: data.prediction,
    health: data.health,
    activeAlerts: data.alerts || [],
    telemetryHistory: data.telemetry || [],
    gpsCoordinates: data.chute.gpsCoordinates,
  }),

  setMqttConnected: (connected) => set({ isMqttConnected: connected }),

  updateRadarData: (zone, distance, buildupDetected) => set((state) => {
    const updatedRadars = state.radars.map((r) =>
      r.zone === zone ? { ...r, distance, buildupDetected } : r
    );

    // ── Status determination from radar data (only when NOT in simulation mode) ──
    // In simulation mode, status is set by applyLocalization() from backend events.
    let newStatus = state.chuteStatus;
    if (!state.simulationMode && state.chuteStatus !== 'Blasting') {
      const buildupCount = updatedRadars.filter((r) => r.buildupDetected).length;
      newStatus = buildupCount === 4 ? 'Blocked' : buildupCount > 0 ? 'Buildup' : 'Normal';
    }

    // Append to telemetry history (limit 25 entries)
    const activeDistances = [0, 0, 0, 0];
    updatedRadars.forEach((r) => { activeDistances[r.zone - 1] = r.distance; });
    const newHistItem = {
      radarValues: activeDistances,
      temperature: state.liveTemperature,
      humidity: state.liveHumidity,
      pressure: state.compressor ? state.compressor.pressure : 110,
      createdAt: new Date().toISOString()
    };

    return {
      radars: updatedRadars,
      chuteStatus: newStatus,
      telemetryHistory: [...state.telemetryHistory.slice(-24), newHistItem]
    };
  }),

  updateCompressorData: (compData) => set((state) => ({
    compressor: state.compressor ? { ...state.compressor, ...compData } : (compData as CompressorData)
  })),

  updateAiPredictionData: (predData) => set({ prediction: predData }),

  updateStatus: (status) => set({ chuteStatus: status }),

  addAlert: (alert) => set((state) => ({
    activeAlerts: [alert, ...state.activeAlerts.filter(a => a._id !== alert._id)],
    unreadAlerts: state.unreadAlerts + 1,
  })),

  setAlerts: (alerts) => set({ activeAlerts: alerts }),

  updateEnvironmental: (type, value) => set((state) => ({
    liveTemperature: type === 'temperature' ? value : state.liveTemperature,
    liveHumidity: type === 'humidity' ? value : state.liveHumidity,
  })),

  clearUnreadAlerts: () => set({ unreadAlerts: 0 }),
  updateLocation: (lat, lng) => set({ gpsCoordinates: { lat, lng } }),

  // ── LOCALIZATION EVENT HANDLER ────────────────────────────────────────────
  // Receives the computed output from the backend blockage localization engine.
  // This is the authoritative source for activePath, blockage, and status.
  // Called whenever the 'localization' MQTT topic is received.
  applyLocalization: (data: LocalizationData) => set((state) => {
    // Don't override Blasting status mid-blast
    const newStatus = state.chuteStatus === 'Blasting' ? 'Blasting' : data.status;
    return {
      activePath: data.activePath,
      simulationMode: data.simulationMode,
      blockagePosition: data.blockagePosition,
      blockageDistance: data.blockageDistance,
      nearestSolenoidGroup: data.nearestSolenoidGroup,
      chuteStatus: newStatus,
    };
  }),

  // ── SIMULATION MODE TOGGLE ────────────────────────────────────────────────
  setSimulationModeState: (enabled: boolean) => set((state) => ({
    simulationMode: enabled,
    // When turning off, reset blockage state to defaults
    ...(enabled ? {} : {
      blockagePosition: 'None',
      blockageDistance: 3.5,
      chuteStatus: state.chuteStatus === 'Blocked' || state.chuteStatus === 'Buildup'
        ? 'Normal'
        : state.chuteStatus,
    }),
  })),

  // ── ACTIVE PATH SETTER ────────────────────────────────────────────────────
  setActivePath: (path: 'LEFT_SLANT' | 'RIGHT_SLANT') => set({ activePath: path }),

  // ── MANUAL BLOCKAGE INFO ──────────────────────────────────────────────────
  setBlockageInfo: (position: string, distance: number, solenoidGroup: number) => set({
    blockagePosition: position,
    blockageDistance: distance,
    nearestSolenoidGroup: solenoidGroup,
    chuteStatus: distance < 0.65 ? 'Blocked' : distance < 1.0 ? 'Buildup' : 'Normal',
  }),

  // ── DEV BLOCKAGE ACTIONS ──────────────────────────────────────────────────
  addDevBlockage: (b: DevBlockage) => set((state) => ({
    devBlockages: [...state.devBlockages, b],
  })),
  clearDevBlockages: () => set({ devBlockages: [] }),
  updateDevBlockage: (id: string, changes: Partial<DevBlockage>) => set((state) => ({
    devBlockages: state.devBlockages.map((b) => b.id === id ? { ...b, ...changes } : b),
  })),

  // ── DEMO KPI ACTIONS ──────────────────────────────────────────────────────
  setDemoKpis: (kpis) => set({ demoKpis: kpis }),

  fetchCommandsList: async (chuteId, token) => {
    if (!chuteId || !token) return;
    try {
      const res = await fetch(`/_/backend/hardware/commands/${chuteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          set({ commandsList: data });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch commands list in store', err);
    }
  },
}));
