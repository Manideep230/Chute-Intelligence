import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import React from 'react';
import AICopilot from '../AICopilot';

// Mock auth store
vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    token: 'mock-access-token',
  }),
}));

describe('AICopilot Component (Unit)', () => {
  it('renders the AI Copilot floating trigger button', () => {
    render(<AICopilot activeChuteId="chute_123" />);
    
    // Check that floating action button renders
    const floatingBtn = screen.getByRole('button');
    expect(floatingBtn).toBeDefined();
  });
});
