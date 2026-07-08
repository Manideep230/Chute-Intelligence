import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTelemetryStore } from '../store/telemetryStore';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { CircularProgress } from '@mui/material';
import {
  Activity, Wrench, FileText, Settings, Users, Inbox, AlertTriangle, BarChart3
} from 'lucide-react';

import IncidentCenter from './IncidentCenter';

// Extracted modules
import { getThemeColors } from './dashboard/constants';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { useMqttConnection } from './dashboard/hooks/useMqttConnection';
import { useTabData } from './dashboard/hooks/useTabData';
import { useSimulatedTelemetry } from './dashboard/hooks/useSimulatedTelemetry';
import { Sidebar } from './dashboard/components/Sidebar';
import { HeaderBar } from './dashboard/components/HeaderBar';
import { MobileNav } from './dashboard/components/MobileNav';

// Extracted tabs & operations components
import { MaintenanceTab } from './dashboard/components/MaintenanceTab';
import { AuditTab } from './dashboard/components/AuditTab';
import { UsersTab } from './dashboard/components/UsersTab';
import { ProfileTab } from './dashboard/components/ProfileTab';
import { RegistryTab } from './dashboard/components/RegistryTab';
import { OperationsGrid } from './dashboard/components/operations/OperationsGrid';
import { DrillDownDrawer } from './dashboard/components/operations/DrillDownDrawer';

// Extracted modals
import { ReportModal } from './dashboard/components/modals/ReportModal';
import { CalibrationWizard } from './dashboard/components/modals/CalibrationWizard';
import { BlockageModal } from './dashboard/components/modals/BlockageModal';

import type { DashboardTab } from './dashboard/types';

// Lazy load FleetAnalytics for bundle separation
const FleetAnalytics = React.lazy(() => import('./FleetAnalytics'));

