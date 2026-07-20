import React, { useState, useCallback } from 'react';
import * as THREE from 'three';
import { useTelemetryStore } from '../../store/telemetryStore';
import type { DevBlockage } from '../../store/telemetryStore';
import { useAuthStore } from '../../store/authStore';
import { useDigitalTwinState } from './useDigitalTwinState';

const SLANT_PATHS = {
  LEFT_SLANT:  [[0.937, 2.184, 0],  [1.085, 0.953, 0],  [0, 0, 0], [-1.085, -0.953, 0], [-0.937, -2.184, 0]] as [number,number,number][],
  RIGHT_SLANT: [[-0.937, 2.184, 0], [-1.085, 0.953, 0], [0, 0, 0], [1.085, -0.953, 0],  [0.937, -2.184, 0]] as [number,number,number][],
};

const BLASTER_WORLD_POSITIONS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(-1.65, 1.4, 0.1),
  2: new THREE.Vector3(1.65, 1.4, 0.1),
  3: new THREE.Vector3(-1.41, -0.6, 0.1),
  4: new THREE.Vector3(1.41, -0.6, 0.1),
};

function interpolatePath(pts: [number,number,number][], t: number): THREE.Vector3 {
  const n = pts.length - 1;
  const segment = Math.min(Math.floor(t * n), n - 1);
  const segT = (t * n) - segment;
  const a = pts[segment], b = pts[segment + 1];
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * segT,
    a[1] + (b[1] - a[1]) * segT,
    a[2] + (b[2] - a[2]) * segT
  );
}

