import { useEffect, useState, useCallback } from 'react';
import type { DashboardTab } from '../types';

/**
 * Manages data fetching for secondary tabs: audit logs, maintenance tickets,
 * users, and assignments. Triggers fetches when the active tab changes.
 *
 * Extracted from Dashboard.tsx lines 577-776.
 */
export function useTabData(activeTab: DashboardTab, token: string | null) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [maintenanceTickets, setMaintenanceTickets] = useState<any[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState('');

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/_/backend/industry/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }, [token]);

  const loadMaintenanceTickets = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch('/_/backend/industry/maintenance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMaintenanceTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [token]);

  const loadAllUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const res = await fetch('/_/backend/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAllUsers(data);
        if (data.length > 0) {
          setAssignUserId(data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUserLoading(false);
    }
  }, [token]);

  const loadAssignments = useCallback(async () => {
    try {
      const res = await fetch('/_/backend/industry/assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAssignments(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Load tab data on tab activation
  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'maintenance') loadMaintenanceTickets();
    if (activeTab === 'users') {
      loadAllUsers();
      loadAssignments();
    }
    if (activeTab === 'registry') {
      loadAllUsers();
      loadAssignments();
    }
  }, [activeTab, loadAuditLogs, loadMaintenanceTickets, loadAllUsers, loadAssignments]);

  return {
    auditLogs,
    auditLoading,
    maintenanceTickets,
    maintenanceLoading,
    setMaintenanceTickets,
    allUsers,
    userLoading,
    assignments,
    assignUserId,
    setAssignUserId,
    loadAllUsers,
    loadAssignments,
    loadAuditLogs,
    loadMaintenanceTickets,
  } as const;
}
