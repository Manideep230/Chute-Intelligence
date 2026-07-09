import { useAuthStore } from '../store/authStore';

export type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'Worker';

const ROLE_LEVELS: Record<string, number> = {
  'super admin': 8,
  'superadmin': 8,
  'super_admin': 8,
  'admin': 7,
  'plant manager': 6,
  'plantmanager': 6,
  'maintenance manager': 5,
  'maintenancemanager': 5,
  'supervisor': 4,
  'operator': 3,
  'technician': 2,
  'viewer': 1,
  // Backward compatibility mappings
  'manager': 6,
  'worker': 3,
};

export function useRoleAccess() {
  const { user } = useAuthStore();
  const rawRole = user?.role ?? 'Viewer';
  const roleKey = rawRole.toLowerCase().trim();
  const level = ROLE_LEVELS[roleKey] ?? ROLE_LEVELS[roleKey.replace(/[\s_-]+/g, '')] ?? 1;

  return {
    role: rawRole,
    level,
    isSuperAdmin: level >= 8,
    isAdmin: level >= 7,
    isManager: level >= 5,
    isWorker: level >= 2,
    isViewer: level >= 1,

    // Feature gates
    canTriggerManualBlast: level >= 3,          // Operator and above
    canResolveAlerts: level >= 2,               // Technician and above
    canCreateMaintenanceTicket: level >= 2,     // Technician and above
    canResolveMaintenanceTicket: level >= 5,    // Maintenance Manager and above
    canViewAuditLogs: level >= 7,               // Admin and above
    canViewUserManagement: level >= 7,          // Admin and above
    canChangeUserRoles: level >= 7,             // Admin and above
    canViewAiPredictions: level >= 2,           // Technician and above
    canViewFinancialData: level >= 6,           // Plant Manager and above
    canExportReports: level >= 2,               // Technician and above
    canViewAllPlants: level >= 7,               // Admin and above
    canCreatePlant: level >= 8,                 // Super Admin only
    canEditPlant: level >= 8,                   // Super Admin only
    canDisablePlant: level >= 8,                // Super Admin only
    canCreateChute: level >= 7,                 // Admin and above
    canEditChute: level >= 7,                   // Admin and above
    canDisableChute: level >= 7,                // Admin and above
    canViewBlastHistory: level >= 1,            // Viewer and above
    canOverrideCompressorProtection: level >= 8, // Super Admin only

    // User management
    canCreateAdmin: level >= 8,                 // Super Admin only
    canCreateManager: level >= 7,               // Admin and above
    canCreateWorker: level >= 6,                // Plant Manager and above

    // Shift & Operations gates
    canManageIncidents: level >= 4,             // Supervisor and above
    canCloseIncident: level >= 5,               // Maintenance Manager and above
    canManageShifts: level >= 4,                // Supervisor and above
    canViewFleetAnalytics: level >= 4,          // Supervisor and above
    canViewPlantAnalytics: level >= 4,          // Supervisor and above
    canRunCalibration: level >= 2,              // Technician and above
    canViewCalibrationHistory: level >= 1,      // Viewer and above
    canCreateSOP: level >= 7,                   // Admin and above
    canAcknowledgeSOP: level >= 1,              // All users
    canCreatePTW: level >= 4,                   // Supervisor and above
    canApprovePTW: level >= 6,                  // Plant Manager and above
    canManageInventory: level >= 5,             // Maintenance Manager and above
    canManageTraining: level >= 6,              // Plant Manager and above
  };
}