const TwinControlPanelComponent: React.FC<{ theme?: 'dark' | 'light' }> = ({ theme = 'dark' }) => {
  const activeChuteId = useTelemetryStore((s) => s.activeChuteId);
  const viewMode = useTelemetryStore((s) => s.viewMode);
  const setViewMode = useTelemetryStore((s) => s.setViewMode);
  const cameraPreset = useTelemetryStore((s) => s.cameraPreset);
  const setCameraPreset = useTelemetryStore((s) => s.setCameraPreset);
  const activePath = useTelemetryStore((s) => s.activePath);
  const simulationMode = useTelemetryStore((s) => s.simulationMode);
  const blasters = useTelemetryStore((s) => s.blasters);
  const devBlockages = useTelemetryStore((s) => s.devBlockages);
  const setSimulationModeState = useTelemetryStore((s) => s.setSimulationModeState);
  const setActivePath = useTelemetryStore((s) => s.setActivePath);
  const applyLocalization = useTelemetryStore((s) => s.applyLocalization);
  const addDevBlockage = useTelemetryStore((s) => s.addDevBlockage);
  const updateStatus = useTelemetryStore((s) => s.updateStatus);
  const setDemoKpis = useTelemetryStore((s) => s.setDemoKpis);
  const clearDevBlockages = useTelemetryStore((s) => s.clearDevBlockages);
  const updateDevBlockage = useTelemetryStore((s) => s.updateDevBlockage);
  const nearestSolenoidGroup = useTelemetryStore((s) => s.nearestSolenoidGroup);

  const { token } = useAuthStore();
  const [flowActive, setFlowActive] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const selectedBlockageId: string | null = devBlockages.find(b => !b.cleared)?.id || null;
  const isDark = theme === 'dark';

  const {
    devBlocking, enableBlockingMode, disableBlockingMode, setSeverity,
    solenoidSelection, deselectSolenoid,
    blast, fireBlast,
    demo, startDemo, stopDemo,
    BLAST_RADII,
  } = useDigitalTwinState();

  const overlayBorder = isDark ? '#1e293b' : '#cbd5e1';
  const overlayText   = isDark ? '#f8fafc' : '#0f172a';
  const overlayMuted  = isDark ? '#64748b' : '#64748b';
  const btnActive     = '#0284c7';
  const btnBg         = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(241, 245, 249, 0.9)';

  const currentActivePath = activePath || 'LEFT_SLANT';
  const valveA = solenoidSelection.blasterNumber ? solenoidSelection.blasterNumber * 2 - 1 : 1;
  const valveB = solenoidSelection.blasterNumber ? solenoidSelection.blasterNumber * 2 : 2;

  const handleToggleSimulationMode = async (mode: boolean) => {
    if (!activeChuteId) return;
    setSimulationModeState(mode);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ enabled: mode }),
      });
      const data = await res.json();
      if (res.ok && data.chute) {
        applyLocalization({
          activePath: data.chute.activePath || currentActivePath,
          simulationMode: mode,
          blockagePosition: data.chute.blockagePosition || 'None',
          blockageDistance: data.chute.blockageDistance ?? 3.5,
          nearestSolenoidGroup: data.chute.nearestSolenoidGroup ?? 1,
          status: data.chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleConfirmBlast = useCallback(() => {
    if (!solenoidSelection.blasterNumber || !solenoidSelection.solenoidPosition) return;
    const solenoidPos = solenoidSelection.solenoidPosition;
    const path = SLANT_PATHS[currentActivePath];
    const activeBlocks = devBlockages.filter(b => !b.cleared && !b.fragmenting);
    let hitId: string | null = null;
    let partialId: string | null = null;

    for (const blk of activeBlocks) {
      const blockPos = interpolatePath(path, blk.normalizedT);
      blockPos.y += 0.5;
      const dist = solenoidPos.distanceTo(blockPos);
      const effectiveRadius = BLAST_RADII[blk.severity];
      if (dist <= effectiveRadius) {
        hitId = blk.id;
      } else if (dist <= effectiveRadius * 2.0) {
        partialId = blk.id;
      }
    }

    fireBlast(solenoidSelection.blasterNumber, solenoidPos, !!hitId, !!partialId, () => {
      if (hitId) {
        updateDevBlockage(hitId, { fragmenting: true });
        setTimeout(() => {
          updateDevBlockage(hitId!, { cleared: true, fragmenting: false });
          if (devBlockages.filter(b => b.id !== hitId && !b.cleared).length === 0) {
            updateStatus('Normal');
          }
          setDemoKpis({ blastSuccess: true, blockCleared: true, effectiveness: 88 + Math.round(Math.random() * 10) });
        }, 1400);
      }
      deselectSolenoid();
    });
  }, [solenoidSelection, devBlockages, currentActivePath, fireBlast, BLAST_RADII, updateDevBlockage, deselectSolenoid, updateStatus, setDemoKpis]);

  const handleStartDemo = useCallback(() => {
    clearDevBlockages();
    updateStatus('Normal');
    setDemoKpis(null);

    let demoBlockageId = '';
    startDemo({
      onBlockage: () => {
        const path = SLANT_PATHS[currentActivePath];
        const t = 0.45;
        const worldPt = interpolatePath(path, t);
        const blk: DevBlockage = {
          id: `demo_blk_${Date.now()}`,
          worldPosition: [worldPt.x, worldPt.y + 0.5, worldPt.z],
          normalizedT: t,
          severity: 'medium',
          cleared: false,
          fragmenting: false,
        };
        demoBlockageId = blk.id;
        addDevBlockage(blk);
        updateStatus('Blocked');
      },
      onBlast: () => {
        const blasterPos = BLASTER_WORLD_POSITIONS[nearestSolenoidGroup] ?? BLASTER_WORLD_POSITIONS[1];
        fireBlast(nearestSolenoidGroup, blasterPos, true, false, () => {
          if (demoBlockageId) {
            updateDevBlockage(demoBlockageId, { fragmenting: true });
            setTimeout(() => {
              updateDevBlockage(demoBlockageId, { cleared: true, fragmenting: false });
              updateStatus('Normal');
            }, 1400);
          }
        });
      },
      onClear: () => {},
      onComplete: () => {
        setDemoKpis({ blastSuccess: true, blockCleared: true, effectiveness: 94 });
      },
    });
  }, [clearDevBlockages, updateStatus, setDemoKpis, startDemo, currentActivePath, addDevBlockage, fireBlast, nearestSolenoidGroup, updateDevBlockage]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', color: overlayText, fontFamily: "'Inter', sans-serif", overflowY: 'auto' }}>
      {/* View Mode Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: overlayMuted }}>View Mode:</span>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as any)}
          style={{
            padding: '4px 10px', fontSize: '10.5px', fontWeight: 700, fontFamily: 'inherit',
            background: btnBg, color: overlayText, border: `1px solid ${overlayBorder}`,
            borderRadius: '6px', cursor: 'pointer', outline: 'none'
          }}
        >
          <option value="cutaway">Cutaway</option>
          <option value="operator">Operator (Solid)</option>
          <option value="transparent">Transparent</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Camera Angle Presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: overlayMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Camera View Angle</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(['front', 'left', 'right', 'top'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setCameraPreset(preset);
                setTimeout(() => setCameraPreset(null), 1500);
              }}
              style={{
                padding: '6px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                background: cameraPreset === preset ? btnActive : btnBg,
                color: cameraPreset === preset ? '#fff' : overlayText,
                border: `1px solid ${cameraPreset === preset ? btnActive : overlayBorder}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 100ms ease'
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Inspector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: overlayMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset Inspector</span>
        {solenoidSelection.blasterNumber !== null ? (
          <div style={{ padding: '10px', background: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#EA580C', fontWeight: 800 }}>SMART AIR BLASTER B{solenoidSelection.blasterNumber}</h4>
            <div style={{ fontSize: '10px', color: overlayText, lineHeight: '1.6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Asset ID:</div><div style={{ fontWeight: 'bold' }}>SAB-00{solenoidSelection.blasterNumber}</div>
              <div>Health Score:</div><div style={{ color: '#10b981', fontWeight: 'bold' }}>{blasters.find((b: any) => b.blasterNumber === solenoidSelection.blasterNumber)?.healthScore ?? 100}%</div>
              <div>Operating Valv:</div><div>SV{valveA}, SV{valveB}</div>
              <div>Blast Radius:</div><div>{solenoidSelection.blastRadius.toFixed(1)}m</div>
            </div>
            {!blast.active && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={handleConfirmBlast} style={{ flex: 1, padding: '6px 10px', background: '#EA580C', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🚀 TRIGGER BLAST
                </button>
                <button onClick={deselectSolenoid} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${overlayBorder}`, borderRadius: '4px', color: overlayMuted, fontSize: '10px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : selectedBlockageId ? (
          <div style={{ padding: '10px', background: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#EF4444', fontWeight: 800 }}>ACTIVE BLOCKAGE</h4>
            <div style={{ fontSize: '10px', color: overlayText, lineHeight: '1.6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Blockage ID:</div><div style={{ fontFamily: 'monospace' }}>{selectedBlockageId.slice(0, 8)}</div>
              <div>Severity Level:</div><div style={{ textTransform: 'uppercase', color: '#f59e0b', fontWeight: 'bold' }}>{devBlockages.find(b => b.id === selectedBlockageId)?.severity}</div>
              <div>Centerline Pos:</div><div>{devBlockages.find(b => b.id === selectedBlockageId)?.normalizedT.toFixed(2)} T</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px dashed ${overlayBorder}`, textAlign: 'center', fontSize: '9.5px', color: overlayMuted }}>
            Click on any Blaster or Blockage in the 3D scene to inspect details here.
          </div>
        )}
      </div>

      {/* Simulation Controls & Mode Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `1px solid ${overlayBorder}`, paddingTop: '12px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: overlayMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Simulation Utilities</span>
        
        <button
          onClick={() => handleToggleSimulationMode(!simulationMode)}
          style={{
            padding: '8px', fontSize: '11px', fontWeight: 800,
            background: simulationMode ? '#EA580C' : '#10B981',
            color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer'
          }}
        >
          {simulationMode ? '⚠ RETREAT TO PROD MODE' : '⚙ ENGAGE SIMULATION'}
        </button>

        {simulationMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: overlayMuted }}>Active Slant:</span>
              <button
                onClick={() => setActivePath(currentActivePath === 'LEFT_SLANT' ? 'RIGHT_SLANT' : 'LEFT_SLANT')}
                style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 700, background: btnBg, border: `1px solid ${overlayBorder}`, color: overlayText, borderRadius: '6px', cursor: 'pointer' }}
              >
                {currentActivePath === 'LEFT_SLANT' ? 'LEFT (\\)' : 'RIGHT (/)'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: overlayMuted }}>Material Feed:</span>
              <button
                onClick={() => setFlowActive(!flowActive)}
                style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 700, background: flowActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${flowActive ? '#10b981' : '#ef4444'}`, color: flowActive ? '#10b981' : '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
              >
                {flowActive ? '▶ FLOW RUNNING' : '⏸ FLOW PAUSED'}
              </button>
            </div>

            {/* Blockage Injector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
              <div style={{ fontSize: '9px', color: overlayMuted, fontWeight: 600 }}>INJECT BLOCKAGE PRESET</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['small', 'medium', 'large'] as const).map(sev => (
                  <button key={sev} onClick={() => setSeverity(sev)} style={{ flex: 1, padding: '4px', fontSize: '9px', fontWeight: 700, background: devBlocking.severity === sev ? '#EA580C' : 'transparent', color: devBlocking.severity === sev ? '#fff' : overlayMuted, border: `1px solid ${devBlocking.severity === sev ? '#EA580C' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase' }}>
                    {sev}
                  </button>
                ))}
              </div>
              <button onClick={() => devBlocking.pendingPlacement ? disableBlockingMode() : enableBlockingMode(devBlocking.severity)} style={{ width: '100%', padding: '6px', fontSize: '10px', fontWeight: 700, background: devBlocking.pendingPlacement ? '#ef4444' : btnBg, color: devBlocking.pendingPlacement ? '#fff' : overlayText, border: `1px solid ${devBlocking.pendingPlacement ? '#ef4444' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer', marginTop: '2px' }}>
                {devBlocking.pendingPlacement ? '✕ Cancel Injector' : '+ Click Slant to Inject'}
              </button>
            </div>
          </div>
        )}

        {/* Client Demo Trigger */}
        <button
          onClick={demo.running ? stopDemo : handleStartDemo}
          style={{ padding: '8px', fontSize: '11px', fontWeight: 800, background: demo.running ? '#ef4444' : 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}
        >
          {demo.running ? '⏹ TERMINATE DEMO' : '🎬 START SCADA DEMO'}
        </button>
      </div>

      {/* Debug mode toggle */}
      <div style={{ borderTop: `1px solid ${overlayBorder}`, paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <span style={{ fontSize: '10px', color: overlayMuted }}>Debug Mode:</span>
        <button onClick={() => setDebugMode(!debugMode)} style={{ padding: '4px 10px', fontSize: '9px', fontWeight: 700, background: debugMode ? '#0284c7' : 'transparent', color: debugMode ? '#fff' : overlayMuted, border: `1px solid ${debugMode ? '#0284c7' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer' }}>
          {debugMode ? 'ACTIVE' : 'INACTIVE'}
        </button>
      </div>
    </div>
  );
};

export const TwinControlPanel = React.memo(TwinControlPanelComponent);