export const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuthStore();
  const roleAccess = useRoleAccess();

  // 1. Telemetry / Operations Store values
  const {
    activeChuteId,
    chuteStatus,
    activeAlerts,
    unreadAlerts,
    setActiveChute,
    clearUnreadAlerts,
    applyLocalization,
    radars,
    solenoids,
    compressor,
    liveTemperature,
    liveHumidity,
    fetchCommandsList,
  } = useTelemetryStore();

  // 2. Extracted Data Fetching, MQTT, Tab state, and Telemetry Hooks
  const {
    chutes,
    setChutes,
    plantsList,
    setPlantsList,
    chuteKpis,
    loading,
    refreshChuteDetail,
  } = useDashboardData(token);

  useMqttConnection(activeChuteId);

  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const {
    auditLogs,
    auditLoading,
    maintenanceTickets,
    maintenanceLoading,
    allUsers,
    assignments,
    loadAllUsers,
    loadAssignments,
    loadMaintenanceTickets,
  } = useTabData(activeTab, token);

  const { throughput, wearIndex, energy, throughputHistory } = useSimulatedTelemetry(activeChuteId, chuteStatus);

  // 3. UI Toggles, Themes, and Expand states
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [twinRotationX, setTwinRotationX] = useState(0);

  // Modals visibility state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [calibModalOpen, setCalibModalOpen] = useState(false);
  const [blockageModalOpen, setBlockageModalOpen] = useState(false);

  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;
  const BLUE = colors.BLUE;

  const avgBlasterHealth = solenoids?.length
    ? solenoids.reduce((acc, s) => acc + s.healthScore, 0) / solenoids.length
    : 95;
  const compHealth = compressor?.healthScore ?? 94;

  const blastEffScore = useMemo(() => (
    chuteKpis?.lastBlastEffectivenessScore >= 0
      ? chuteKpis.lastBlastEffectivenessScore : 100
  ), [chuteKpis]);

  const chuteHealthScore = useMemo(() => {
    const openAutoTickets = chuteKpis?.openAutoTickets ?? 0;
    const maintenanceRisk = Math.min(100, openAutoTickets * 20);
    return Math.round(
      0.35 * (chuteKpis?.uptimePercent24h ?? 100) +
      0.25 * blastEffScore +
      0.25 * compHealth +
      0.15 * (100 - maintenanceRisk)
    );
  }, [chuteKpis, blastEffScore, compHealth]);



  const alertColor: Record<string, string> = {
    Low: GREEN, Medium: AMBER, High: '#FBBF24', Critical: RED
  };

  const timelineEvents = useMemo(() => [
    ...activeAlerts.map(a => ({
      id: a._id || Math.random().toString(),
      type: 'alert',
      label: a.message,
      severity: a.severity,
      timestamp: new Date(a.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(a.createdAt || Date.now()),
      color: alertColor[a.severity] || RED
    })),
    ...maintenanceTickets.slice(0, 3).map(t => ({
      id: t._id,
      type: 'maintenance',
      label: `WO ${t.assetType}: ${t.status}`,
      severity: t.status === 'Resolved' ? 'Low' : 'High',
      timestamp: new Date(t.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(t.createdAt || Date.now()),
      color: t.status === 'Resolved' ? GREEN : AMBER
    })),
    {
      id: 'cal-1',
      type: 'calibration',
      label: 'Zone 2 Radar Calibrated',
      severity: 'Low',
      timestamp: '08:45 AM',
      date: new Date(Date.now() - 4 * 3600 * 1000),
      color: BLUE
    },
    {
      id: 'cal-2',
      type: 'calibration',
      label: 'SV3 Pressure Test Completed',
      severity: 'Low',
      timestamp: '07:12 AM',
      date: new Date(Date.now() - 6 * 3600 * 1000),
      color: GREEN
    }
  ].sort((a, b) => b.date.getTime() - a.date.getTime()), [activeAlerts, maintenanceTickets, GREEN, AMBER, RED, BLUE]);

  // Sync theme changes with document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Pull to refresh simulation
  const triggerPullToRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshChuteDetail();
    fetchCommandsList(activeChuteId, token);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  }, [refreshChuteDetail, fetchCommandsList, activeChuteId, token]);

  // Global command polling at 30 seconds interval as fallback
  useEffect(() => {
    if (!activeChuteId || !token) return;
    
    // Initial load
    fetchCommandsList(activeChuteId, token);
    
    const timer = setInterval(() => {
      fetchCommandsList(activeChuteId, token);
    }, 30000);

    return () => clearInterval(timer);
  }, [activeChuteId, token, fetchCommandsList]);

  const handleThemeToggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        refreshChuteDetail();
      }
    } catch (err) {
      console.error(err);
    }
  };




  // Navigation Items
  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Operations', icon: <Activity size={16} /> },
    ...(roleAccess.isManager ? [{ id: 'maintenance', label: 'Maintenance', icon: <Wrench size={16} /> }] : []),
    ...(roleAccess.canManageIncidents ? [{ id: 'incidents', label: 'Incidents', icon: <AlertTriangle size={16} /> }] : []),
    ...(roleAccess.canViewAuditLogs ? [{ id: 'audit', label: 'Audit Logs', icon: <FileText size={16} /> }] : []),
    ...(roleAccess.canViewUserManagement ? [{ id: 'users', label: 'Users', icon: <Users size={16} /> }] : []),
    ...(roleAccess.isAdmin ? [{ id: 'registry', label: 'Fleet Management', icon: <Inbox size={16} /> }] : []),
    ...(roleAccess.canViewFleetAnalytics ? [{ id: 'fleet-analytics', label: 'Fleet Analytics', icon: <BarChart3 size={16} /> }] : []),
    { id: 'profile', label: 'Profile', icon: <Settings size={16} /> },
  ], [roleAccess]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0A0F1A' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-shimmer" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
          <span style={{ color: '#6A7F9F', fontSize: '13px', fontFamily: 'var(--font-sans)', letterSpacing: '0.5px' }}>Syncing with telemetry...</span>
        </div>
      </div>
    );
  }

  const handleBlockageInject = (zone: number, distance: number) => {
    const path: 'LEFT_SLANT' | 'RIGHT_SLANT' = (zone === 1 || zone === 4) ? 'LEFT_SLANT' : 'RIGHT_SLANT';
    fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        enabled: true,
        activePath: path,
        blockagePosition: `Zone ${zone}`,
        blockageDistance: distance,
        nearestSolenoidGroup: zone,
        injectRadarZone: zone,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const chute = data.chute;
        if (chute) {
          applyLocalization({
            activePath: chute.activePath || path,
            simulationMode: true,
            blockagePosition: chute.blockagePosition || `Zone ${zone}`,
            blockageDistance: chute.blockageDistance ?? distance,
            nearestSolenoidGroup: chute.nearestSolenoidGroup ?? zone,
            status: chute.status || 'Normal',
          });
        }
        setBlockageModalOpen(false);
      })
      .catch((err) => alert(`Blockage injection failed: ${err.message}`));
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Background Ambient Orbs */}
      <div className="ambient-container">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
      </div>

      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 5 }}>
        {/* Desktop Sidebar */}
        <Sidebar
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMqttConnected={true} // MQTT live state
          user={user}
          logout={logout}
          theme={theme}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          {/* Header Bar */}
          <HeaderBar
            chutes={chutes}
            activeChuteId={activeChuteId}
            setActiveChute={setActiveChute}
            chuteStatus={chuteStatus}
            chuteKpis={chuteKpis}
            chuteHealthScore={chuteHealthScore}
            unreadAlerts={unreadAlerts}
            clearUnreadAlerts={clearUnreadAlerts}
            setExpandedTile={setExpandedTile}
            theme={theme}
            handleThemeToggle={handleThemeToggle}
          />

          {/* TAB ROUTING */}
          {activeTab === 'dashboard' && (
            <OperationsGrid
              chutes={chutes}
              theme={theme}
              roleAccess={roleAccess}
              setExpandedTile={setExpandedTile}
              expandedTile={expandedTile}
              twinRotationX={twinRotationX}
              setTwinRotationX={setTwinRotationX}
              triggerPullToRefresh={triggerPullToRefresh}
              isRefreshing={isRefreshing}
              setReportModalOpen={setReportModalOpen}
              setCalibModalOpen={setCalibModalOpen}
              setBlockageModalOpen={setBlockageModalOpen}
              chuteHealthScore={chuteHealthScore}
              blastEffScore={blastEffScore}
              timelineEvents={timelineEvents}
              throughput={throughput}
              throughputHistory={throughputHistory}
              wearIndex={wearIndex}
              avgBlasterHealth={avgBlasterHealth}
              energy={energy}
              chuteKpis={chuteKpis}
            />
          )}

          {activeTab === 'maintenance' && roleAccess.isManager && (
            <MaintenanceTab
              maintenanceTickets={maintenanceTickets}
              loading={maintenanceLoading}
              roleAccess={roleAccess}
              token={token}
              activeChuteId={activeChuteId}
              loadMaintenanceTickets={loadMaintenanceTickets}
              theme={theme}
            />
          )}

          {activeTab === 'audit' && roleAccess.canViewAuditLogs && (
            <AuditTab auditLogs={auditLogs} loading={auditLoading} theme={theme} />
          )}

          {activeTab === 'users' && roleAccess.canViewUserManagement && (
            <UsersTab
              allUsers={allUsers}
              userLoading={false}
              roleAccess={roleAccess}
              token={token}
              currentUser={user}
              loadAllUsers={loadAllUsers}
              loadAssignments={loadAssignments}
              theme={theme}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab theme={theme} />
          )}

          {activeTab === 'registry' && roleAccess.isAdmin && (
            <RegistryTab
              plantsList={plantsList}
              chutes={chutes}
              allUsers={allUsers}
              assignments={assignments}
              roleAccess={roleAccess}
              token={token}
              theme={theme}
              setChutes={setChutes}
              setPlantsList={setPlantsList}
              loadAssignments={loadAssignments}
            />
          )}

          {activeTab === 'incidents' && roleAccess.canManageIncidents && (
            <IncidentCenter activeChuteId={activeChuteId || undefined} />
          )}

          {activeTab === 'fleet-analytics' && roleAccess.canViewFleetAnalytics && (
            <React.Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <CircularProgress color="inherit" size={30} />
              </div>
            }>
              <FleetAnalytics />
            </React.Suspense>
          )}
        </div>
      </div>

      {/* Mobile navigation bar */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expandedTile={expandedTile}
        setExpandedTile={setExpandedTile}
        theme={theme}
      />


      {/* Detail drawer for drill-down metric inspections */}
      {expandedTile && (
        <DrillDownDrawer
          expandedTile={expandedTile}
          onClose={() => setExpandedTile(null)}
          activeChuteId={activeChuteId}
          theme={theme}
          twinRotationX={twinRotationX}
          radars={radars}
          chuteHealthScore={chuteHealthScore}
          chuteKpis={chuteKpis}
          avgBlasterHealth={avgBlasterHealth}
          blastEffScore={blastEffScore}
          compHealth={compHealth}
          solenoids={solenoids}
          liveTemperature={liveTemperature}
          liveHumidity={liveHumidity}
          timelineEvents={timelineEvents}
          roleAccess={roleAccess}
          handleResolveAlert={handleResolveAlert}
          wearIndex={wearIndex}
        />
      )}

      {/* Modals */}
      {reportModalOpen && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          activeChuteId={activeChuteId}
          token={token}
          theme={theme}
        />
      )}

      {calibModalOpen && (
        <CalibrationWizard
          open={calibModalOpen}
          onClose={() => setCalibModalOpen(false)}
          activeChuteId={activeChuteId}
          token={token}
          theme={theme}
        />
      )}

      {blockageModalOpen && (
        <BlockageModal
          open={blockageModalOpen}
          onClose={() => setBlockageModalOpen(false)}
          onInject={handleBlockageInject}
          theme={theme}
        />
      )}
    </div>
  );
};

export default Dashboard;
