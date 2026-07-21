// Shared types for dashboard components

export type DashboardTab =
  | 'dashboard'
  | 'maintenance'
  | 'audit'
  | 'profile'
  | 'users'
  | 'registry'
  | 'incidents'
  | 'fleet-analytics'
  | 'fleet-ops'
  | 'devices'
  | 'command-center'
  | 'alarm-mgmt'
  | 'mqtt-monitor'
  | 'enterprise-reports';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface TimelineEvent {
  id: string;
  type: 'alert' | 'maintenance' | 'calibration';
  label: string;
  severity: string;
  timestamp: string;
  date: Date;
  color: string;
}

import type React from 'react';
