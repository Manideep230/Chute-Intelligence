import React, { useState } from 'react';
import { getThemeColors } from '../constants';
import { useTelemetryStore } from '../../../store/telemetryStore';

interface MaintenanceTabProps {
  maintenanceTickets: any[];
  loading: boolean;
  roleAccess: any;
  token: string | null;
  activeChuteId: string | null;
  loadMaintenanceTickets: () => Promise<void>;
  theme: 'dark' | 'light';
}

export const MaintenanceTab: React.FC<MaintenanceTabProps> = React.memo(({
  maintenanceTickets,
  loading,
  roleAccess,
  token,
  activeChuteId,
  loadMaintenanceTickets,
  theme,
}) => {
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState('AirBlaster');

  const { blasters, compressor, setChuteData } = useTelemetryStore();

  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const AMBER = colors.AMBER;
  const BLUE = colors.BLUE;

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

  return (
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
          {loading ? (
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
          ) : maintenanceTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>No maintenance tickets</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>All systems operational — no open work orders</div>
            </div>
          ) : null}
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
  );
});
