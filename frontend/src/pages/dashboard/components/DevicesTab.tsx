import React, { useState, useEffect, useCallback } from 'react';
import { CircularProgress, Alert } from '@mui/material';
import { Cpu, Wifi, Wrench, BarChart2, ShieldAlert } from 'lucide-react';

interface DevicesTabProps {
  activeChuteId: string;
  token: string;
}

export const DevicesTab: React.FC<DevicesTabProps> = React.memo(({ activeChuteId, token }) => {
  const [deviceType, setDeviceType] = useState<'hubs' | 'radars' | 'sabs' | 'solenoids' | 'compressors'>('hubs');
  const [inventory, setInventory] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInventoryAndPredictions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, predRes] = await Promise.all([
        fetch('/_/backend/hardware/inventory', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/_/backend/hardware/predictive-maintenance/${activeChuteId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!invRes.ok || !predRes.ok) {
        throw new Error('Failed to retrieve device data');
      }

      const invData = await invRes.json();
      const predData = await predRes.json();

      setInventory(invData);
      setPredictions(predData);
    } catch (err: any) {
      setError(err.message || 'Error fetching device metrics.');
    } finally {
      setLoading(false);
    }
  }, [activeChuteId, token]);

  useEffect(() => {
    fetchInventoryAndPredictions();
  }, [fetchInventoryAndPredictions]);

  const activeList = inventory ? inventory[deviceType] : [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>⚙️ Enterprise Device Management</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Inventory, firmware lifecycle, serial mappings, and predictive health diagnostics.</p>
        </div>
        <button onClick={fetchInventoryAndPredictions} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          Refresh Inventory
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
          <CircularProgress style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Retrieving device telemetry...</span>
        </div>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DEVICE TYPE SELECTOR */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            {[
              { id: 'hubs', label: 'Edge Hubs', icon: <Cpu size={14} /> },
              { id: 'radars', label: 'Radars', icon: <Wifi size={14} /> },
              { id: 'sabs', label: 'Air Blasters (SAB)', icon: <Wrench size={14} /> },
              { id: 'solenoids', label: 'Solenoid Valves', icon: <Wrench size={14} /> },
              { id: 'compressors', label: 'Compressors', icon: <BarChart2 size={14} /> },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setDeviceType(type.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  background: deviceType === type.id ? 'var(--border-light)' : 'transparent',
                  color: deviceType === type.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: deviceType === type.id ? 700 : 500,
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>

          {/* INVENTORY LIST */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Serial Number</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>MAC Address</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Firmware</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>HW Version</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Health</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No devices of this type configured</td>
                  </tr>
                ) : (
                  activeList.map((dev: any) => (
                    <tr key={dev._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{dev.serialNumber || `SN-${dev._id.slice(-6).toUpperCase()}`}</td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{dev.macAddress || 'N/A'}</td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>v{dev.firmware || '1.0.0'}</td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>{dev.hardwareVersion || '1.0'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', height: '6px', width: '60px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              background: dev.healthScore > 80 ? 'var(--accent-green)' : dev.healthScore > 50 ? 'var(--accent-amber)' : 'var(--accent-red)',
                              width: `${dev.healthScore || 90}%`,
                              height: '100%'
                            }} />
                          </div>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{dev.healthScore || 90}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: dev.onlineStatus === 'Online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: dev.onlineStatus === 'Online' ? 'var(--accent-green)' : 'var(--accent-red)'
                        }}>
                          {dev.onlineStatus || 'Online'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PREDICTIVE MAINTENANCE PANELS */}
          <div style={{ marginTop: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent-amber)' }} />
              Predictive Diagnostics & Remaining Useful Life (RUL)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {predictions.map((pred, i) => (
                <div key={i} style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{pred.name}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: pred.failureProbability > 70 ? 'rgba(239, 68, 68, 0.1)' : pred.failureProbability > 30 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: pred.failureProbability > 70 ? 'var(--accent-red)' : pred.failureProbability > 30 ? 'var(--accent-amber)' : 'var(--accent-green)'
                    }}>
                      Risk: {pred.failureProbability}%
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>RUL:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{pred.rulDays} Days remaining</strong>
                    </div>
                    
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{
                        background: pred.rulDays > 180 ? 'var(--accent-green)' : pred.rulDays > 60 ? 'var(--accent-amber)' : 'var(--accent-red)',
                        width: `${Math.min(100, (pred.rulDays / 365) * 100)}%`,
                        height: '100%'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px' }}>
                      <span>Next Maintenance:</span>
                      <span>{new Date(pred.maintenanceDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
});
