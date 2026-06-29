import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import React from 'react';
import FleetAnalytics from '../FleetAnalytics';

// Mock auth store
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    token: 'mock-access-token',
  }),
}));

describe('FleetAnalytics Component (Unit)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/fleet/kpis')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            fleetSize: 2,
            fleetUptimePercent24h: 98.5,
            totalBlockageMinutesToday: 12,
            criticalChuteCount: 0,
            worstPerformer: null,
            chutes: [
              {
                chuteId: 'chute_123',
                chuteName: 'Chute Alpha',
                status: 'Normal',
                materialType: 'generic',
                uptimePercent24h: 99.1,
                blockageMinutesToday: 4,
                blockageProbability: 5,
                overallTrend: 'stable',
                lastBlastScore: 95,
                consecutiveFailedBlasts: 0,
                openAlerts: 0,
                airLitresToday: 120,
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }));
  });

  it('renders the Fleet Analytics title and KPIs panels', async () => {
    render(<FleetAnalytics />);
    
    // Check main headers
    expect(await screen.findByText(/Fleet Analytics/i)).toBeDefined();
    expect(screen.getByText(/Fleet Average Uptime/i)).toBeDefined();
    expect(screen.getByText(/Total Blockages Today/i)).toBeDefined();
  });
});
