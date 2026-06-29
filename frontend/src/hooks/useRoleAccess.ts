import { useAuthStore } from '../store/authStore';

export type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'Worker';

const ROLE_LEVELS: Record<UserRole, number> = {
  'Super Admin': 4,
  'Admin': 3,
  'Manager': 2,
  'Worker': 1,
};

export function useRoleAccess() {
  const { user } = useAuthStore();
  const role = (user?.role ?? 'Worker') as UserRole;
  const level = ROLE_LEVELS[role] ?? 1;

  return {
    role,
    level,
    isSuperAdmin: level >= 4,
    isAdmin: level >= 3,
    isManager: level >= 2,
    isWorker: level >= 1,

    // Feature gates
    canTriggerManualBlast: level >= 3,          // Admin and above
    canResolveAlerts: level >= 2,               // Manager and above
    canCreateMaintenanceTicket: level >= 2,     // Manager and above
    canResolveMaintenanceTicket: level >= 3,    // Admin and above
    canViewAuditLogs: level >= 3,               // Admin and above
    canViewUserManagement: level >= 3,          // Admin and above
    canChangeUserRoles: level >= 3,             // Admin and above
    canViewAiPredictions: level >= 2,           // Manager and above
    canViewFinancialData: level >= 3,           // Admin and above
    canExportReports: level >= 2,               // Manager and above
    canViewAllPlants: level >= 3,               // Admin and above
    canCreatePlant: level >= 4,                 // Super Admin only
    canEditPlant: level >= 4,                   // Super Admin only
    canDisablePlant: level >= 4,                // Super Admin only
    canCreateChute: level >= 3,                 // Admin and above
    canEditChute: level >= 3,                   // Admin and above
    canDisableChute: level >= 3,                // Admin and above
    canViewBlastHistory: level >= 2,            // Manager and above
    canOverrideCompressorProtection: level >= 4, // Super Admin only

    // User management
    canCreateAdmin: level >= 4,                 // Super Admin only
    canCreateManager: level >= 3,               // Admin and above
    canCreateWorker: level >= 2,                // Manager and above

    // New gates — Phase 1
    canManageIncidents: level >= 2,             // Manager and above
    canCloseIncident: level >= 3,               // Admin and above (requires root cause sign-off)
    canManageShifts: level >= 2,                // Manager and above
    canViewFleetAnalytics: level >= 4,          // Super Admin only (global fleet view)
    canViewPlantAnalytics: level >= 2,          // Manager and above
    canRunCalibration: level >= 2,              // Manager and above
    canViewCalibrationHistory: level >= 2,      // Manager and above
    canCreateSOP: level >= 3,                   // Admin and above
    canAcknowledgeSOP: level >= 1,              // All users
    canCreatePTW: level >= 2,                   // Manager and above
    canApprovePTW: level >= 3,                  // Admin and above
    canManageInventory: level >= 2,             // Manager and above
    canManageTraining: level >= 3,              // Admin and above
  };
}

