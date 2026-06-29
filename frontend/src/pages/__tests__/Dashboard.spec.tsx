import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import React from 'react';
import { Dashboard } from '../Dashboard';

// Mock the zustand stores
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { _id: '123', name: 'Test Industrial Operator', role: 'Worker', phone: '+919999999999', isActive: true },
    token: 'mock-access-token',
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock('../../store/telemetryStore', () => ({
  useTelemetryStore: () => ({
    activeChuteId: 'chute_123',
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
    activeSolenoidValves: [],
    compressor: { pressure: 110, motorTemperature: 30, runtimeHours: 120 },
    prediction: { blockageProbability: 5, overallTrend: 'stable', recommendedActions: ['Perform test inspection'] },
    isMqttConnected: true,
    activeAlerts: [],
    unreadAlerts: 0,
    liveTemperature: 32.5,
    liveHumidity: 45.0,
    setActiveChute: vi.fn(),
    setChuteData: vi.fn(),
    setMqttConnected: vi.fn(),
    updateRadarData: vi.fn(),
    updateCompressorData: vi.fn(),
    updateStatus: vi.fn(),
    addAlert: vi.fn(),
  }),
}));

vi.mock('../../hooks/useRoleAccess', () => ({
  useRoleAccess: () => ({
    canTriggerBlast: true,
    canCalibrate: true,
    canViewAuditLogs: true,
    canViewFleetAnalytics: true,
    canManageIncidents: true,
  }),
}));

vi.mock('../../hooks/useVoiceCommand', () => ({
  useVoiceCommand: () => ({
    isListening: false,
    startListening: vi.fn(),
  }),
  speakText: vi.fn(),
}));

// Mock heavy Three.js and Leaflet Map modules
vi.mock('../../components/DigitalTwin/ChuteDigitalTwin', () => ({
  ChuteDigitalTwin: () => <div data-testid="digital-twin">Mock Digital Twin Canvas</div>,
}));

vi.mock('../../components/Map/GlobalMap', () => ({
  GlobalMap: () => <div data-testid="global-map">Mock Leaflet Geofence Map</div>,
}));

vi.mock('../../components/TelemetryChart/TelemetryChart', () => ({
  TelemetryChart: () => <div data-testid="telemetry-chart">Mock Chart</div>,
}));

describe('Dashboard Component (Unit)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/plants')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ _id: 'plant_123', name: 'Test Facility' }]),
        });
      }
      if (url.includes('/chutes') && url.includes('/detail')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            _id: 'chute_123',
            name: 'Test Chute',
            plantId: 'plant_123',
            status: 'Normal',
            gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
          }),
        });
      }
      if (url.includes('/chutes') && url.includes('/kpis')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            openAutoTickets: 0,
            averageChuteThroughput: 900,
          }),
        });
      }
      if (url.includes('/chutes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{
            _id: 'chute_123',
            name: 'Test Chute',
            plantId: 'plant_123',
            status: 'Normal',
            gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
          }]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }));
  });

  it('renders the title and operator profile', async () => {
    render(<Dashboard />);
    
    // Check main headers
    expect(await screen.findByText(/NIGHA TECH/i)).toBeDefined();
    expect(screen.getByText(/Test Industrial Operator/i)).toBeDefined();
    expect(screen.getByText(/Worker/i)).toBeDefined();
  });

  it('displays active bento grid metrics', async () => {
    render(<Dashboard />);
    
    // Ensure data loaded by waiting for main header
    await screen.findByText(/NIGHA TECH/i);
    
    // Check live temperature and humidity metrics
    expect(screen.getByText(/32.5°C/i)).toBeDefined();
    expect(screen.getByText(/45%/i)).toBeDefined();
    expect(screen.getAllByText(/110 PSI/i)[0]).toBeDefined();
  });
});
