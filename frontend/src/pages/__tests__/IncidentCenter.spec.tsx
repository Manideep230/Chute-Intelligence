import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import React from 'react';
import IncidentCenter from '../IncidentCenter';

// Mock auth store with a user who has management permissions
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    token: 'mock-access-token',
    user: { name: 'Test User', role: 'Super Admin', ngId: 'NG000001' },
  }),
}));

describe('IncidentCenter Component (Unit)', () => {
  it('renders the Incident Center headers and tabs', () => {
    render(<IncidentCenter activeChuteId="chute_123" />);
    
    // Check main title
    expect(screen.getByText(/Incident Center/i)).toBeDefined();
    
    // Check filters exist
    expect(screen.getByText(/All Severity/i)).toBeDefined();
    expect(screen.getByText(/Critical/i)).toBeDefined();
  });

  it('renders the action buttons for reporting incidents', () => {
    render(<IncidentCenter activeChuteId="chute_123" />);
    
    // Check create report button
    expect(screen.getByText(/Report Incident/i)).toBeDefined();
  });
});
