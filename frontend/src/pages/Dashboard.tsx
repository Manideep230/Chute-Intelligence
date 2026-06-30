import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import mqtt from 'mqtt';
import { useAuthStore } from '../store/authStore';
import { useTelemetryStore } from '../store/telemetryStore';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useVoiceCommand, speakText } from '../hooks/useVoiceCommand';
import { TelemetryChart } from '../components/TelemetryChart/TelemetryChart';
import IncidentCenter from './IncidentCenter';

const ChuteDigitalTwin = React.lazy(() => import('../components/DigitalTwin/ChuteDigitalTwin').then(module => ({ default: module.ChuteDigitalTwin })));
const GlobalMap = React.lazy(() => import('../components/Map/GlobalMap').then(module => ({ default: module.GlobalMap })));
const FleetAnalytics = React.lazy(() => import('./FleetAnalytics'));
import AICopilot from '../components/AICopilot/AICopilot';
const PredictivePanel = React.lazy(() => import('../components/PredictiveEngine/PredictivePanel'));
import {
  Alert, Button, TextField, Modal, Box, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Drawer,
  CircularProgress
} from '@mui/material';
import {
  Activity, Sun, Moon, Wrench, FileText,
  Settings, Home, Users, Bell, RefreshCw, Mic, Maximize2, ChevronRight,
  Thermometer, Droplets, Clock, Inbox, AlertTriangle, BarChart3
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, token, logout, updateUser } = useAuthStore();
  const roleAccess = useRoleAccess();
  const {
    activeChuteId, chuteStatus, radars, blasters, solenoids, compressor,
    prediction, isMqttConnected, activeAlerts, unreadAlerts,
    liveTemperature, liveHumidity,
    setActiveChute, setChuteData, setMqttConnected,
    updateRadarData, updateCompressorData, updateStatus, addAlert,
    setActiveBlasterNumber, setActiveSolenoidValves, updateEnvironmental, clearUnreadAlerts, updateLocation,
    activeSolenoidValves,
    activePath, simulationMode, blockagePosition, blockageDistance, nearestSolenoidGroup,
    applyLocalization
  } = useTelemetryStore();

  const [chutes, setChutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  // User Management state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState('Worker');
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // Chute Registry states
  const [plantsList, setPlantsList] = useState<any[]>([]);
  const [regName, setRegName] = useState('');
  const [regPlantId, setRegPlantId] = useState('');
  const [regLat, setRegLat] = useState('17.6258');
  const [regLng, setRegLng] = useState('83.1557');
  const [regMaterial, setRegMaterial] = useState('generic');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // Plant Registry states (Super Admin)
  const [plantRegName, setPlantRegName] = useState('');
  const [plantRegCode, setPlantRegCode] = useState('');
  const [plantRegIndustry, setPlantRegIndustry] = useState('Mining');
  const [plantRegOwner, setPlantRegOwner] = useState('');
  const [plantRegContact, setPlantRegContact] = useState('');
  const [plantRegEmail, setPlantRegEmail] = useState('');
  const [plantRegAddress, setPlantRegAddress] = useState('');
  const [plantRegDesc, setPlantRegDesc] = useState('');
  const [plantRegSuccess, setPlantRegSuccess] = useState<string | null>(null);
  const [plantRegError, setPlantRegError] = useState<string | null>(null);
  const [plantRegLoading, setPlantRegLoading] = useState(false);

  // Plant Edit Modal state
  const [editPlantModalOpen, setEditPlantModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<any>(null);
  const [editPlantFields, setEditPlantFields] = useState<any>({});
  const [editPlantLoading, setEditPlantLoading] = useState(false);
  const [editPlantError, setEditPlantError] = useState<string | null>(null);

  // Chute Edit Modal state
  const [editChuteModalOpen, setEditChuteModalOpen] = useState(false);
  const [editingChute, setEditingChute] = useState<any>(null);
  const [editChuteFields, setEditChuteFields] = useState<any>({});
  const [editChuteLoading, setEditChuteLoading] = useState(false);
  const [editChuteError, setEditChuteError] = useState<string | null>(null);

  // Registry sub-tab
  const [registrySubTab, setRegistrySubTab] = useState<'plants' | 'chutes' | 'assignments'>('plants');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignAssetType, setAssignAssetType] = useState<'Plant' | 'Chute'>('Chute');
  const [assignPlantId, setAssignPlantId] = useState('');
  const [assignChuteId, setAssignChuteId] = useState('');
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Simulated live telemetry metrics
  const [throughput, setThroughput] = useState(914.3);
  const [wearIndex, setWearIndex] = useState(82.4);
  const [energy, setEnergy] = useState(4820.65);

  // Sparkline history data tracking
  const [throughputHistory, setThroughputHistory] = useState<number[]>([910, 915, 908, 912, 919, 914, 916, 911, 915, 914.3]);
  const healthHistory = [94, 95, 95, 94, 93, 94, 95, 95, 96, 95];

  // Dashboard theme & tabs
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'maintenance' | 'audit' | 'profile' | 'users' | 'registry' | 'incidents' | 'fleet-analytics'>('dashboard');

  // Active theme transition ripple state
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);

  // Expanded tile drill-down modal/drawer state
  const [expandedTile, setExpandedTile] = useState<string | null>(null);

  // AR Live feed overlay state
  const isArActive = true;

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Calibration wizard state
  const [calibModalOpen, setCalibModalOpen] = useState(false);
  const [calibStep, setCalibStep] = useState(1);
  const [calibZone, setCalibZone] = useState(1);
  const [calibMode, setCalibMode] = useState<'Auto' | 'Manual'>('Auto');
  const [calibBaseline, setCalibBaseline] = useState(3.5);
  const [calibMeasured, setCalibMeasured] = useState(3.5);
  const [calibNotes, setCalibNotes] = useState('');
  const [calibResult, setCalibResult] = useState<any>(null);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [calibSafetyChecked1, setCalibSafetyChecked1] = useState(false);
  const [calibSafetyChecked2, setCalibSafetyChecked2] = useState(false);
  const [calibSafetyChecked3, setCalibSafetyChecked3] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Digital twin camera rotation
  const [twinRotationX, setTwinRotationX] = useState(0);

  // Simulated pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Audit Logs, Maintenance, Notifications
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<any[]>([]);
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState('AirBlaster');

  // Dual OTP Phone Number change modal state
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [oldPhoneOtp, setOldPhoneOtp] = useState('');
  const [newPhoneOtp, setNewPhoneOtp] = useState('');
  const [phoneChangeStep, setPhoneChangeStep] = useState<1 | 2>(1);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneInfo, setPhoneInfo] = useState<string | null>(null);

  // Chute Intelligence KPIs
  const [chuteKpis, setChuteKpis] = useState<any>(null);

  // Blockage Injection State
  const [blockageModalOpen, setBlockageModalOpen] = useState(false);
  const [injZone, setInjZone] = useState<number>(1);
  const [injDistance, setInjDistance] = useState<number>(0.55);
  const [injPosition, setInjPosition] = useState<string>('Zone 1');

  useEffect(() => {
    setInjPosition(`Zone ${injZone}`);
  }, [injZone]);

  // ── BLAST CONTROL PANEL STATE ─────────────────────────────────────────────
  const [blastSelectedGroup, setBlastSelectedGroup] = useState<number>(1);
  const [blastHolding, setBlastHolding] = useState(false);
  const [blastHoldProgress, setBlastHoldProgress] = useState(0);
  const [blastFiring, setBlastFiring] = useState(false);
  const [blastResult, setBlastResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const blastHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── QR ONBOARDING MODAL STATE ─────────────────────────────────────────────
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDeviceId, setQrDeviceId] = useState('');
  const [qrClaimResult, setQrClaimResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [qrClaimLoading, setQrClaimLoading] = useState(false);

    // ── DATABASE RESET STATE ──────────────────────────────────────────────────
  const [dbResetDialogOpen, setDbResetDialogOpen] = useState(false);
  const [dbResetPhrase, setDbResetPhrase] = useState('');
  const [dbResetLoading, setDbResetLoading] = useState(false);
  const [dbResetResult, setDbResetResult] = useState<{ ok: boolean; msg: string; details?: any } | null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (qrModalOpen && qrData && qrCanvasRef.current) {
      import('qrcode').then((QRCode) => {
        const payloadString = JSON.stringify(qrData.qrPayload || qrData);
        QRCode.toCanvas(qrCanvasRef.current!, payloadString, {
          width: 220,
          margin: 2,
          color: {
            dark: '#1e293b', // dark QR blocks
            light: '#ffffff' // white background
          }
        }, (error) => {
          if (error) console.error('Failed to generate QR canvas:', error);
        });
      }).catch(err => {
        console.error('Failed to load qrcode library:', err);
      });
    }
  }, [qrModalOpen, qrData]);

  // MQTT client ref for manual publishing
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  // Touch start positions tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Voice Command hook called at the top level to adhere to Rules of Hooks
  const voice = useVoiceCommand({
    lang: 'en-US',
    onCommand: (cmd, _raw) => {
      if (cmd === 'health') setExpandedTile('health');
      else if (cmd === 'maintenance') setActiveTab('maintenance');
      else if (cmd === 'timeline') { setExpandedTile('timeline'); clearUnreadAlerts(); }
      else if (cmd === 'report') setReportModalOpen(true);
      else if (cmd === 'switch-chute') {
        const idx = chutes.findIndex(c => c._id === activeChuteId);
        const next = chutes[(idx + 1) % chutes.length];
        if (next) setActiveChute(next._id);
      }
      else if (cmd === 'ai') setExpandedTile('ai');
      else if (cmd === 'profile') setActiveTab('profile');
      else if (cmd === 'theme-dark') setTheme('dark');
      else if (cmd === 'theme-light') setTheme('light');
      else if (cmd === 'logout') logout();
      else if (cmd === 'incidents') setActiveTab('incidents');
      else if (cmd === 'throughput') setExpandedTile('throughput');
      else if (cmd === 'environment') setExpandedTile('environment');
      else if (cmd === 'confirm-blast') {
        const valveNo = parseInt(_raw);
        if (!isNaN(valveNo) && roleAccess.canTriggerManualBlast) {
          handleManualValveBlast(valveNo);
        }
      }
    },
  });

  // Sync state data on theme change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── PERSISTENT SESSION (UNLIMITED) ──────────────────────────────────────
  // The system uses persistent JWT access tokens (20y expiry) with local storage
  // persistence. Inactivity timeouts and warning alerts are disabled.

  // ── REPORT DOWNLOAD ──────────────────────────────────────────────────────
  const handleDownloadReport = useCallback(async (fmt: 'pdf' | 'csv') => {
    if (!activeChuteId) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(
        `/_/backend/reports/${activeChuteId}?format=${fmt === 'pdf' ? 'json' : 'csv'}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Report generation failed');

      if (fmt === 'csv') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `nigha_report_${activeChuteId.slice(-6)}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const worker = new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({ data, activeChuteId });
        
        worker.onmessage = (e) => {
          if (e.data.success) {
            const blob = new Blob([e.data.pdfOutput], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nigha_report_${activeChuteId.slice(-6)}_${new Date().toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            setReportModalOpen(false);
          } else {
            setReportError(e.data.error || 'Failed to generate PDF report in worker');
          }
          setReportLoading(false);
          worker.terminate();
        };

        worker.onerror = (err) => {
          console.error('PDF Web Worker error:', err);
          setReportError('Web Worker failed to compile the PDF document');
          setReportLoading(false);
          worker.terminate();
        };
        return; // Don't fall through to setReportLoading(false) below since it's handled in onmessage
      }
      setReportModalOpen(false);
    } catch (err: any) {
      setReportError(err.message || 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  }, [activeChuteId, token]);

  // ── CALIBRATION SAVE ─────────────────────────────────────────────────────
  const handleSaveCalibration = useCallback(async () => {
    if (!activeChuteId) return;
    setCalibLoading(true); setCalibError(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          zone: calibZone,
          baselineDistance: calibBaseline,
          measuredDistance: calibMeasured,
          calibrationMode: calibMode,
          notes: calibNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Calibration failed');
      setCalibResult(data);
      setCalibStep(5); // go to results step
    } catch (err: any) {
      setCalibError(err.message);
    } finally {
      setCalibLoading(false);
    }
  }, [activeChuteId, token, calibZone, calibBaseline, calibMeasured, calibMode, calibNotes]);

  // Simulated telemetry updates
  useEffect(() => {
    const timer = setInterval(() => {
      setThroughput(t => {
        const delta = (Math.random() - 0.5) * 8;
        const next = t + delta;
        const bounded = next < 500 ? 500 : next > 1200 ? 1200 : next; // Expanded bounds to match dynamic baselines
        setThroughputHistory(prev => [...prev.slice(-9), bounded]);
        return bounded;
      });

      setEnergy(e => e + 0.02 + (chuteStatus === 'Blasting' ? 0.38 : 0));
      setWearIndex(w => Math.max(15, w - 0.0001));
    }, 2000);

    return () => clearInterval(timer);
  }, [chuteStatus]);

  // Update simulated metrics when activeChuteId changes to make them look distinct for each chute
  useEffect(() => {
    if (!activeChuteId) return;

    // A simple deterministic hash function of the chute ID string
    let hash = 0;
    for (let i = 0; i < activeChuteId.length; i++) {
      hash = activeChuteId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);

    // Generate distinct, realistic baselines
    const baselineThroughput = 700 + (absHash % 250); // e.g., 700 - 950 tons/hr
    const baselineWear = 60 + (absHash % 35); // e.g., 60% - 95% remaining life
    const baselineEnergy = 1000 + (absHash % 4000); // e.g., 1000 - 5000 kWh

    setThroughput(Number(baselineThroughput.toFixed(1)));
    setWearIndex(Number(baselineWear.toFixed(1)));
    setEnergy(Number(baselineEnergy.toFixed(2)));

    // Regenerate sparkline history
    const history: number[] = [];
    let currentVal = baselineThroughput;
    for (let i = 0; i < 10; i++) {
      currentVal += (Math.random() - 0.5) * 10;
      history.push(Number(currentVal.toFixed(1)));
    }
    setThroughputHistory(history);
  }, [activeChuteId]);

  // Fetch initial plants & chutes in parallel — they are independent requests
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [chutesRes, plantsRes] = await Promise.all([
          fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);

        const [data, plData] = await Promise.all([
          chutesRes.json(),
          plantsRes.json(),
        ]);

        if (!chutesRes.ok) throw new Error(data.message || 'Failed to fetch chutes');

        const plants = plantsRes.ok ? plData : [];
        setPlantsList(plants);
        if (plants.length > 0) {
          setRegPlantId(plants[0]._id);
          setAssignPlantId(plants[0]._id);
        }

        const mapped = data.map((c: any) => {
          const p = plants.find((pl: any) => pl._id === c.plantId);
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);

        if (mapped.length > 0) {
          setActiveChute(mapped[0]._id);
          setAssignChuteId(mapped[0]._id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [token, setActiveChute]);

  // Fetch specific chute detail telemetry
  useEffect(() => {
    if (!activeChuteId) return;

    const fetchChuteDetail = async () => {
      try {
        const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/detail`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setChuteData(data);
        }
      } catch (err) {
        console.error('Failed to load chute details:', err);
      }
    };

    fetchChuteDetail();
  }, [activeChuteId, token, setChuteData]);

  // Fetch Chute Intelligence KPIs
  useEffect(() => {
    if (!activeChuteId) return;
    const fetchKpis = async () => {
      try {
        const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/kpis`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const kpisData = await res.json();
          setChuteKpis(kpisData);
        }
      } catch { /* non-critical */ }
    };
    fetchKpis();
    const interval = setInterval(fetchKpis, 60_000);
    return () => clearInterval(interval);
  }, [activeChuteId, token]);

  // MQTT Connection over WebSockets
  useEffect(() => {
    if (!activeChuteId) return;

    const client = mqtt.connect('wss://g292ae11.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
      clientId: `dashboard_${Math.random().toString(16).substr(2, 8)}`,
      keepalive: 60,
      username: 'pf086f1d',
      password: 'PrE_6sIGv9Efa0zQ',
      protocol: 'wss',
      clean: true,
      reconnectPeriod: 5000,   // retry after 5 s instead of instantly
      connectTimeout: 15000,   // 15 s connection timeout
    });

    mqttClientRef.current = client;

    client.on('connect', () => {
      setMqttConnected(true);
      client.subscribe(`nigha/chute/${activeChuteId}/radar`);
      client.subscribe(`nigha/chute/${activeChuteId}/temperature`);
      client.subscribe(`nigha/chute/${activeChuteId}/humidity`);
      client.subscribe(`nigha/chute/${activeChuteId}/compressor`);
      client.subscribe(`nigha/chute/${activeChuteId}/alert`);
      client.subscribe(`nigha/chute/${activeChuteId}/health`);
      client.subscribe(`nigha/chute/${activeChuteId}/location`);
      client.subscribe(`nigha/chute/${activeChuteId}/blast`);
      client.subscribe(`nigha/chute/${activeChuteId}/localization`);
    });

    client.on('message', (topic, payload) => {
      const data = JSON.parse(payload.toString());
      const type = topic.split('/')[3];

      switch (type) {
        case 'radar':
          updateRadarData(data.zone, data.distance, data.buildupDetected);
          break;
        case 'temperature':
          updateEnvironmental('temperature', data.value);
          break;
        case 'humidity':
          updateEnvironmental('humidity', data.value);
          break;
        case 'compressor':
          updateCompressorData(data);
          break;
        case 'location':
          updateLocation(data.latitude, data.longitude);
          break;
        case 'alert':
          if (!data.isResolved) addAlert(data);
          break;
        case 'localization':
          // Route through applyLocalization which protects Blasting status
          useTelemetryStore.getState().applyLocalization({
            activePath: data.activePath,
            simulationMode: data.simulationMode ?? false,
            blockagePosition: data.blockagePosition,
            blockageDistance: data.blockageDistance,
            nearestSolenoidGroup: data.nearestSolenoidGroup,
            status: data.status,
          });
          break;
        case 'blast':
          if (data.success) {
            updateStatus('Blasting');
            setActiveBlasterNumber(data.blasterNumber);
            setActiveSolenoidValves(data.solenoidValves || []);

            setTimeout(() => {
              setActiveBlasterNumber(null);
              setActiveSolenoidValves([]);
            }, 2500);
          }
          break;
        default:
          break;
      }
    });

    client.on('close', () => setMqttConnected(false));
    // Suppress unhandled error events (e.g. TLS/WebSocket drops)
    client.on('error', (err) => console.warn('[MQTT]', err.message));

    return () => {
      mqttClientRef.current = null;
      client.end(true); // force=true prevents double-close WebSocket error
    };
  // Only reconnect when the active chute changes — store actions are stable Zustand refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChuteId]);

  // Load Audit Logs, Maintenance, Users
  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/_/backend/industry/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const loadMaintenanceTickets = useCallback(async () => {
    try {
      const res = await fetch('/_/backend/industry/maintenance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMaintenanceTickets(data);
    } catch (err) {
      console.error(err);
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

  const handleUpdateUserRole = async (targetId: string, newRole: string) => {
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        loadAllUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update role');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSuccess(null);
    setUserError(null);
    try {
      const res = await fetch('/_/backend/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newUserName,
          phone: newUserPhone,
          role: newUserRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      setUserSuccess(`User ${data.name} created successfully!`);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserRole('Worker');
      loadAllUsers();
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleToggleUserActive = async (targetId: string) => {
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}/toggle-active`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAllUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to toggle status');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (targetId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This will also remove all their assignments.')) return;
    try {
      const res = await fetch(`/_/backend/auth/users/${targetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAllUsers();
        loadAssignments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete user');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignSuccess(null);
    setAssignError(null);
    try {
      const body: any = { userId: assignUserId };
      if (assignAssetType === 'Plant') {
        body.plantId = assignPlantId;
      } else {
        body.chuteId = assignChuteId;
      }

      const res = await fetch('/_/backend/industry/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create assignment');

      setAssignSuccess('Assignment registered successfully!');
      loadAssignments();
    } catch (err: any) {
      setAssignError(err.message);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this assignment?')) return;
    try {
      const res = await fetch(`/_/backend/industry/assignments/${id}/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAssignments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to revoke assignment');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/_/backend/industry/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const detRes = await fetch(`/_/backend/industry/chutes/${activeChuteId}/detail`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const detData = await detRes.json();
        if (detRes.ok) setChuteData(detData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger manual valve blast
  const handleManualValveBlast = async (valveNumber: number) => {
    if (!activeChuteId) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/blast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ valveNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (simulationMode) {
        setActiveBlasterNumber(Math.ceil(valveNumber / 2));
        setActiveSolenoidValves([valveNumber]);
      }

      updateStatus('Blasting');
    } catch (err: any) {
      alert(`Manual blast failed: ${err.message}`);
    }
  };

  // ── BLAST CONTROL PANEL — Group-level blast with 2s hold-to-fire safety ──
  const handleBlastGroupFire = async () => {
    if (!activeChuteId || blastFiring) return;
    setBlastFiring(true);
    setBlastResult(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ blasterNumber: blastSelectedGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (simulationMode) {
        setActiveBlasterNumber(blastSelectedGroup);
        setActiveSolenoidValves([blastSelectedGroup * 2 - 1, blastSelectedGroup * 2]);
      }

      updateStatus('Blasting');
      setBlastResult({ ok: true, msg: data.message || `Blast Group ${blastSelectedGroup} fired successfully.` });
    } catch (err: any) {
      setBlastResult({ ok: false, msg: err.message || 'Blast failed' });
    } finally {
      setBlastFiring(false);
      setBlastHolding(false);
      setBlastHoldProgress(0);
    }
  };

  const startBlastHold = () => {
    if (!roleAccess.canTriggerManualBlast || blastFiring) return;
    setBlastHolding(true);
    setBlastHoldProgress(0);
    let elapsed = 0;
    blastHoldTimerRef.current = setInterval(() => {
      elapsed += 50;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setBlastHoldProgress(pct);
      if (elapsed >= 2000) {
        if (blastHoldTimerRef.current) clearInterval(blastHoldTimerRef.current);
        blastHoldTimerRef.current = null;
        handleBlastGroupFire();
      }
    }, 50);
  };

  const cancelBlastHold = () => {
    if (blastHoldTimerRef.current) {
      clearInterval(blastHoldTimerRef.current);
      blastHoldTimerRef.current = null;
    }
    setBlastHolding(false);
    setBlastHoldProgress(0);
  };

  // ── QR ONBOARDING ─────────────────────────────────────────────────────────
  const handleOpenQrModal = async () => {
    if (!activeChuteId) return;
    setQrModalOpen(true);
    setQrLoading(true);
    setQrClaimResult(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/qr-token`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load QR');
      setQrData(data);
    } catch (err: any) {
      setQrData(null);
      setQrClaimResult({ ok: false, msg: err.message || 'Failed to load QR token' });
    } finally {
      setQrLoading(false);
    }
  };

  const handleClaimDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChuteId || !qrDeviceId.trim()) return;
    setQrClaimLoading(true);
    setQrClaimResult(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/claim-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deviceId: qrDeviceId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Claim failed');
      setQrClaimResult({ ok: true, msg: data.message });
      setQrData((prev: any) => prev ? { ...prev, linkedDeviceId: qrDeviceId.trim(), deviceLinkedAt: new Date().toISOString() } : prev);
      setQrDeviceId('');
    } catch (err: any) {
      setQrClaimResult({ ok: false, msg: err.message || 'Failed to claim device' });
    } finally {
      setQrClaimLoading(false);
    }
  };

  // ── DATABASE RESET ────────────────────────────────────────────────────────
  const handleDbReset = async () => {
    if (dbResetPhrase !== 'RESET') return;
    setDbResetLoading(true);
    setDbResetResult(null);
    try {
      const res = await fetch('/_/backend/admin/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ confirm: true, confirmPhrase: 'RESET' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      setDbResetResult({ ok: true, msg: data.message, details: data });
      setDbResetPhrase('');
    } catch (err: any) {
      setDbResetResult({ ok: false, msg: err.message || 'Reset failed' });
    } finally {
      setDbResetLoading(false);
    }
  };

  // Toggle operational mode (Production vs Manual Simulation)
  // Uses the dedicated /simulation-mode endpoint which:
  //  1. Updates simulationMode on the Chute document
  //  2. Publishes a localization MQTT event immediately
  //  3. In production mode, clears all radar overrides
  const handleToggleSimulationMode = async (mode: boolean) => {
    if (!activeChuteId) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle mode');
      // Immediately apply localization state from the updated chute
      const chute = data.chute;
      if (chute) {
        applyLocalization({
          activePath: chute.activePath || 'LEFT_SLANT',
          simulationMode: chute.simulationMode ?? mode,
          blockagePosition: chute.blockagePosition || 'None',
          blockageDistance: chute.blockageDistance ?? 3.5,
          nearestSolenoidGroup: chute.nearestSolenoidGroup ?? 1,
          status: chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      alert(`Failed to toggle operational mode: ${err.message}`);
    }
  };

  // Inject manual blockage in Manual Simulation Mode
  // Uses the dedicated /simulation-mode endpoint which also fires override_radar MQTT
  // to the simulator so radar readings reflect the injected blockage.
  const handleManualBlockageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChuteId) return;
    try {
      // Zone → path mapping: Zones 1&4 = LEFT_SLANT (\), Zones 2&3 = RIGHT_SLANT (/)
      const path: 'LEFT_SLANT' | 'RIGHT_SLANT' = (injZone === 1 || injZone === 4) ? 'LEFT_SLANT' : 'RIGHT_SLANT';
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          activePath: path,
          blockagePosition: injPosition || `Zone ${injZone}`,
          blockageDistance: injDistance,
          nearestSolenoidGroup: injZone,
          injectRadarZone: injZone,  // triggers override_radar MQTT to simulator
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Blockage injection failed');
      // Immediately update store from returned chute data
      const chute = data.chute;
      if (chute) {
        applyLocalization({
          activePath: chute.activePath || path,
          simulationMode: true,
          blockagePosition: chute.blockagePosition || injPosition || `Zone ${injZone}`,
          blockageDistance: chute.blockageDistance ?? injDistance,
          nearestSolenoidGroup: chute.nearestSolenoidGroup ?? injZone,
          status: chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      alert(`Blockage injection failed: ${err.message}`);
    }
  };

  // Create Maintenance ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChuteId || !newTicketDesc) return;

    try {
      let assetId = activeChuteId;
      if (selectedAssetType === 'AirBlaster' && blasters.length > 0) {
        assetId = blasters[0]._id || activeChuteId;
      } else if (selectedAssetType === 'Compressor' && compressor) {
        assetId = (compressor as any)._id || activeChuteId;
      }

      const res = await fetch('/_/backend/industry/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chuteId: activeChuteId, assetType: selectedAssetType, assetId, description: newTicketDesc }),
      });

      if (res.ok) {
        setNewTicketDesc('');
        loadMaintenanceTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Maintenance ticket
  const handleResolveTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/_/backend/industry/maintenance/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Resolved' }),
      });
      if (res.ok) {
        loadMaintenanceTickets();
        const detRes = await fetch(`/_/backend/industry/chutes/${activeChuteId}/detail`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const detData = await detRes.json();
        if (detRes.ok) setChuteData(detData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Request Phone Change
  const handleRequestPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null); setPhoneInfo(null);
    try {
      const res = await fetch('/_/backend/auth/request-phone-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPhoneInfo('Verification codes sent to old and new numbers. Check terminal log!');
      setPhoneChangeStep(2);
    } catch (err: any) {
      setPhoneError(err.message);
    }
  };

  // Verify Phone Change
  const handleVerifyPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    try {
      const res = await fetch('/_/backend/auth/verify-phone-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPhoneOtp, newPhoneOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser({ phone: data.phone });
      setPhoneInfo('Phone number changed successfully!');
      setTimeout(() => {
        setPhoneModalOpen(false); setPhoneChangeStep(1);
        setNewPhone(''); setOldPhoneOtp(''); setNewPhoneOtp(''); setPhoneInfo(null);
      }, 2000);
    } catch (err: any) {
      setPhoneError(err.message);
    }
  };

  // Inject Blockage command
  const handleInjectBlockage = useCallback((zone: number, distance: number) => {
    if (mqttClientRef.current && activeChuteId) {
      const topic = `nigha/chute/${activeChuteId}/command`;
      mqttClientRef.current.publish(topic, JSON.stringify({ action: 'override_radar', zone, distance }));
      setBlockageModalOpen(false);
    } else {
      alert("MQTT client not connected or active chute not set.");
    }
  }, [activeChuteId]);

  // Register Chute
  const handleRegisterChute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess(null);
    setRegError(null);
    try {
      const body: any = { name: regName, plantId: regPlantId, materialType: regMaterial };
      if (regLat && regLng) {
        body.gpsCoordinates = { lat: parseFloat(regLat), lng: parseFloat(regLng) };
      }
      const res = await fetch('/_/backend/industry/chutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      setRegSuccess(`Chute registered! Code: ${data.chuteCode}`);
      setRegName('');
      const chutesRes = await fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } });
      const chutesData = await chutesRes.json();
      if (chutesRes.ok) {
        const mapped = chutesData.map((c: any) => {
          const p = plantsList.find((pl: any) => pl._id === c.plantId || pl._id === c.plantId?.toString());
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);
      }
    } catch (err: any) {
      setRegError(err.message);
    }
  };

  // Register Plant (Super Admin)
  const handleRegisterPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlantRegSuccess(null);
    setPlantRegError(null);
    setPlantRegLoading(true);
    try {
      const body: any = {
        name: plantRegName,
        industryType: plantRegIndustry,
        ownerName: plantRegOwner,
        contactNumber: plantRegContact,
        email: plantRegEmail,
        address: plantRegAddress,
        description: plantRegDesc,
      };
      if (plantRegCode) body.plantCode = plantRegCode.toUpperCase();
      const res = await fetch('/_/backend/industry/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Plant registration failed');
      setPlantRegSuccess(`Plant created! NG Prefix: ${data.ngPrefix} — IDs start at ${data.ngPrefix}000001`);
      setPlantRegName(''); setPlantRegCode(''); setPlantRegOwner('');
      setPlantRegContact(''); setPlantRegEmail(''); setPlantRegAddress(''); setPlantRegDesc('');
      // Refresh plants list
      const plRes = await fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } });
      const plData = await plRes.json();
      if (plRes.ok) setPlantsList(plData);
    } catch (err: any) {
      setPlantRegError(err.message);
    } finally {
      setPlantRegLoading(false);
    }
  };

  // Open Plant Edit Modal
  const handleOpenEditPlant = (plant: any) => {
    setEditingPlant(plant);
    setEditPlantFields({
      name: plant.name || '',
      industryType: plant.industryType || '',
      ownerName: plant.ownerName || '',
      contactNumber: plant.contactNumber || '',
      email: plant.email || '',
      address: plant.address || '',
      description: plant.description || '',
    });
    setEditPlantError(null);
    setEditPlantModalOpen(true);
  };

  // Save Plant Edit
  const handleSavePlantEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlant) return;
    setEditPlantLoading(true);
    setEditPlantError(null);
    try {
      const res = await fetch(`/_/backend/industry/plants/${editingPlant._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editPlantFields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setEditPlantModalOpen(false);
      const plRes = await fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } });
      const plData = await plRes.json();
      if (plRes.ok) setPlantsList(plData);
    } catch (err: any) {
      setEditPlantError(err.message);
    } finally {
      setEditPlantLoading(false);
    }
  };

  // Disable / Enable Plant
  const handleTogglePlantActive = async (plant: any) => {
    const action = plant.isActive ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} plant "${plant.name}"?`)) return;
    try {
      const res = await fetch(`/_/backend/industry/plants/${plant._id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      const plRes = await fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } });
      const plData = await plRes.json();
      if (plRes.ok) setPlantsList(plData);
    } catch (err: any) {
      alert(`Failed to ${action} plant: ${err.message}`);
    }
  };

  // Open Chute Edit Modal
  const handleOpenEditChute = (chute: any) => {
    setEditingChute(chute);
    setEditChuteFields({
      name: chute.name || '',
      materialType: chute.materialType || 'generic',
    });
    setEditChuteError(null);
    setEditChuteModalOpen(true);
  };

  // Save Chute Edit
  const handleSaveChuteEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChute) return;
    setEditChuteLoading(true);
    setEditChuteError(null);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${editingChute._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editChuteFields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setEditChuteModalOpen(false);
      const chutesRes = await fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } });
      const chutesData = await chutesRes.json();
      if (chutesRes.ok) {
        const mapped = chutesData.map((c: any) => {
          const p = plantsList.find((pl: any) => pl._id === c.plantId || pl._id === c.plantId?.toString());
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);
      }
    } catch (err: any) {
      setEditChuteError(err.message);
    } finally {
      setEditChuteLoading(false);
    }
  };

  // Disable / Enable Chute
  const handleToggleChuteActive = async (chute: any) => {
    const action = chute.isActive ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} chute "${chute.name}"?`)) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${chute._id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      const chutesRes = await fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } });
      const chutesData = await chutesRes.json();
      if (chutesRes.ok) {
        const mapped = chutesData.map((c: any) => {
          const p = plantsList.find((pl: any) => pl._id === c.plantId || pl._id === c.plantId?.toString());
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);
      }
    } catch (err: any) {
      alert(`Failed to ${action} chute: ${err.message}`);
    }
  };

  // Run NG ID Migration
  const handleMigrateNgIds = async () => {
    if (!confirm('This will generate NG IDs for all legacy users who do not have one. Proceed?')) return;
    try {
      const res = await fetch('/_/backend/auth/migrate-ng-ids', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert(`Migration complete. Migrated: ${data.migrated}, Skipped: ${data.skipped}`);
    } catch (err: any) {
      alert(`Migration failed: ${err.message}`);
    }
  };

  // Simulate pull-to-refresh gesture
  const triggerPullToRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setThroughput(914.3 + (Math.random() - 0.5) * 15);
      setIsRefreshing(false);
    }, 1200);
  };

  // Toggle Theme with ripple effect trigger
  const handleThemeToggle = () => {
    setIsThemeTransitioning(true);
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    setTimeout(() => setIsThemeTransitioning(false), 400);
  };

  // Navigation Items — memoized because it creates JSX icon elements on each render
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
          <span style={{ color: '#6A7F9F', fontSize: '13px', fontFamily: 'var(--font-sans)', letterSpacing: '0.5px' }}>Syncing with industrial telemetry...</span>
        </div>
      </div>
    );
  }

  // Derive Health score KPIs — intermediate values used in JSX below
  const avgBlasterHealth = blasters.length > 0
    ? blasters.reduce((s, b) => s + b.healthScore, 0) / blasters.length : 100;
  const openAutoTickets = chuteKpis?.openAutoTickets ?? 0;
  const maintenanceRisk = Math.min(100, openAutoTickets * 20);
  const blastEffScore = chuteKpis?.lastBlastEffectivenessScore >= 0
    ? chuteKpis.lastBlastEffectivenessScore : 100;
  const compHealth = compressor?.healthScore ?? 100;

  // Composite health score — memoized to avoid recomputing on unrelated re-renders
  const chuteHealthScore = useMemo(() => Math.round(
    0.35 * (chuteKpis?.uptimePercent24h ?? 100) +
    0.25 * blastEffScore +
    0.25 * compHealth +
    0.15 * (100 - maintenanceRisk)
  ), [chuteKpis, blastEffScore, compHealth, maintenanceRisk]);

  const isDark = theme === 'dark';
  const GREEN = isDark ? '#34D399' : '#059669';
  const AMBER = isDark ? '#FBBF24' : '#D97706';
  const RED = isDark ? '#F43F5E' : '#DC2626';
  const BLUE = isDark ? '#00D4FF' : '#0284C7';
  const PURPLE = isDark ? '#A78BFA' : '#7C3AED';
  const activeChute = chutes.find(c => c._id === activeChuteId);

  const healthColor = chuteHealthScore >= 80 ? GREEN : chuteHealthScore >= 50 ? AMBER : RED;
  const statusColor = chuteStatus === 'Normal' ? GREEN
    : chuteStatus === 'Buildup' ? AMBER
      : chuteStatus === 'Blasting' ? BLUE : RED;

  const statusBg = chuteStatus === 'Normal' ? 'rgba(52,211,153,0.1)'
    : chuteStatus === 'Buildup' ? 'rgba(251,191,36,0.1)'
      : chuteStatus === 'Blasting' ? 'rgba(0,212,255,0.1)' : 'rgba(244,63,94,0.1)';

  const alertColor: Record<string, string> = {
    Low: GREEN, Medium: AMBER, High: '#FBBF24', Critical: RED
  };

  // Timeline Events — memoized because it creates Date objects, maps, spreads, and sorts
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
  ].sort((a, b) => b.date.getTime() - a.date.getTime()), [activeAlerts, maintenanceTickets, alertColor, RED, GREEN, AMBER, BLUE]);

  // Radial Gauge renderer
  const renderRadialGauge = (score: number, color: string) => {
    const radius = 46;
    const strokeWidth = 8;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (score / 100) * circ;

    return (
      <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-light)" strokeWidth={strokeWidth} />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: color }}>{score}</span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '-2px', fontWeight: 600 }}>HEALTH</span>
        </div>
      </div>
    );
  };

  // Sparkline chart renderer
  const renderSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data) + 1;
    const min = Math.min(...data) - 1;
    const range = max - min || 1;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 60;
      const y = 20 - ((val - min) / range) * 16;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="60" height="24" viewBox="0 0 60 24">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        <circle cx="60" cy={20 - ((data[data.length - 1] - min) / range) * 16} r="2" fill={color} />
      </svg>
    );
  };

  // Compact Area Sparkline
  const renderAreaSparkline = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data) + 2;
    const min = Math.min(...data) - 2;
    const range = max - min || 1;

    const width = 100;
    const height = 30;

    const linePoints = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const fillPoints = `${linePoints} ${width},${height} 0,${height}`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#areaGrad)" points={fillPoints} />
        <polyline fill="none" stroke={color} strokeWidth="1.2" points={linePoints} />
      </svg>
    );
  };

  // Hero custom synapse dots background
  const renderSynapsesBg = () => (
    <svg className="synapses-bg" viewBox="0 0 400 400" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="40" cy="80" r="1.5" fill="var(--accent-primary)" opacity="0.3" />
      <circle cx="150" cy="180" r="2" fill="var(--accent-primary)" opacity="0.5" />
      <circle cx="280" cy="110" r="1.5" fill="var(--accent-primary)" opacity="0.4" />
      <circle cx="340" cy="240" r="2" fill="var(--accent-primary)" opacity="0.4" />
      <circle cx="100" cy="320" r="2" fill="var(--accent-primary)" opacity="0.3" />
      <path d="M40 80 L150 180 M150 180 L280 110 M280 110 L340 240 M150 180 L100 320 M100 320 L340 240" stroke="var(--accent-primary)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
    </svg>
  );

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Background Ambient Orbs */}
      <div className="ambient-container">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
      </div>

      <div style={{ display: 'flex', minHeight: '100vh' }} className={isThemeTransitioning ? 'theme-fade-transition' : ''}>

        {/* ─── LEFT SIDEBAR (desktop navigation) ─── */}
        <div className="glass-panel sidebar-container" style={{
          width: '240px',
          borderRight: `1px solid var(--border)`,
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 20
        }}>
          {/* Branded Logo */}
          <div style={{ padding: '0 20px 24px', borderBottom: `1px solid var(--border-light)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛰️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: BLUE, letterSpacing: '1px', lineHeight: 1 }}>
                  NIGHA TECH
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Chute Intelligence
                </div>
              </div>
            </div>
          </div>

          {/* Navigation links */}
          <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: activeTab === item.id ? 'var(--bg-hover)' : 'transparent',
                  color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === item.id ? 700 : 500,
                  fontSize: '12.5px',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                className={activeTab === item.id ? '' : 'glass-card'}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* System status connection & User profile footer */}
          <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: `1px solid var(--border-light)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isMqttConnected ? GREEN : RED,
                boxShadow: isMqttConnected ? `0 0 6px ${GREEN}` : 'none',
                animation: isMqttConnected ? 'blink-active 1.5s infinite alternate' : 'none'
              }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {isMqttConnected ? 'TELEMETRY LIVE' : 'DISCONNECTED'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>{user?.name || 'Operator'}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>
              {user?.role || 'Operator'}
            </div>
            <button
              onClick={logout}
              style={{
                marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ─── MAIN APP PAGE BODY ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Header */}
          <div className="glass-panel" style={{
            borderBottom: `1px solid var(--border)`,
            padding: '0 24px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 10
          }}>
            {/* Chute drop selector & Status indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <select
                value={activeChuteId || ''}
                onChange={(e) => setActiveChute(e.target.value)}
                style={{
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  border: `1px solid var(--border)`, padding: '6px 12px', borderRadius: '8px'
                }}
              >
                {chutes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>

              {/* Status capsule */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '20px',
                background: statusBg, border: `1px solid ${statusColor}30`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: 'blink-active 1s infinite alternate' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: statusColor, letterSpacing: '0.8px' }}>
                  {chuteStatus.toUpperCase()}
                </span>
              </div>

              {/* Top summary KPIs */}
              {chuteKpis && (
                <div className="mobile-hidden" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: healthColor }}>{chuteHealthScore}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>health</span>
                  </div>
                  <span style={{ color: 'var(--border)', fontSize: '14px' }}>·</span>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: GREEN }}>{chuteKpis.uptimePercent24h}%</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>uptime</span>
                  </div>
                  {chuteKpis.consecutiveFailedBlasts >= 2 && (
                    <div style={{
                      padding: '2px 8px', borderRadius: '4px', background: 'rgba(244,63,94,0.1)',
                      border: `1px solid ${RED}30`, fontSize: '10px', fontWeight: 800, color: RED
                    }}>
                      ⚠️ {chuteKpis.consecutiveFailedBlasts} Blast Failures
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Header controls: alerts and theme toggling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {unreadAlerts > 0 && (
                <button
                  onClick={() => { setExpandedTile('timeline'); clearUnreadAlerts(); }}
                  style={{
                    position: 'relative', padding: '6px 12px', borderRadius: '8px',
                    background: 'rgba(244,63,94,0.1)', border: `1px solid ${RED}30`,
                    color: RED, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  🔔 {unreadAlerts} alerts
                </button>
              )}

              {/* Voice Command Widget — Real Web Speech API */}
              <button
                onClick={() => {
                  if (!voice.isSupported) {
                    speakText('Voice commands not supported in this browser. Please use Chrome or Edge.');
                    return;
                  }
                  voice.toggleListening();
                }}
                className={`glass-card ${voice.isListening ? 'voice-mic-active' : ''}`}
                style={{
                  background: voice.isListening ? 'rgba(167, 139, 250, 0.15)' : 'var(--card-bg)',
                  borderColor: voice.isListening ? PURPLE : 'var(--border)',
                  color: voice.isListening ? PURPLE : 'var(--text-secondary)',
                  padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '8px', position: 'relative',
                }}
                title={voice.isListening ? '🎤 Listening… (say a command)' : voice.isSupported ? 'Enable Voice Command (Hey Nigha)' : 'Voice not supported in this browser'}
              >
                <Mic size={16} />
                {voice.isListening && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4, width: 8, height: 8,
                    borderRadius: '50%', background: PURPLE, animation: 'pulseGlow 1s infinite',
                  }} />
                )}
              </button>

              <button
                onClick={handleThemeToggle}
                style={{
                  padding: '6px 10px', borderRadius: '8px', background: 'var(--card-bg)',
                  border: `1px solid var(--border)`, color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
                className="rotate-switch"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Day Shift' : 'Night Ops'}
              </button>
            </div>
          </div>

          {/* TAB ROUTING */}

          {/* Operations Dashboard Tab (Bento Grid) */}
          {activeTab === 'dashboard' && (
            <div
              className="main-content-scroll"
              style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
              onTouchStart={(e) => {
                if (e.currentTarget.scrollTop === 0) {
                  touchStartRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                  };
                }
              }}
              onTouchEnd={(e) => {
                if (touchStartRef.current) {
                  const diffY = e.changedTouches[0].clientY - touchStartRef.current.y;
                  if (diffY > 80) {
                    triggerPullToRefresh();
                  }
                  touchStartRef.current = null;
                }
              }}
            >
              {isRefreshing && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px', background: 'var(--bg-hover)', color: BLUE, fontSize: '11px', fontWeight: 700 }}>
                  <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />
                  REFRESHING RADAR DATA...
                </div>
              )}

              <div className="bento-container">

                {/* 1. HERO TILE (spans 2 cols × 2 rows) */}
                <div
                  className="bento-tile bento-span-2 bento-row-span-2 visualization-tile"
                  style={{ padding: 0 }}
                >
                  {/* Synapses background visible through canvas */}
                  {renderSynapsesBg()}

                  {/* Header HUD overlay */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
                    background: 'linear-gradient(to bottom, rgba(10,15,26,0.7) 0%, rgba(10,15,26,0) 100%)',
                    pointerEvents: 'none'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                        Live Chute Digital Twin
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Vizag Plant · 3D Isometric Feed
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
                      <span className="shimmer-badge" style={{ borderColor: isArActive ? PURPLE : 'var(--border)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isArActive ? PURPLE : 'var(--text-muted)' }} />
                        AR OVERLAY ACTIVE
                      </span>
                    </div>
                  </div>

                  {/* 3D viewport canvas */}
                  <div className="visualization-canvas" style={{ position: 'relative', width: '100%' }}
                    onTouchStart={(e) => {
                      touchStartRef.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                      };
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartRef.current) {
                        const diffX = e.changedTouches[0].clientX - touchStartRef.current.x;
                        if (Math.abs(diffX) > 80) {
                          // Rotate the digital twin view
                          setTwinRotationX(r => (r + (diffX > 0 ? 45 : -45)) % 360);
                        }
                        touchStartRef.current = null;
                      }
                    }}
                  >
                    <React.Suspense fallback={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <CircularProgress color="inherit" size={30} />
                      </div>
                    }>
                      {expandedTile !== 'hero' ? (
                        <ChuteDigitalTwin theme={theme} rotationX={twinRotationX} />
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          height: '100%', 
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          gap: '6px',
                          fontFamily: "'JetBrains Mono', monospace"
                        }}>
                          <span style={{ width: '6px', height: '6px', backgroundColor: BLUE, borderRadius: '50%', boxShadow: `0 0 6px ${BLUE}` }} />
                          <span style={{ letterSpacing: '1px', fontWeight: 600 }}>3D VIEW ACTIVE IN OVERVIEW</span>
                        </div>
                      )}
                    </React.Suspense>
                  </div>

                  {/* Footer overlay containing core telemetry metrics */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
                    background: 'linear-gradient(to top, rgba(10,15,26,0.85) 0%, rgba(10,15,26,0) 100%)',
                    borderTop: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Flow Rate</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: BLUE, fontFamily: 'var(--font-mono)' }}>
                          {throughput.toFixed(1)} t/h
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Fill Level</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: statusColor, fontFamily: 'var(--font-mono)' }}>
                          {Math.min(100, Math.round(98 - (radars[0]?.distance ?? 3.5) * 25))}%
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedTile('hero')}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)', color: BLUE, border: 'none',
                        borderRadius: '6px', padding: '6px 12px', fontSize: '10px', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Maximize2 size={10} />
                      EXPAND VIEW
                    </button>
                  </div>
                </div>

                {/* 11. GNSS TRACKER MAP (2cols × 2rows) */}
                <div
                  className="bento-tile bento-span-2 bento-row-span-2 visualization-tile"
                  style={{ padding: '16px' }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: BLUE, textTransform: 'uppercase', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-sans)' }}>
                    GNSS Geofence Tracker
                  </span>
                  <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', background: 'var(--border-light)', height: 'calc(100% - 30px)' }}>
                    <React.Suspense fallback={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <CircularProgress color="inherit" size={24} />
                      </div>
                    }>
                      {chutes.length > 0 && <GlobalMap chutes={chutes} />}
                    </React.Suspense>
                  </div>
                </div>

                {/* 13. BLAST CONTROL PANEL (full width) */}
                {roleAccess.canTriggerManualBlast && (
                  <div className="bento-span-full bento-tile" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          🔥 Blast Control Panel
                        </span>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Select solenoid group → Hold FIRE BLAST for 2 seconds to activate
                        </div>
                      </div>
                      {compressor && compressor.pressure < 80 && (
                        <div style={{ fontSize: '9px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(244,63,94,0.1)', color: RED, fontWeight: 800, border: `1px solid ${RED}30` }}>
                          ⚠️ LOW PRESSURE — {compressor.pressure.toFixed(0)} PSI
                        </div>
                      )}
                    </div>

                    {/* Group Selector */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4].map(grp => {
                        const isRecommended = grp === nearestSolenoidGroup && chuteStatus !== 'Normal';
                        const isSelected = grp === blastSelectedGroup;
                        return (
                          <button
                            key={grp}
                            id={`blast-group-btn-${grp}`}
                            onClick={() => { setBlastSelectedGroup(grp); setBlastResult(null); }}
                            style={{
                              flex: 1, minWidth: '80px', padding: '10px 8px',
                              borderRadius: '8px', border: `2px solid ${isSelected ? BLUE : isRecommended ? AMBER : 'var(--border)'}`,
                              background: isSelected ? `${BLUE}18` : isRecommended ? `${AMBER}12` : 'var(--card-bg)',
                              color: isSelected ? BLUE : isRecommended ? AMBER : 'var(--text-secondary)',
                              cursor: 'pointer', fontWeight: 800, fontSize: '11px',
                              transition: 'all 0.15s ease',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>G{grp}</span>
                            <span style={{ fontSize: '8px', color: isRecommended ? AMBER : 'var(--text-muted)', fontWeight: 700 }}>
                              {[`S${grp}A`, `S${grp}B`, `S${grp}C`, `S${grp}D`].join(' ')}
                            </span>
                            {isRecommended && (
                              <span style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '4px', background: `${AMBER}20`, color: AMBER, fontWeight: 900 }}>RECOMMENDED</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Hold-to-Fire Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {blastHolding && (
                        <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--border-light)', overflow: 'hidden' }}>
                          <div style={{
                            position: 'absolute', left: 0, top: 0, height: '100%',
                            width: `${blastHoldProgress}%`,
                            background: blastHoldProgress < 60 ? AMBER : RED,
                            transition: 'width 0.05s linear',
                            boxShadow: blastHoldProgress > 90 ? `0 0 8px ${RED}` : 'none',
                          }} />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          id="blast-fire-button"
                          disabled={blastFiring || (compressor !== null && compressor.pressure < 80)}
                          onMouseDown={startBlastHold}
                          onMouseUp={cancelBlastHold}
                          onMouseLeave={cancelBlastHold}
                          onTouchStart={startBlastHold}
                          onTouchEnd={cancelBlastHold}
                          style={{
                            flex: 1, padding: '14px 20px',
                            borderRadius: '10px', border: 'none',
                            background: blastFiring
                              ? 'rgba(0,212,255,0.2)'
                              : blastHolding
                              ? `linear-gradient(135deg, ${RED} 0%, #ff6b35 100%)`
                              : `linear-gradient(135deg, rgba(244,63,94,0.85) 0%, rgba(239,68,68,0.9) 100%)`,
                            color: '#fff',
                            cursor: blastFiring || (compressor !== null && compressor.pressure < 80) ? 'not-allowed' : 'pointer',
                            fontWeight: 900, fontSize: '13px', letterSpacing: '1.5px',
                            textTransform: 'uppercase',
                            boxShadow: blastHolding ? `0 0 20px ${RED}60` : '0 4px 12px rgba(244,63,94,0.3)',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                            opacity: (compressor !== null && compressor.pressure < 80) ? 0.5 : 1,
                          }}
                        >
                          {blastFiring ? '⚡ FIRING...' : blastHolding ? `🔥 HOLD ${Math.round(blastHoldProgress)}%` : `🔥 FIRE BLAST — GROUP ${blastSelectedGroup}`}
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', minWidth: '54px' }}>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>PRESSURE</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 900, color: compressor && compressor.pressure < 80 ? RED : GREEN }}>
                            {compressor ? `${compressor.pressure.toFixed(0)}` : '--'} <span style={{ fontSize: '8px', fontWeight: 600 }}>PSI</span>
                          </div>
                        </div>
                      </div>

                      {blastResult && (
                        <div style={{
                          padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          background: blastResult.ok ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)',
                          border: `1px solid ${blastResult.ok ? GREEN : RED}30`,
                          color: blastResult.ok ? GREEN : RED,
                        }}>
                          {blastResult.ok ? '✓' : '✗'} {blastResult.msg}
                        </div>
                      )}

                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                        Hold the button for 2 seconds to confirm blast. Release early to cancel.
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. HEALTH SCORE TILE (1col × 1row) */}
                <div
                  className="bento-tile"
                  onClick={() => setExpandedTile('health')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Chute Health
                    </span>
                    {renderSparkline(healthHistory, healthColor)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '12px 0' }}>
                    {renderRadialGauge(chuteHealthScore, healthColor)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS:</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: healthColor, letterSpacing: '0.5px' }}>
                      {chuteHealthScore >= 80 ? 'STABLE' : chuteHealthScore >= 50 ? 'DEGRADED' : 'CRITICAL'}
                    </span>
                  </div>
                </div>

                {/* 3. THROUGHPUT TILE (1col × 1row) */}
                <div
                  className="bento-tile"
                  onClick={() => setExpandedTile('throughput')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Throughput
                    </span>
                    <span style={{ fontSize: '11px', color: GREEN, fontWeight: 700 }}>
                      ↑ 1.4%
                    </span>
                  </div>

                  <div style={{ margin: '14px 0' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: BLUE, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                      {throughput.toFixed(1)}
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>TONS PER HOUR</span>
                  </div>

                  <div style={{ width: '100%', height: '30px' }}>
                    {renderAreaSparkline(throughputHistory, BLUE)}
                  </div>
                </div>

                {/* 4. AI INSIGHT TILE (2cols × 1row) */}
                <div
                  className="bento-tile bento-span-2 ai-pulse-tile"
                  style={{ background: 'var(--panel-bg)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="ai-active-dot" />
                      <span className="shimmer-badge">AI-INFERENCE</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Flow Analytics</span>
                    </div>

                    <button
                      onClick={() => setExpandedTile('ai')}
                      style={{
                        background: 'none', color: PURPLE, fontSize: '9.5px', fontWeight: 700, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '2px'
                      }}
                    >
                      DETAILS <ChevronRight size={10} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', margin: '12px 0 6px 0' }}>
                    <div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, fontWeight: 500 }}>
                        {prediction ? prediction.recommendedActions[0] : 'Flow dynamics operating nominally. No anomalies detected.'}
                      </div>
                      <div style={{ fontSize: '9px', color: PURPLE, fontWeight: 700, marginTop: '8px', letterSpacing: '0.2px' }}>
                        Inference Latency: 12ms · Stable Mode
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px dashed var(--border)', paddingLeft: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Blockage Prob</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: (prediction?.blockageProbability ?? 0) > 30 ? AMBER : GREEN }}>
                          {prediction?.blockageProbability ?? 3}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Confidence Score</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          94.8%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Flow State</span>
                        <span style={{ fontWeight: 800, color: GREEN, fontSize: '9px', textTransform: 'uppercase' }}>
                          {chuteStatus || 'STABLE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. WEAR & TEAR TILE (1col × 1row) */}
                <div
                  className="bento-tile"
                  onClick={() => setExpandedTile('wear')}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Wear & Tear
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', margin: '10px 0' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Liner Wear</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wearIndex.toFixed(1)}% life</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${wearIndex}%`, background: wearIndex < 50 ? RED : GREEN }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Solenoids</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(avgBlasterHealth)}% life</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${avgBlasterHealth}%`, background: avgBlasterHealth < 50 ? RED : GREEN }} />
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Est. maintenance cycle: 42 days
                  </span>
                </div>

                {/* 6. ENVIRONMENT TILE (1col × 1row) */}
                <div
                  className="bento-tile"
                  onClick={() => setExpandedTile('environment')}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Local Env
                  </span>

                  <div style={{ display: 'flex', gap: '12px', margin: '8px 0', width: '100%' }}>
                    <div className="glass-card" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Thermometer size={14} style={{ color: PURPLE }} />
                      <div>
                        <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>TEMP</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{liveTemperature.toFixed(1)}°C</div>
                      </div>
                    </div>
                    <div className="glass-card" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Droplets size={14} style={{ color: BLUE }} />
                      <div>
                        <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>HUMID</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{liveHumidity.toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <Clock size={12} />
                    <span>Vizag Standard Time</span>
                  </div>
                </div>

                {/* 7. ALERT TIMELINE TILE (2cols × 1row) */}
                <div
                  className="bento-tile bento-span-2"
                  style={{ justifyContent: 'space-between', paddingBottom: '16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Active Alerts & Operations Timeline
                    </span>
                    <button
                      onClick={() => setExpandedTile('timeline')}
                      style={{ background: 'none', border: 'none', color: BLUE, fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      VIEW HISTORY
                    </button>
                  </div>

                  {timelineEvents.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center', width: '100%' }}>
                      No active alerts or events logged in system timeline.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflowX: 'auto', width: '100%', padding: '6px 2px' }}>
                      {timelineEvents.slice(0, 4).map((ev) => (
                        <div
                          key={ev.id}
                          className="glass-card"
                          style={{
                            minWidth: '170px', padding: '10px', borderLeft: `3px solid ${ev.color}`,
                            display: 'flex', flexDirection: 'column', gap: '3px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                            <span style={{ fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>{ev.type}</span>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 8. Moved QUICK ACTIONS to the bottom row next to Compressor Load */}

                {/* NIGHA RADAR LOCALIZATION ENGINE & CONTROL PANEL (Bento Span-2) */}
                <div className="glass-panel bento-span-2 bento-tile" style={{ minHeight: '250px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                        Nigha Radar Localization Engine
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Operational State & Simulation Control
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: simulationMode ? AMBER : GREEN }}>
                        {simulationMode ? 'MANUAL MODE' : 'PRODUCTION MODE'}
                      </span>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: simulationMode ? AMBER : GREEN,
                        boxShadow: simulationMode ? `0 0 6px ${AMBER}` : `0 0 6px ${GREEN}`
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
                    {/* Left: Localization Engine Metrics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Path</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: BLUE }}>
                            {activePath === 'LEFT_SLANT' ? 'LEFT SLANT (\\)' : 'RIGHT SLANT (/)'}
                          </span>
                          {/* Mini visual crossover indicator */}
                          <div style={{ display: 'flex', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 900, lineHeight: 1, letterSpacing: '1px' }}>
                            <span style={{ color: activePath === 'LEFT_SLANT' ? BLUE : 'var(--text-muted)', opacity: activePath === 'LEFT_SLANT' ? 1 : 0.25 }}>\</span>
                            <span style={{ color: activePath === 'RIGHT_SLANT' ? BLUE : 'var(--text-muted)', opacity: activePath === 'RIGHT_SLANT' ? 1 : 0.25 }}>/</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Blockage Zone</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: blockagePosition !== 'None' ? RED : GREEN }}>
                          {blockagePosition || 'None'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Blockage Distance</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: blockagePosition !== 'None' ? RED : GREEN }}>
                          {blockagePosition !== 'None' && typeof blockageDistance === 'number' ? `${blockageDistance.toFixed(2)}m` : '3.50m (Clear)'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>Nearest Solenoid Group</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: blockagePosition !== 'None' ? AMBER : 'var(--text-muted)' }}>
                          {blockagePosition !== 'None' ? `Group ${nearestSolenoidGroup} (S${nearestSolenoidGroup}A-D)` : 'None'}
                        </span>
                      </div>

                      {/* Recommendation Box */}
                      <div style={{
                        padding: '8px 10px', borderRadius: '6px',
                        background: blockagePosition !== 'None' ? 'rgba(244,63,94,0.06)' : 'rgba(52,211,153,0.06)',
                        border: `1px solid ${blockagePosition !== 'None' ? RED : GREEN}25`,
                        fontSize: '9.5px', color: blockagePosition !== 'None' ? RED : GREEN,
                        fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px'
                      }}>
                        <span style={{ textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Blast Recommendation</span>
                        <span>
                          {blockagePosition !== 'None'
                            ? `⚠️ FIRE SOLENOID GROUP ${nearestSolenoidGroup} TO CLEAR BUILDUP`
                            : '✅ SYSTEM OPERATING NOMINALLY. NO AIR BLAST REQUIRED.'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Operational Mode & Manual Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '1px dashed var(--border-light)', paddingLeft: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Mode</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(0,0,0,0.15)', padding: '3px', borderRadius: '6px' }}>
                          <button
                            onClick={() => handleToggleSimulationMode(false)}
                            style={{
                              padding: '5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                              background: !simulationMode ? GREEN : 'transparent',
                              color: !simulationMode ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            PRODUCTION
                          </button>
                          <button
                            onClick={() => handleToggleSimulationMode(true)}
                            style={{
                              padding: '5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                              background: simulationMode ? AMBER : 'transparent',
                              color: simulationMode ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            MANUAL SIM
                          </button>
                        </div>
                      </div>

                      {/* Manual Simulation Form */}
                      {simulationMode ? (
                        <form onSubmit={handleManualBlockageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                            <div>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>ZONE</span>
                              <select
                                value={injZone}
                                onChange={(e) => setInjZone(Number(e.target.value))}
                                style={{
                                  width: '100%', padding: '4px 6px', background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px'
                                }}
                              >
                                <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 (L-Top)</option>
                                <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 (R-Top)</option>
                                <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 (R-Bot)</option>
                                <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 (L-Bot)</option>
                              </select>
                            </div>
                            <div>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>POSITION DESC</span>
                              <input
                                type="text"
                                value={injPosition}
                                onChange={(e) => setInjPosition(e.target.value)}
                                placeholder="Zone 1"
                                style={{
                                  width: '100%', padding: '4px 6px', background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none'
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                              <span>DISTANCE</span>
                              <span style={{ color: BLUE, fontFamily: 'var(--font-mono)' }}>{injDistance.toFixed(2)}m</span>
                            </div>
                            <input
                              type="range"
                              min="0.10"
                              max="3.00"
                              step="0.05"
                              value={injDistance}
                              onChange={(e) => setInjDistance(Number(e.target.value))}
                              style={{ width: '100%', accentColor: BLUE, height: '4px', cursor: 'pointer' }}
                            />
                          </div>

                          <button
                            type="submit"
                            style={{
                              padding: '6px', background: 'rgba(0, 212, 255, 0.1)', color: BLUE, border: `1px solid ${BLUE}40`,
                              borderRadius: '4px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', width: '100%',
                              textAlign: 'center', transition: 'all 0.15s ease'
                            }}
                          >
                            INJECT BLOCKAGE
                          </button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '6px', opacity: 0.7 }}>
                          <span style={{ fontSize: '20px' }}>📡</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
                            Localization engine is processing live telemetry from physical radars 1-4.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 9. RADAR Sparkline detail & manual override Valves (Bento Span-2) */}
                <div className="glass-panel bento-span-2 bento-tile" style={{ minHeight: '250px', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: BLUE, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                        Active Blasters Override Panel
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Compressor status: {compressor ? `${compressor.pressure.toFixed(0)} PSI` : 'OFFLINE'}
                      </div>
                    </div>
                    {chuteKpis && (
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Blast Effectiveness Score: <span style={{ color: GREEN, fontWeight: 800 }}>{blastEffScore}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', width: '100%', margin: '14px 0 0 0' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((valveNo) => {
                      const sv = solenoids?.find(s => s.valveNumber === valveNo);
                      const sHealth = sv?.healthScore ?? 98;
                      const zoneIndex = Math.ceil(valveNo / 2) - 1;
                      const radar = radars[zoneIndex];
                      const isBlocked = radar?.buildupDetected;
                      const isTargetValve = isBlocked && (
                        radar.distance < 0.65 ? (valveNo % 2 !== 0) : (valveNo % 2 === 0)
                      );
                      const isOtherValveInBlockedZone = isBlocked && !isTargetValve;

                      const isBlasting = activeSolenoidValves.includes(valveNo);
                      const canBlast = roleAccess.canTriggerManualBlast && 
                                       !(compressor && compressor.pressure < 80) &&
                                       !isOtherValveInBlockedZone;

                      return (
                        <div
                          key={valveNo}
                          className="glass-card"
                          style={{
                            padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px',
                            border: `1px solid ${isBlasting ? BLUE : isTargetValve ? RED : isBlocked ? 'rgba(244,63,94,0.1)' : 'var(--border-light)'}`,
                            background: isBlasting ? 'rgba(0, 212, 255, 0.08)' : 'var(--card-bg)',
                            opacity: isOtherValveInBlockedZone ? 0.45 : 1,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>SV{valveNo}</span>
                              {isTargetValve && (
                                <span style={{ fontSize: '7px', padding: '1px 3px', borderRadius: '3px', background: 'rgba(244,63,94,0.15)', color: RED, fontWeight: 800 }}>TARGET</span>
                              )}
                            </div>
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: isBlasting ? BLUE : isBlocked ? (isTargetValve ? RED : 'var(--text-muted)') : GREEN,
                              boxShadow: isBlasting ? `0 0 6px ${BLUE}` : 'none'
                            }} />
                          </div>

                          <button
                            disabled={!canBlast}
                            onClick={() => handleManualValveBlast(valveNo)}
                            style={{
                              padding: '4px 6px', fontSize: '9px', fontWeight: 700, borderRadius: '4px',
                              background: isBlasting ? BLUE : isTargetValve ? 'rgba(244,63,94,0.2)' : isOtherValveInBlockedZone ? 'transparent' : 'rgba(0, 212, 255, 0.1)',
                              color: isBlasting ? '#fff' : isTargetValve ? RED : isOtherValveInBlockedZone ? 'var(--text-muted)' : BLUE,
                              cursor: canBlast ? 'pointer' : 'not-allowed',
                              border: isOtherValveInBlockedZone ? '1px dashed var(--border)' : 'none',
                              width: '100%', textAlign: 'center', transition: 'all 0.15s ease'
                            }}
                            title={isOtherValveInBlockedZone ? 'Ineffective valve for current blockage position' : ''}
                          >
                            {isBlasting ? 'BLAST' : isOtherValveInBlockedZone ? 'INACTIVE' : 'FIRE'}
                          </button>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <div className="progress-track" style={{ height: '2px' }}>
                              <div className="progress-fill" style={{ width: `${sHealth}%`, background: sHealth < 50 ? RED : GREEN }} />
                            </div>
                            <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', textAlign: 'right' }}>HLTH: {sHealth}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 10. REAL-TIME DISTANCE SVG TREND CHART (2cols × 1row) */}
                <div className="glass-panel bento-span-2 bento-tile" style={{ padding: '16px' }}>
                  <div style={{ flex: 1, minHeight: '170px' }}>
                    <TelemetryChart isDark={isDark} />
                  </div>
                </div>

                {/* 8. QUICK ACTIONS TILE (1col × 1row) */}
                <div className="bento-tile">
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Quick Tools
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', margin: '10px 0' }}>
                    <button
                      onClick={() => setReportModalOpen(true)}
                      className="glass-card"
                      style={{
                        padding: '8px 12px', border: 'none', width: '100%',
                        fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                      }}
                    >
                      <span>📄 EXPORT REPORT</span>
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>

                    {roleAccess.canRunCalibration && (
                      <button
                        onClick={() => { setCalibStep(1); setCalibResult(null); setCalibError(null); setCalibModalOpen(true); }}
                        className="glass-card"
                        style={{
                          padding: '8px 12px', border: 'none', width: '100%',
                          fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                        }}
                      >
                        <span>⚙️ CALIBRATE RADARS</span>
                        <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    )}

                    <button
                      onClick={() => setBlockageModalOpen(true)}
                      className="glass-card"
                      style={{
                        padding: '8px 12px', border: 'none', width: '100%',
                        fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                      }}
                    >
                      <span>⚠️ INJECT BLOCKAGE</span>
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>

                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Calibrates Zone 1-4 telemetry models
                  </span>
                </div>

                {/* 11. Moved GNSS TRACKER MAP to the top row */}

                {/* 12. COMPRESSOR & PRESSURE TILE (1col × 1row) */}
                <div className="bento-tile">
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Compressor Load
                  </span>

                  {compressor ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', margin: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Pressure:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: compressor.pressure < 80 ? RED : BLUE }}>
                          {compressor.pressure.toFixed(0)} PSI
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${compressor.pressure}%`, background: compressor.pressure < 80 ? RED : GREEN }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                        <span>Energy Used:</span>
                        <span style={{ fontWeight: 600 }}>{energy.toFixed(1)} kWh</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>OFFLINE</div>
                  )}

                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Alert limit threshold &lt; 80 PSI
                  </span>
                </div>

                {/* 13. Moved BLAST CONTROL PANEL to the top, directly below visualization line */}

              </div>
            </div>
          )}

          {/* Maintenance Hub Tab */}
          {activeTab === 'maintenance' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Maintenance Hub</h2>

                {roleAccess.canCreateMaintenanceTicket && (
                  <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Create Work Order</div>
                    <form onSubmit={handleCreateTicket} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <select
                        value={selectedAssetType}
                        onChange={e => setSelectedAssetType(e.target.value)}
                        style={{ padding: '8px 12px', border: `1px solid var(--border)`, borderRadius: '6px' }}
                      >
                        {['AirBlaster', 'Solenoid', 'Compressor', 'Sensor', 'Structure'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input
                        value={newTicketDesc}
                        onChange={e => setNewTicketDesc(e.target.value)}
                        placeholder="Describe system malfunction details..."
                        style={{ flex: 1, padding: '8px 12px', border: `1px solid var(--border)`, borderRadius: '6px' }}
                      />
                      <button type="submit" style={{ padding: '8px 20px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                        Create Work Order
                      </button>
                    </form>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {maintenanceTickets.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="glass-panel" style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="skeleton-shimmer" style={{ width: '3px', height: '40px', borderRadius: '2px', flexShrink: 0 }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="skeleton-shimmer" style={{ height: '12px', width: '100px', borderRadius: '4px' }} />
                            <div className="skeleton-shimmer" style={{ height: '11px', width: '260px', borderRadius: '4px' }} />
                          </div>
                          <div className="skeleton-shimmer" style={{ height: '20px', width: '70px', borderRadius: '6px', flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {maintenanceTickets.map((ticket: any) => (
                    <div key={ticket._id} className="glass-panel" style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '3px', alignSelf: 'stretch', borderRadius: '2px', background: ticket.status === 'Resolved' ? 'var(--text-muted)' : ticket.description?.startsWith('AUTO:') ? RED : AMBER, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>{ticket.assetType}</span>
                          {ticket.description?.startsWith('AUTO:') && (
                            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(244,63,94,0.1)', color: RED, fontWeight: 800 }}>AUTO-TICKET</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ticket.description}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: ticket.status === 'Resolved' ? GREEN : AMBER }}>{ticket.status.toUpperCase()}</span>
                        {ticket.status !== 'Resolved' && roleAccess.isManager && (
                          <button
                            onClick={() => handleResolveTicket(ticket._id)}
                            style={{ padding: '5px 12px', borderRadius: '6px', background: 'rgba(52,211,153,0.1)', border: `1px solid ${GREEN}30`, color: GREEN, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'audit' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>System Audit Logs</h2>
                <TableContainer component={Paper} style={{ background: 'var(--card-bg)', borderRadius: '12px', border: `1px solid var(--border)` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Timestamp', 'Action Event', 'Event Logs Details'].map(h => (
                          <TableCell key={h} style={{ background: 'var(--border-light)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, borderBottom: `1px solid var(--border)` }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        // Skeleton rows shown while audit logs are loading
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={`skel-${i}`}>
                            {[120, 160, 280].map((w, j) => (
                              <TableCell key={j} style={{ borderBottom: `1px solid var(--border-light)`, padding: '12px' }}>
                                <div className="skeleton-shimmer" style={{ height: '12px', width: `${w}px`, borderRadius: '4px' }} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        auditLogs.map((log: any) => (
                          <TableRow key={log._id}>
                            <TableCell style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)', borderBottom: `1px solid var(--border-light)` }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell style={{ color: BLUE, fontSize: '12px', fontWeight: 700, borderBottom: `1px solid var(--border-light)` }}>{log.action}</TableCell>
                            <TableCell style={{ color: 'var(--text-secondary)', fontSize: '11px', borderBottom: `1px solid var(--border-light)` }}>{log.details}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && roleAccess.canViewUserManagement && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>User Access & Credentials Registry</h2>

                {userSuccess && <Alert severity="success" style={{ fontSize: '12px', marginBottom: '10px' }}>{userSuccess}</Alert>}
                {userError && <Alert severity="error" style={{ fontSize: '12px', marginBottom: '10px' }}>{userError}</Alert>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                  
                  {/* Register New User Form */}
                  <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', height: 'fit-content' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Register New Operator</div>
                    <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Full Name</div>
                        <input
                          value={newUserName}
                          onChange={e => setNewUserName(e.target.value)}
                          placeholder="e.g. John Doe"
                          required
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Phone Number</div>
                        <input
                          value={newUserPhone}
                          onChange={e => setNewUserPhone(e.target.value)}
                          placeholder="e.g. +919999999999"
                          required
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>System Role</div>
                        <select
                          value={newUserRole}
                          onChange={e => setNewUserRole(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="Worker">Worker (Operator)</option>
                          <option value="Manager">Manager (Supervisor)</option>
                          <option value="Admin">Admin (Plant Admin)</option>
                          <option value="Super Admin">Super Admin (System Owner)</option>
                        </select>
                      </div>

                      <button type="submit" style={{ marginTop: '8px', padding: '10px 20px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                        Create User Credentials
                      </button>
                    </form>
                  </div>

                  {/* Registered Users List */}
                  <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Active Credentials Registry ({allUsers.length})</div>
                    {userLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="glass-card" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div className="skeleton-shimmer" style={{ height: '13px', width: '140px', borderRadius: '4px' }} />
                              <div className="skeleton-shimmer" style={{ height: '10px', width: '200px', borderRadius: '4px' }} />
                            </div>
                            <div className="skeleton-shimmer" style={{ height: '18px', width: '60px', borderRadius: '12px' }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                        {allUsers.map((u: any) => (
                          <div key={u._id} className="glass-card" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.ngId} · {u.phone}</div>
                              </div>
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: u.isActive ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)',
                                color: u.isActive ? GREEN : RED,
                                fontWeight: 800
                              }}>
                                {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid var(--border-light)`, paddingTop: '8px', marginTop: '4px' }}>
                              {/* Role Selector */}
                              {roleAccess.isSuperAdmin && u._id !== user?._id ? (
                                <select
                                  value={u.role}
                                  onChange={e => handleUpdateUserRole(u._id, e.target.value)}
                                  style={{ padding: '4px 8px', fontSize: '11px', border: `1px solid var(--border)`, borderRadius: '6px' }}
                                >
                                  {['Worker', 'Manager', 'Admin', 'Super Admin'].map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{u.role}</span>
                              )}

                              {/* Toggle Active / Delete controls */}
                              {u._id !== user?._id && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => handleToggleUserActive(u._id)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      border: `1px solid ${u.isActive ? AMBER : GREEN}40`,
                                      background: `${u.isActive ? AMBER : GREEN}15`,
                                      color: u.isActive ? AMBER : GREEN,
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    {u.isActive ? 'Suspend' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u._id)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      border: `1px solid ${RED}40`,
                                      background: `${RED}15`,
                                      color: RED,
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Profile Settings Tab */}
          {activeTab === 'profile' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Profile Settings</h2>
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Operator Name', val: user?.name },
                    { label: 'Role Level', val: user?.role },
                    { label: 'Phone Signature', val: user?.phone || 'Not set' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '10px', borderBottom: `1px solid var(--border-light)` }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row.val}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setPhoneModalOpen(true)}
                    style={{
                      marginTop: '8px', padding: '8px 16px', background: 'var(--card-bg)',
                      border: `1px solid var(--border)`, borderRadius: '8px', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer'
                    }}
                    className="glass-card"
                  >
                    Modify Phone Number
                  </button>
                </div>

                {/* QR Onboarding Control Panel */}
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>⚙️ Hardware Hub Onboarding</h3>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                    Link a physical edge gateway hub to the current active chute. This generates a secure, signed QR code token for the hardware installer.
                  </p>
                  
                  {activeChute ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Chute:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{activeChute.name} ({activeChute.chuteCode || 'No Code'})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Linked Device ID:</span>
                          <span style={{ color: activeChute.linkedDeviceId ? GREEN : AMBER, fontWeight: 700 }}>
                            {activeChute.linkedDeviceId ? activeChute.linkedDeviceId : 'Unlinked'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleOpenQrModal}
                        style={{
                          padding: '10px 16px', background: BLUE,
                          border: 'none', borderRadius: '8px', color: 'white',
                          fontFamily: 'var(--font-sans)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        Generate Onboarding QR Code
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: AMBER, fontWeight: 700, textAlign: 'center', padding: '10px' }}>
                      ⚠️ Please select a chute on the main dashboard tab first.
                    </div>
                  )}
                </div>

                {/* Super Admin Actions */}
                {roleAccess.isSuperAdmin && (
                  <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', border: `1px solid ${RED}30` }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: RED, margin: 0 }}>🚨 Super Admin Zone</h3>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                      Perform high-privilege system recovery tasks. Wiping the operational database removes all historical telemetry, alerts, and work orders while preserving users and chute configurations.
                    </p>
                    <button
                      onClick={() => { setDbResetDialogOpen(true); setDbResetResult(null); }}
                      style={{
                        padding: '10px 16px', background: `linear-gradient(135deg, ${RED} 0%, #b91c1c 100%)`,
                        border: 'none', borderRadius: '8px', color: 'white',
                        fontFamily: 'var(--font-sans)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                        boxShadow: `0 4px 12px ${RED}30`
                      }}
                    >
                      Reset Operational Database
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fleet Management Tab */}
          {activeTab === 'registry' && roleAccess.isAdmin && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fleet Management</h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Enterprise Plant &amp; Chute Registry — Multi-Tenant RBAC
                    </div>
                  </div>
                  {roleAccess.isSuperAdmin && (
                    <button
                      onClick={handleMigrateNgIds}
                      style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: `1px solid ${BLUE}60`, background: `${BLUE}15`, color: BLUE, cursor: 'pointer' }}
                    >
                      🔧 Migrate Legacy NG IDs
                    </button>
                  )}
                </div>

                {/* Sub-tab navigation */}
                <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid var(--border-light)`, paddingBottom: '0' }}>
                  {[
                    ...(roleAccess.isSuperAdmin ? [{ key: 'plants', label: '🏭 Plants' }] : []),
                    { key: 'chutes', label: '⚙️ Chutes' },
                    { key: 'assignments', label: '👤 Assignments' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setRegistrySubTab(tab.key as any)}
                      style={{
                        padding: '8px 18px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        background: registrySubTab === tab.key ? BLUE : 'transparent',
                        color: registrySubTab === tab.key ? '#fff' : 'var(--text-secondary)',
                        borderBottom: registrySubTab === tab.key ? `2px solid ${BLUE}` : '2px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ─── PLANTS SUB-TAB ─────────────────────────────────────────────────── */}
                {registrySubTab === 'plants' && roleAccess.isSuperAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {plantRegSuccess && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: GREEN, fontSize: '12px', fontWeight: 600 }}>{plantRegSuccess}</div>}
                    {plantRegError && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: RED, fontSize: '12px', fontWeight: 600 }}>{plantRegError}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px' }}>
                      {/* Create Plant Form */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Register New Plant</div>
                        <form onSubmit={handleRegisterPlant} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Plant Name *</div>
                            <input value={plantRegName} onChange={e => setPlantRegName(e.target.value)} placeholder="e.g. Visakhapatnam Steel Plant" required style={{ width: '100%' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Plant Code <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — auto-generated from initials)</span></div>
                            <input value={plantRegCode} onChange={e => setPlantRegCode(e.target.value.toUpperCase())} placeholder="e.g. VS → NGVS prefix" maxLength={4} style={{ width: '100%', textTransform: 'uppercase' }} />
                            {plantRegCode && (
                              <div style={{ fontSize: '10px', color: BLUE, marginTop: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                NG Prefix: NG{plantRegCode.toUpperCase()} → IDs: NG{plantRegCode.toUpperCase()}000001, NG{plantRegCode.toUpperCase()}000002...
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Industry Type</div>
                            <select value={plantRegIndustry} onChange={e => setPlantRegIndustry(e.target.value)} style={{ width: '100%' }}>
                              <option value="Mining">Mining</option>
                              <option value="Steel">Steel</option>
                              <option value="Cement">Cement</option>
                              <option value="Coal">Coal</option>
                              <option value="Grain">Grain / Agriculture</option>
                              <option value="Port">Port / Logistics</option>
                              <option value="Power">Power Plant</option>
                              <option value="Chemical">Chemical</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Owner Name</div>
                            <input value={plantRegOwner} onChange={e => setPlantRegOwner(e.target.value)} placeholder="e.g. Rashtriya Ispat Nigam Ltd." style={{ width: '100%' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Contact Number</div>
                              <input value={plantRegContact} onChange={e => setPlantRegContact(e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Email</div>
                              <input type="email" value={plantRegEmail} onChange={e => setPlantRegEmail(e.target.value)} placeholder="admin@plant.com" style={{ width: '100%' }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Address</div>
                            <input value={plantRegAddress} onChange={e => setPlantRegAddress(e.target.value)} placeholder="City, State, Country" style={{ width: '100%' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Description</div>
                            <input value={plantRegDesc} onChange={e => setPlantRegDesc(e.target.value)} placeholder="Brief description of this plant facility" style={{ width: '100%' }} />
                          </div>
                          <button type="submit" disabled={plantRegLoading} style={{ marginTop: '8px', padding: '10px 20px', background: plantRegLoading ? 'var(--border-light)' : BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: plantRegLoading ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                            {plantRegLoading ? 'Registering...' : '+ Register Plant'}
                          </button>
                        </form>
                      </div>

                      {/* Plants List */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Registered Plants ({plantsList.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                          {plantsList.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No plants registered yet</div>
                          ) : (
                            plantsList.map((p: any) => (
                              <div key={p._id} className="glass-card" style={{ padding: '12px', opacity: p.isActive ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: p.isActive ? 'rgba(52,211,153,0.1)' : 'rgba(100,100,100,0.2)', color: p.isActive ? GREEN : 'var(--text-muted)', fontWeight: 800 }}>
                                        {p.isActive ? 'ACTIVE' : 'DISABLED'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: BLUE, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{p.ngPrefix}XXXXXX — {p.industryType || 'Mining'}</div>
                                    {p.ownerName && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>Owner: {p.ownerName}</div>}
                                    {p.address && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.address}</div>}
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button onClick={() => handleOpenEditPlant(p)} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: `1px solid ${BLUE}40`, background: `${BLUE}15`, color: BLUE, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                                    <button onClick={() => handleTogglePlantActive(p)} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: `1px solid ${p.isActive ? RED : GREEN}40`, background: `${p.isActive ? RED : GREEN}15`, color: p.isActive ? RED : GREEN, cursor: 'pointer', fontWeight: 600 }}>
                                      {p.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── CHUTES SUB-TAB ─────────────────────────────────────────────────── */}
                {registrySubTab === 'chutes' && roleAccess.isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {regSuccess && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: GREEN, fontSize: '12px', fontWeight: 600 }}>{regSuccess}</div>}
                    {regError && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: RED, fontSize: '12px', fontWeight: 600 }}>{regError}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px' }}>
                      {/* Register Chute Form */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Register New Chute</div>
                        <form onSubmit={handleRegisterChute} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Chute Name *</div>
                            <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. Blast Furnace Chute #4" required style={{ width: '100%' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Associated Plant *</div>
                            <select value={regPlantId} onChange={e => setRegPlantId(e.target.value)} style={{ width: '100%' }} required>
                              <option value="">— Select a plant —</option>
                              {plantsList.filter(p => p.isActive).map(p => (
                                <option key={p._id} value={p._id}>{p.name} [{p.ngPrefix}]</option>
                              ))}
                            </select>
                            {regPlantId && (() => { const sel = plantsList.find(p => p._id === regPlantId); return sel ? <div style={{ fontSize: '10px', color: BLUE, fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '4px' }}>Next ID: {sel.ngPrefix}-CH-{String((sel.currentChuteSequence || 0) + 1).padStart(5, '0')}</div> : null; })()}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Latitude <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></div>
                              <input type="number" step="any" value={regLat} onChange={e => setRegLat(e.target.value)} placeholder="17.6258" style={{ width: '100%' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Longitude <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></div>
                              <input type="number" step="any" value={regLng} onChange={e => setRegLng(e.target.value)} placeholder="83.1557" style={{ width: '100%' }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Material Classification</div>
                            <select value={regMaterial} onChange={e => setRegMaterial(e.target.value)} style={{ width: '100%' }}>
                              <option value="generic">Generic (Balanced)</option>
                              <option value="iron_ore">Iron Ore (Heavy/Fast)</option>
                              <option value="coal">Coal (Swelling/Moisture)</option>
                              <option value="limestone">Limestone (Sticky)</option>
                              <option value="grain">Grain (Organic/Dry)</option>
                            </select>
                          </div>
                          <button type="submit" style={{ marginTop: '8px', padding: '10px 20px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                            + Register Chute Asset
                          </button>
                        </form>
                      </div>

                      {/* Chute Fleet List */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Registered Fleet ({chutes.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                          {chutes.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>No chutes registered yet</div>
                          ) : (
                            chutes.map((c: any) => (
                              <div key={c._id} className="glass-card" style={{ padding: '10px', opacity: c.isActive ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{c.name}</span>
                                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: c.isActive ? (c.status === 'Normal' ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)') : 'rgba(100,100,100,0.2)', color: c.isActive ? (c.status === 'Normal' ? GREEN : RED) : 'var(--text-muted)', fontWeight: 800 }}>
                                        {c.isActive ? c.status?.toUpperCase() : 'DISABLED'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: BLUE, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{c.chuteCode || 'No Code'}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Plant: {c.plantName} | Mat: {c.materialType || 'generic'}</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button onClick={() => handleOpenEditChute(c)} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: `1px solid ${BLUE}40`, background: `${BLUE}15`, color: BLUE, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                                    <button onClick={() => handleToggleChuteActive(c)} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: `1px solid ${c.isActive ? RED : GREEN}40`, background: `${c.isActive ? RED : GREEN}15`, color: c.isActive ? RED : GREEN, cursor: 'pointer', fontWeight: 600 }}>
                                      {c.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── ASSIGNMENTS SUB-TAB ────────────────────────────────────────────── */}
                {registrySubTab === 'assignments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {assignSuccess && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: GREEN, fontSize: '12px', fontWeight: 600 }}>{assignSuccess}</div>}
                    {assignError && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: RED, fontSize: '12px', fontWeight: 600 }}>{assignError}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {/* Create Assignment Form */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Assign Operator to Asset</div>
                        <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Select User</div>
                            <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} style={{ width: '100%' }} required>
                              <option value="">— Select user —</option>
                              {allUsers.map(u => (
                                <option key={u._id} value={u._id}>{u.name} [{u.ngId}] ({u.role})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Assignment Level</div>
                            <select value={assignAssetType} onChange={e => setAssignAssetType(e.target.value as any)} style={{ width: '100%' }}>
                              <option value="Chute">Chute Level (Worker / Manager)</option>
                              <option value="Plant">Plant Level (Admin / Manager)</option>
                            </select>
                          </div>
                          {assignAssetType === 'Plant' ? (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Select Plant</div>
                              <select value={assignPlantId} onChange={e => setAssignPlantId(e.target.value)} style={{ width: '100%' }} required>
                                <option value="">— Select plant —</option>
                                {plantsList.filter(p => p.isActive).map(p => (
                                  <option key={p._id} value={p._id}>{p.name} [{p.ngPrefix}]</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>Select Chute</div>
                              <select value={assignChuteId} onChange={e => setAssignChuteId(e.target.value)} style={{ width: '100%' }} required>
                                <option value="">— Select chute —</option>
                                {chutes.filter(c => c.isActive).map(c => (
                                  <option key={c._id} value={c._id}>{c.name} [{c.chuteCode}] — {c.plantName}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <button type="submit" style={{ marginTop: '4px', padding: '10px 20px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                            Assign User to Asset
                          </button>
                        </form>
                      </div>

                      {/* Active Assignments List */}
                      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Active Assignments ({assignments.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                          {assignments.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px', textAlign: 'center' }}>No active assignments registered</div>
                          ) : (
                            assignments.map((a: any) => (
                              <div key={a._id} className="glass-card" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{a.userId?.name || 'Unknown User'}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {a.userId?.ngId && <span style={{ fontFamily: 'var(--font-mono)', color: BLUE, fontWeight: 700 }}>[{a.userId.ngId}] </span>}
                                    {a.userId?.role || 'Unknown role'}
                                  </div>
                                  <div style={{ fontSize: '10px', color: BLUE, fontWeight: 600, marginTop: '2px' }}>
                                    {a.plantId ? `🏭 Plant: ${a.plantId.name || a.plantId}` : a.chuteId ? `⚙️ Chute: ${a.chuteId.name || a.chuteId}` : 'N/A'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteAssignment(a._id)}
                                  style={{ padding: '4px 10px', fontSize: '10.5px', borderRadius: '4px', border: `1px solid ${RED}40`, background: `${RED}15`, color: RED, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Revoke
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ─── PLANT EDIT MODAL ────────────────────────────────────────── */}
          {editPlantModalOpen && editingPlant && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="glass-panel" style={{ width: '480px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Plant — {editingPlant.plantCode}</div>
                  <button onClick={() => setEditPlantModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>
                {editPlantError && <div style={{ color: RED, fontSize: '12px' }}>{editPlantError}</div>}
                <form onSubmit={handleSavePlantEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['name', 'industryType', 'ownerName', 'contactNumber', 'email', 'address', 'description'].map(field => (
                    <div key={field}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600, textTransform: 'capitalize' }}>{field.replace(/([A-Z])/g, ' $1')}</div>
                      <input value={editPlantFields[field] || ''} onChange={e => setEditPlantFields((f: any) => ({ ...f, [field]: e.target.value }))} style={{ width: '100%' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" disabled={editPlantLoading} style={{ flex: 1, padding: '10px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: editPlantLoading ? 'not-allowed' : 'pointer' }}>
                      {editPlantLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditPlantModalOpen(false)} style={{ flex: 1, padding: '10px', background: 'var(--border-light)', color: 'var(--text-secondary)', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── CHUTE EDIT MODAL ────────────────────────────────────────── */}
          {editChuteModalOpen && editingChute && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="glass-panel" style={{ width: '400px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Chute — {editingChute.chuteCode}</div>
                  <button onClick={() => setEditChuteModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>
                {editChuteError && <div style={{ color: RED, fontSize: '12px' }}>{editChuteError}</div>}
                <form onSubmit={handleSaveChuteEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Chute Name</div>
                    <input value={editChuteFields.name || ''} onChange={e => setEditChuteFields((f: any) => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Material Type</div>
                    <select value={editChuteFields.materialType || 'generic'} onChange={e => setEditChuteFields((f: any) => ({ ...f, materialType: e.target.value }))} style={{ width: '100%' }}>
                      <option value="generic">Generic</option>
                      <option value="iron_ore">Iron Ore</option>
                      <option value="coal">Coal</option>
                      <option value="limestone">Limestone</option>
                      <option value="grain">Grain</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" disabled={editChuteLoading} style={{ flex: 1, padding: '10px', background: BLUE, color: '#fff', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: editChuteLoading ? 'not-allowed' : 'pointer' }}>
                      {editChuteLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditChuteModalOpen(false)} style={{ flex: 1, padding: '10px', background: 'var(--border-light)', color: 'var(--text-secondary)', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}


          {/* Incident Center Tab */}
          {activeTab === 'incidents' && roleAccess.canManageIncidents && (
            <IncidentCenter activeChuteId={activeChuteId || undefined} />
          )}

          {/* Fleet Analytics Tab */}
          {activeTab === 'fleet-analytics' && roleAccess.canViewFleetAnalytics && (
            <React.Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px', color: '#ff6b35' }}>
                <CircularProgress color="inherit" size={50} />
              </div>
            }>
              <FleetAnalytics />
            </React.Suspense>
          )}

        </div>
      </div>

      {/* ─── PHONE CHANGE OTP MODAL ─── */}
      <Modal open={phoneModalOpen} onClose={() => setPhoneModalOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
          p: 4, width: 420, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Modify Phone Signature</div>
          {phoneError && <Alert severity="error" style={{ marginBottom: '12px', fontSize: '12px' }}>{phoneError}</Alert>}
          {phoneInfo && <Alert severity="info" style={{ marginBottom: '12px', fontSize: '12px' }}>{phoneInfo}</Alert>}
          {phoneChangeStep === 1 ? (
            <form onSubmit={handleRequestPhoneChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>New Phone Signature</div>
                <TextField fullWidth value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+919999999999" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
              </div>
              <Button type="submit" variant="contained" style={{ background: BLUE, color: 'white', fontWeight: 700 }}>Dispatch Verification Codes</Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPhoneChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>OTP (Current signature log)</div>
                <TextField fullWidth value={oldPhoneOtp} onChange={(e) => setOldPhoneOtp(e.target.value)} placeholder="123456" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>OTP (New signature log)</div>
                <TextField fullWidth value={newPhoneOtp} onChange={(e) => setNewPhoneOtp(e.target.value)} placeholder="123456" required slotProps={{ input: { style: { color: 'var(--text-primary)' } } }} />
              </div>
              <Button type="submit" variant="contained" style={{ background: BLUE, color: 'white', fontWeight: 700 }}>Authenticate and Commit</Button>
            </form>
          )}
        </Box>
      </Modal>

      {/* ─── BLOCKAGE INJECTION MODAL ─── */}
      <Modal open={blockageModalOpen} onClose={() => setBlockageModalOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
          p: 4, width: 420, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Inject Simulated Blockage</div>
          
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
            <span style={{ color: BLUE, fontWeight: 700 }}>Note:</span> Distance controls which solenoid valve is designated as the target.
            <br />• Distance <span style={{ color: AMBER }}>&lt; 0.65m</span> targets the <span style={{ fontWeight: 700 }}>upper valve</span> (odd numbers: SV1, SV3, SV5, SV7).
            <br />• Distance <span style={{ color: AMBER }}>&ge; 0.65m</span> targets the <span style={{ fontWeight: 700 }}>lower valve</span> (even numbers: SV2, SV4, SV6, SV8).
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleInjectBlockage(injZone, injDistance);
          }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Target Zone</div>
              <select
                value={injZone}
                onChange={(e) => setInjZone(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'var(--input-bg, rgba(255,255,255,0.05))',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              >
                <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 (SV1 / SV2)</option>
                <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 (SV3 / SV4)</option>
                <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 (SV5 / SV6)</option>
                <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 (SV7 / SV8)</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                <span>Radar Distance (m)</span>
                <span style={{ color: BLUE, fontFamily: 'var(--font-mono)' }}>{injDistance.toFixed(2)}m</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="3.00"
                step="0.05"
                value={injDistance}
                onChange={(e) => setInjDistance(Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  accentColor: BLUE
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>0.10m (Critical)</span>
                <span>0.65m (Threshold)</span>
                <span>3.00m (Clear)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <Button
                onClick={() => setBlockageModalOpen(false)}
                variant="outlined"
                fullWidth
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  fontWeight: 700
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                style={{
                  background: BLUE,
                  color: 'white',
                  fontWeight: 700
                }}
              >
                Inject Blockage
              </Button>
            </div>
          </form>
        </Box>
      </Modal>

      {/* ─── REPORT EXPORT MODAL ─── */}
      <Modal open={reportModalOpen} onClose={() => setReportModalOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
          p: 4, width: 420, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: BLUE }} />
            <span>Export Operational Report</span>
          </div>

          {reportError && <Alert severity="error" style={{ marginBottom: '14px', fontSize: '12px' }}>{reportError}</Alert>}

          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
            Generate a comprehensive report for the active chute. This includes 24h telemetry logs, blast outcomes, active hardware alerts, and maintenance logs.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Select Export Format</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setReportFormat('pdf')}
                  style={{
                    padding: '12px', borderRadius: '8px', border: `1px solid ${reportFormat === 'pdf' ? BLUE : 'var(--border)'}`,
                    background: reportFormat === 'pdf' ? 'rgba(0,212,255,0.1)' : 'transparent',
                    color: reportFormat === 'pdf' ? BLUE : 'var(--text-primary)',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px'
                  }}
                >
                  📄 PDF Document
                </button>
                <button
                  type="button"
                  onClick={() => setReportFormat('csv')}
                  style={{
                    padding: '12px', borderRadius: '8px', border: `1px solid ${reportFormat === 'csv' ? BLUE : 'var(--border)'}`,
                    background: reportFormat === 'csv' ? 'rgba(0,212,255,0.1)' : 'transparent',
                    color: reportFormat === 'csv' ? BLUE : 'var(--text-primary)',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px'
                  }}
                >
                  📊 CSV Spreadsheet
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              onClick={() => setReportModalOpen(false)}
              variant="outlined"
              fullWidth
              disabled={reportLoading}
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDownloadReport(reportFormat)}
              variant="contained"
              fullWidth
              disabled={reportLoading}
              style={{ background: BLUE, color: 'white', fontWeight: 700 }}
            >
              {reportLoading ? 'Generating...' : 'Download'}
            </Button>
          </div>
        </Box>
      </Modal>

      {/* ─── RADAR CALIBRATION WIZARD MODAL ─── */}
      <Modal open={calibModalOpen} onClose={() => !calibLoading && setCalibModalOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '16px',
          p: 4, width: 480, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
        }}>
          {/* Wizard Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: BLUE, animation: calibLoading ? 'spin 2s linear infinite' : 'none' }} />
              <span>Radar Calibration Wizard</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Step {calibStep} of 5
            </div>
          </div>

          {calibError && <Alert severity="error" style={{ marginBottom: '14px', fontSize: '12px' }}>{calibError}</Alert>}

          {/* STEP 1: Select Radar Zone & Baseline */}
          {calibStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Select the specific radar zone to calibrate. This process establishes the baseline clear-chute distance reference.
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Target Radar Zone</div>
                <select
                  value={calibZone}
                  onChange={(e) => setCalibZone(Number(e.target.value))}
                  style={{
                    width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value={1} style={{ background: 'var(--card-bg)' }}>Zone 1 Radar (Upper Channel)</option>
                  <option value={2} style={{ background: 'var(--card-bg)' }}>Zone 2 Radar (Mid-Upper Channel)</option>
                  <option value={3} style={{ background: 'var(--card-bg)' }}>Zone 3 Radar (Mid-Lower Channel)</option>
                  <option value={4} style={{ background: 'var(--card-bg)' }}>Zone 4 Radar (Lower Channel)</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Calibration Mode</div>
                <select
                  value={calibMode}
                  onChange={(e) => setCalibMode(e.target.value as any)}
                  style={{
                    width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="Auto" style={{ background: 'var(--card-bg)' }}>Auto (PLC Auto-Triggered Scan)</option>
                  <option value="Manual" style={{ background: 'var(--card-bg)' }}>Manual (Physical Reference Input)</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Expected Clear Distance Baseline (m)</div>
                <input
                  type="number"
                  step="0.05"
                  value={calibBaseline}
                  onChange={(e) => setCalibBaseline(Number(e.target.value))}
                  style={{
                    width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button
                  onClick={() => setCalibStep(2)}
                  variant="contained"
                  style={{ background: BLUE, color: 'white', fontWeight: 700 }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Safety Verification */}
          {calibStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '11px', color: RED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                ⚠️ Mandatory Safety Verification
              </span>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                For personnel safety and radar accuracy, verify and check all pre-calibration safety protocols below:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(244,63,94,0.05)', border: `1px solid ${RED}20`, borderRadius: '8px', padding: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                  <input
                    type="checkbox"
                    checked={calibSafetyChecked1}
                    onChange={(e) => setCalibSafetyChecked1(e.target.checked)}
                    style={{ accentColor: RED }}
                  />
                  <span>Lock-out Tag-out (LOTO) active for chute entry</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                  <input
                    type="checkbox"
                    checked={calibSafetyChecked2}
                    onChange={(e) => setCalibSafetyChecked2(e.target.checked)}
                    style={{ accentColor: RED }}
                  />
                  <span>No personnel inside the chute channel</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px' }}>
                  <input
                    type="checkbox"
                    checked={calibSafetyChecked3}
                    onChange={(e) => setCalibSafetyChecked3(e.target.checked)}
                    style={{ accentColor: RED }}
                  />
                  <span>Solenoid valves and blast air system isolated</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <Button
                  onClick={() => setCalibStep(1)}
                  variant="outlined"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => setCalibStep(3)}
                  disabled={!calibSafetyChecked1 || !calibSafetyChecked2 || !calibSafetyChecked3}
                  variant="contained"
                  style={{
                    background: (!calibSafetyChecked1 || !calibSafetyChecked2 || !calibSafetyChecked3) ? 'var(--border)' : BLUE,
                    color: 'white', fontWeight: 700
                  }}
                >
                  Verify & Proceed
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Reference Scan Execution */}
          {calibStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
              {isScanning ? (
                <>
                  <CircularProgress style={{ color: BLUE, marginBottom: '12px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>Scanning Chute Reference Profile...</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Executing microwave radar frequency sweep on Zone {calibZone}...</div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '36px', marginBottom: '8px' }}>📡</span>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>Ready to Scan Chute Reference Profile</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Click the button below to trigger the physical radar scan. The radar will emit a high-frequency frequency sweep to measure the actual distance.
                  </div>
                  <Button
                    onClick={() => {
                      setIsScanning(true);
                      setTimeout(() => {
                        setIsScanning(false);
                        const drift = (Math.random() - 0.5) * 0.08;
                        setCalibMeasured(Math.round((calibBaseline + drift) * 100) / 100);
                        setCalibStep(4);
                      }, 1800);
                    }}
                    variant="contained"
                    style={{ background: BLUE, color: 'white', fontWeight: 700, marginTop: '12px' }}
                  >
                    Execute Radar Reference Scan
                  </Button>
                </>
              )}

              {!isScanning && (
                <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', marginTop: '16px' }}>
                  <Button
                    onClick={() => setCalibStep(2)}
                    variant="outlined"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
                  >
                    Back
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review and Verify Baseline */}
          {calibStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Review the scanned reference measurement. Compare the expected baseline with the actual measured value.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-panel, rgba(255,255,255,0.03))', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expected Baseline</div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{calibBaseline}m</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Measured Distance</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: BLUE }}>{calibMeasured}m</div>
                </div>
              </div>

              {/* Accuracy estimation */}
              {(() => {
                const acc = calibBaseline > 0
                  ? Math.max(0, 100 - Math.abs((calibMeasured - calibBaseline) / calibBaseline) * 100)
                  : 100;
                const passed = acc >= 85;
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    padding: '10px', borderRadius: '8px', background: passed ? 'rgba(52,211,153,0.05)' : 'rgba(244,63,94,0.05)',
                    border: `1px solid ${passed ? GREEN : RED}30`
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Calculated Accuracy Alignment</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: passed ? GREEN : RED }}>{Math.round(acc * 10) / 10}%</div>
                    <div style={{ fontSize: '10px', color: passed ? GREEN : RED, fontWeight: 700 }}>
                      {passed ? '✓ WITHIN TOLERANCE LIMITS' : '⚠️ OUT OF TOLERANCE LIMITS (&lt; 85%)'}
                    </div>
                  </div>
                );
              })()}

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Notes / Observer Log</div>
                <textarea
                  value={calibNotes}
                  onChange={(e) => setCalibNotes(e.target.value)}
                  placeholder="e.g. Cleared minor material crusting before scan. Radar diagnostic check passes."
                  rows={2}
                  style={{
                    width: '100%', background: 'var(--bg-panel, rgba(255,255,255,0.05))', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', borderRadius: '6px', padding: '10px', fontSize: '13px', outline: 'none',
                    fontFamily: 'var(--font-sans)', resize: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <Button
                  onClick={() => setCalibStep(3)}
                  variant="outlined"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontWeight: 700 }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSaveCalibration}
                  disabled={calibLoading}
                  variant="contained"
                  style={{ background: GREEN, color: 'white', fontWeight: 700 }}
                >
                  {calibLoading ? 'Saving...' : 'Commit Baseline'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Completion & Results */}
          {calibStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
              {calibResult?.passed ? (
                <>
                  <span style={{ fontSize: '42px' }}>✅</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: GREEN }}>Radar Calibrated Successfully!</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Zone {calibZone} radar baseline has been updated to <strong>{calibMeasured}m</strong> with <strong>{calibResult.accuracyPercent}% accuracy</strong>.
                    An immutable log has been recorded in the Plant Audit ledger.
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '42px' }}>⚠️</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: RED }}>Calibration Out of Tolerance!</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Scanned accuracy was <strong>{calibResult?.accuracyPercent}%</strong>, which is below the 85% operational threshold. 
                    Baseline was updated, but physical inspection of the radar face or internal build-up is highly recommended.
                  </div>
                </>
              )}

              <Button
                onClick={() => {
                  setCalibModalOpen(false);
                  setCalibSafetyChecked1(false);
                  setCalibSafetyChecked2(false);
                  setCalibSafetyChecked3(false);
                }}
                variant="contained"
                style={{ background: BLUE, color: 'white', fontWeight: 700, width: '120px', marginTop: '12px' }}
              >
                Done
              </Button>
            </div>
          )}
        </Box>
      </Modal>

      {/* ─── QR ONBOARDING MODAL ─── */}
      <Modal open={qrModalOpen} onClose={() => setQrModalOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
          p: 4, width: 440, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>⚙️ Chute Hardware Onboarding</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Link a physical edge gateway hub to <strong>{activeChute?.name || 'this chute'}</strong>
          </div>

          {qrLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
              <CircularProgress size={40} style={{ color: BLUE, marginBottom: '12px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generating secure onboarding token...</div>
            </div>
          )}

          {qrClaimResult && (
            <Alert severity={qrClaimResult.ok ? 'success' : 'error'} style={{ marginBottom: '16px', fontSize: '12px' }}>
              {qrClaimResult.msg}
            </Alert>
          )}

          {!qrLoading && qrData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <canvas ref={qrCanvasRef} style={{ display: 'block', margin: '0 auto 16px', background: '#ffffff', padding: '8px', borderRadius: '8px' }} />
              
              <div style={{ width: '100%', fontSize: '11.5px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chute Code:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{qrData.chuteCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Plant Code:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{qrData.plantCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
                  <span style={{ color: qrData.linkedDeviceId ? GREEN : AMBER, fontWeight: 800 }}>
                    {qrData.linkedDeviceId ? `Linked to ${qrData.linkedDeviceId}` : 'Awaiting Hub Scan'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleClaimDevice} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>Manual Device ID Association</div>
                  <TextField
                    fullWidth
                    size="small"
                    value={qrDeviceId}
                    onChange={(e) => setQrDeviceId(e.target.value)}
                    placeholder="e.g. HUB-MAC-01:23:45"
                    required
                    slotProps={{ input: { style: { color: 'var(--text-primary)', fontSize: '13px' } } }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={qrClaimLoading}
                  variant="contained"
                  style={{ background: BLUE, color: 'white', fontWeight: 700, textTransform: 'none' }}
                >
                  {qrClaimLoading ? 'Linking...' : 'Link Device ID'}
                </Button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <Button
              onClick={() => setQrModalOpen(false)}
              variant="outlined"
              size="small"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}
            >
              Close
            </Button>
          </div>
        </Box>
      </Modal>

      {/* ─── DATABASE RESET DIALOG ─── */}
      <Modal open={dbResetDialogOpen} onClose={() => setDbResetDialogOpen(false)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--card-bg)', border: `1px solid ${RED}30`, borderRadius: '12px',
          p: 4, width: 440, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: RED, marginBottom: '8px' }}>🚨 Wipe Operational Database</div>
          
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5', padding: '10px', background: `${RED}10`, border: `1px solid ${RED}20`, borderRadius: '6px' }}>
            <strong>WARNING:</strong> This will delete all historical telemetry, GPS history, alerts, AI predictions, notifications, and maintenance records.
            <br /><br />
            Structural data (plants, chutes, organizations, users) will be preserved, and fresh hardware baselines will be generated. This action cannot be undone.
          </div>

          {dbResetResult && (
            <Alert severity={dbResetResult.ok ? 'success' : 'error'} style={{ marginBottom: '14px', fontSize: '12px' }}>
              {dbResetResult.msg}
            </Alert>
          )}

          {dbResetLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
              <CircularProgress size={36} style={{ color: RED, marginBottom: '10px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Executing database wipe &amp; re-seeding...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                  Type <span style={{ color: RED, fontWeight: 800 }}>RESET</span> to confirm:
                </div>
                <TextField
                  fullWidth
                  size="small"
                  value={dbResetPhrase}
                  onChange={(e) => setDbResetPhrase(e.target.value)}
                  placeholder="RESET"
                  required
                  slotProps={{ input: { style: { color: 'var(--text-primary)', fontWeight: 700 } } }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <Button
                  onClick={() => setDbResetDialogOpen(false)}
                  variant="outlined"
                  fullWidth
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDbReset}
                  disabled={dbResetPhrase !== 'RESET' || dbResetLoading}
                  variant="contained"
                  fullWidth
                  style={{
                    background: dbResetPhrase === 'RESET' ? `linear-gradient(135deg, ${RED} 0%, #b91c1c 100%)` : 'var(--border)',
                    color: 'white',
                    fontWeight: 700
                  }}
                >
                  Wipe Database
                </Button>
              </div>
            </div>
          )}
        </Box>
      </Modal>

      {/* Session timeout warning modal removed for unlimited persistent session support */}

      {/* ─── DRILL-DOWN MODAL / DETAIL DRAWER ─── */}
      <Drawer
        anchor="right"
        open={expandedTile !== null}
        onClose={() => setExpandedTile(null)}
        slotProps={{
          paper: {
            style: {
              width: window.innerWidth < 600 ? '100%' : '550px',
              background: 'var(--card-bg)',
              borderLeft: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '24px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 40px rgba(0,0,0,0.5)'
            }
          }
        }}
      >
        {expandedTile ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: BLUE, textTransform: 'uppercase', letterSpacing: '1px' }}>DRILL-DOWN MATRIX</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0', textTransform: 'capitalize' }}>{expandedTile} Overview</h2>
              </div>
              <button
                onClick={() => setExpandedTile(null)}
                style={{
                  background: 'var(--border-light)', border: 'none', color: 'var(--text-secondary)',
                  borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {expandedTile === 'hero' && (
                <>
                  <div className="glass-panel" style={{ height: '320px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                    <React.Suspense fallback={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <CircularProgress color="inherit" size={30} />
                      </div>
                    }>
                      <ChuteDigitalTwin theme={theme} rotationX={twinRotationX} />
                    </React.Suspense>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Telemetry Zones Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      {radars.map((r, i) => (
                        <div key={i} className="glass-card" style={{ padding: '12px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>ZONE {i + 1} SENSOR</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{r.distance.toFixed(2)}m</span>
                            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: r.buildupDetected ? 'rgba(244,63,94,0.1)' : 'rgba(52,211,153,0.1)', color: r.buildupDetected ? RED : GREEN, fontWeight: 800 }}>
                              {r.buildupDetected ? 'BUILDUP' : 'CLEAR'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {expandedTile === 'health' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    {renderRadialGauge(chuteHealthScore, healthColor)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Health Matrix Breakdowns</h3>
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { name: 'Uptime Index (24h)', val: `${chuteKpis?.uptimePercent24h ?? 100}%`, status: GREEN },
                        { name: 'Air Blaster Health', val: `${Math.round(avgBlasterHealth)}%`, status: avgBlasterHealth > 70 ? GREEN : AMBER },
                        { name: 'Blast Effectiveness', val: `${blastEffScore}/100`, status: blastEffScore > 75 ? GREEN : AMBER },
                        { name: 'Compressor Health', val: `${compHealth}%`, status: compHealth > 80 ? GREEN : RED },
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                          <span style={{ fontWeight: 800, color: item.status }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {expandedTile === 'throughput' && (
                <>
                  <div style={{ padding: '10px 0' }}>
                    <TelemetryChart isDark={isDark} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Throughput Performance Details</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Real-time flow sensors monitor bulk material velocity and volume cross-sections to generate continuous throughput calculations.
                    </p>
                  </div>
                </>
              )}

              {expandedTile === 'ai' && (
                <React.Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <CircularProgress color="inherit" size={30} />
                  </div>
                }>
                  <PredictivePanel activeChuteId={activeChuteId} />
                </React.Suspense>
              )}

              {expandedTile === 'wear' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Chute Liner Wear (Est)</h3>
                      <div className="progress-track" style={{ height: '8px', marginBottom: '6px' }}>
                        <div className="progress-fill" style={{ width: `${wearIndex}%`, background: wearIndex < 50 ? RED : GREEN }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>Remaining Liner Life:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{wearIndex.toFixed(2)}%</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Solenoids Health Register</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {solenoids?.map((s, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                            <span>Solenoid Valve SV{s.valveNumber}</span>
                            <span style={{ fontWeight: 700, color: s.healthScore > 80 ? GREEN : AMBER }}>{s.healthScore}% health</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {expandedTile === 'environment' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>TEMPERATURE</span>
                      <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{liveTemperature.toFixed(1)}°C</div>
                    </div>
                    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>RELATIVE HUMIDITY</span>
                      <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{liveHumidity.toFixed(0)}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Telemetry Logs</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Sensors calibrate atmospheric humidity and temperature inside the chute housing to predict material adhesion factors (limestone, coal).
                    </p>
                  </div>
                </>
              )}

              {expandedTile === 'timeline' && (
                <>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Full Chronological Events Logs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {timelineEvents.map((ev) => (
                      <div key={ev.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: ev.color }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 800, color: ev.color, textTransform: 'uppercase' }}>{ev.type}</span>
                            <span>{ev.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{ev.label}</div>
                        </div>
                        {ev.type === 'alert' && roleAccess.isManager && (
                          <button
                            onClick={() => handleResolveAlert(ev.id)}
                            style={{
                              padding: '4px 8px', fontSize: '10px', background: 'rgba(52,211,153,0.1)',
                              border: `1px solid ${GREEN}30`, color: GREEN, borderRadius: '4px', cursor: 'pointer'
                            }}
                          >
                            RESOLVE
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <Button fullWidth variant="outlined" onClick={() => setExpandedTile(null)} style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                Close Overview
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* ─── MOBILE BOTTOM NAVIGATION BAR ─── */}
      <div className="mobile-bottom-nav glass-panel" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px',
        display: 'none',
        justifyContent: 'space-around', alignItems: 'center',
        zIndex: 100, borderTop: `1px solid var(--border)`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
      }}>
        <button
          onClick={() => { setActiveTab('dashboard'); setExpandedTile(null); }}
          style={{
            background: 'none', border: 'none', color: activeTab === 'dashboard' ? BLUE : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
          }}
        >
          <Home size={18} />
          <span style={{ fontSize: '9px', fontWeight: activeTab === 'dashboard' ? 700 : 500 }}>Home</span>
        </button>

        <button
          onClick={() => { setActiveTab('dashboard'); setExpandedTile('timeline'); }}
          style={{
            background: 'none', border: 'none', color: expandedTile === 'timeline' ? RED : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
          }}
        >
          <Bell size={18} />
          <span style={{ fontSize: '9px', fontWeight: expandedTile === 'timeline' ? 700 : 500 }}>Alerts</span>
        </button>

        <button
          onClick={() => { setActiveTab('audit'); setExpandedTile(null); }}
          style={{
            background: 'none', border: 'none', color: activeTab === 'audit' ? BLUE : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
          }}
        >
          <FileText size={18} />
          <span style={{ fontSize: '9px', fontWeight: activeTab === 'audit' ? 700 : 500 }}>Reports</span>
        </button>

        <button
          onClick={() => { setActiveTab('profile'); setExpandedTile(null); }}
          style={{
            background: 'none', border: 'none', color: activeTab === 'profile' ? BLUE : 'var(--text-secondary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', outline: 'none'
          }}
        >
          <Settings size={18} />
          <span style={{ fontSize: '9px', fontWeight: activeTab === 'profile' ? 700 : 500 }}>Settings</span>
        </button>
      </div>

      {/* ─── AI COPILOT FLOATING PANEL ─── */}
      <AICopilot activeChuteId={activeChuteId} />
    </div>
  );
};
export default Dashboard;
