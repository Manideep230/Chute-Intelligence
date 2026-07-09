import React, { useState, useMemo } from 'react';
import { Shield } from 'lucide-react';

interface FleetOperationsTabProps {
  plantsList: any[];
  chutes: any[];
}

export const FleetOperationsTab: React.FC<FleetOperationsTabProps> = React.memo(({ plantsList, chutes }) => {
  // Filters state
  const [plantFilter, setPlantFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredChutes = useMemo(() => {
    return chutes.filter(c => {
      if (plantFilter !== 'all' && c.plantId !== plantFilter) return false;
      if (materialFilter !== 'all' && c.materialType !== materialFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [chutes, plantFilter, materialFilter, statusFilter]);

  // Aggregate metrics
  const totalChutes = filteredChutes.length;
  const activeBlockages = filteredChutes.filter(c => c.status === 'Blockage' || c.status === 'Warning').length;
  const activeBlasts = filteredChutes.filter(c => c.status === 'Blasting').length;
  const offlineDevices = filteredChutes.filter(c => c.deviceStatus === 'Offline' || c.status === 'Offline').length;

  const fleetHealthScore = useMemo(() => {
    if (filteredChutes.length === 0) return 100;
    const total = filteredChutes.reduce((sum, c) => {
      let score = 100;
      if (c.status === 'Blockage') score -= 40;
      if (c.status === 'Warning') score -= 20;
      if (c.status === 'Offline') score -= 30;
      return sum + score;
    }, 0);
    return Math.round(total / filteredChutes.length);
  }, [filteredChutes]);

  const uniqueMaterials = useMemo(() => {
    return Array.from(new Set(chutes.map(c => c.materialType).filter(Boolean)));
  }, [chutes]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🏢 Fleet Operations Center</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Real-time overview, multi-chute orchestration, and global fleet status.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>Fleet Health Score</span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: fleetHealthScore > 80 ? 'var(--accent-green)' : fleetHealthScore > 50 ? 'var(--accent-amber)' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
              {fleetHealthScore}%
            </span>
          </div>
          <Shield size={24} style={{ color: fleetHealthScore > 80 ? 'var(--accent-green)' : fleetHealthScore > 50 ? 'var(--accent-amber)' : 'var(--accent-red)' }} />
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Plant</label>
          <select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
            <option value="all">All Plants</option>
            {plantsList.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Material</label>
          <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
            <option value="all">All Materials</option>
            {uniqueMaterials.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Chute Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
            <option value="all">All Statuses</option>
            <option value="Normal">Normal</option>
            <option value="Warning">Warning</option>
            <option value="Blockage">Blockage</option>
            <option value="Blasting">Blasting</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Chutes</span>
          <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalChutes}</span>
        </div>

        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Blockages</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: activeBlockages > 0 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{activeBlockages}</span>
        </div>

        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Blasts</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: activeBlasts > 0 ? 'var(--accent-blue)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{activeBlasts}</span>
        </div>

        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Offline Gateways</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: offlineDevices > 0 ? 'var(--accent-amber)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{offlineDevices}</span>
        </div>
      </div>

      {/* PLANT OPERATIONS OVERVIEW */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>🏭 Plant Summary</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {plantsList.map(plant => {
          const plantChutes = chutes.filter(c => c.plantId === plant._id);
          const blockCount = plantChutes.filter(c => c.status === 'Blockage').length;
          const warnCount = plantChutes.filter(c => c.status === 'Warning').length;

          return (
            <div key={plant._id} style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{plant.name}</span>
                <span style={{ fontSize: '11px', background: 'var(--border-light)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                  {plant.regionName || 'Industrial Zone'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Chutes:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{plantChutes.length}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Blockages:</span> <strong style={{ color: blockCount > 0 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{blockCount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Warnings:</span> <strong style={{ color: warnCount > 0 ? 'var(--accent-amber)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{warnCount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Online Hubs:</span> <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{plantChutes.filter(c => c.status !== 'Offline').length}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHUTES LIST */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>📋 Fleet Chute Status Indicators</h3>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Chute Name</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Material</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Operational Status</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Blockage Prob.</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Trend</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Compressor Psi</th>
            </tr>
          </thead>
          <tbody>
            {filteredChutes.map(chute => (
              <tr key={chute._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>{chute.name}</td>
                <td style={{ padding: '12px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{chute.materialType}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '10px',
                    background: chute.status === 'Normal' ? 'rgba(16, 185, 129, 0.1)' : chute.status === 'Warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: chute.status === 'Normal' ? 'var(--accent-green)' : chute.status === 'Warning' ? 'var(--accent-amber)' : 'var(--accent-red)'
                  }}>
                    {chute.status}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                  {chute.blockageProbability ?? 0}%
                </td>
                <td style={{ padding: '12px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  {chute.overallTrend ?? 'stable'}
                </td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                  {chute.compressorPressure ?? 105} PSI
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
