import React, { useState, useEffect, useCallback } from 'react';
import { CircularProgress, Alert } from '@mui/material';
import { ArrowUpRight, ArrowDownLeft, Radio, RefreshCw } from 'lucide-react';
import { useTelemetryStore } from '../../../store/telemetryStore';

interface MqttMonitorTabProps {
  token: string;
}

export const MqttMonitorTab: React.FC<MqttMonitorTabProps> = React.memo(({ token }) => {
  const isMqttConnected = useTelemetryStore((s) => s.isMqttConnected);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMqttStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/_/backend/industry/mqtt/monitoring-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve MQTT traffic stats');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching MQTT monitor metrics.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMqttStats();
    const interval = setInterval(fetchMqttStats, 10000);
    return () => clearInterval(interval);
  }, [fetchMqttStats]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>📡 Live MQTT Traffic Monitor</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>EMQX broker link state, topic publish/subscribe ratios, latency checks, and gateway heartbeats.</p>
        </div>
        <button onClick={fetchMqttStats} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={12} /> Refresh Stats
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <CircularProgress style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* STATS OVERVIEW CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Broker Connection</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: (isMqttConnected || stats?.connected) ? 'var(--accent-green)' : 'var(--accent-red)',
                  display: 'inline-block'
                }} />
                <span style={{ fontSize: '18px', fontWeight: 700 }}>
                  {(isMqttConnected || stats?.connected) ? 'Connected (WSS Live)' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Broker Latency</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {stats.latency} ms
              </span>
            </div>

            <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Publish Rate</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {stats.publishRate} msg/min
              </span>
            </div>

            <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subscribe Rate</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {stats.subscribeRate} msg/min
              </span>
            </div>

          </div>

          {/* MESSAGE COUNTS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpRight size={16} style={{ color: 'var(--accent-primary)' }} /> Outbound Publishing
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Published:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{stats.publishCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Failed Publishes:</span>
                  <strong style={{ color: stats.failedPublishCount > 0 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{stats.failedPublishCount}</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowDownLeft size={16} style={{ color: 'var(--accent-green)' }} /> Inbound Subscribes
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Received:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{stats.messageReceivedCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Reconnect Attempts:</span>
                  <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{stats.reconnectCount}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* MQTT CLIENT CONFIG / INFO */}
          <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} /> Connection Specifications
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Broker Host: <strong style={{ color: 'var(--text-primary)' }}>EMQX Cloud Cluster</strong></div>
              <div>Port: <strong style={{ color: 'var(--text-primary)' }}>8883 (MQTTS)</strong></div>
              <div>QoS Level: <strong style={{ color: 'var(--text-primary)' }}>1 (At least once)</strong></div>
              <div>Last Activity: <strong style={{ color: 'var(--text-primary)' }}>{stats.lastMessageTime ? new Date(stats.lastMessageTime).toLocaleTimeString() : 'Waiting for messages...'}</strong></div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
});
