import React, { useState } from 'react';
import { getThemeColors } from '../constants';
import { QrChuteRegisterModal } from './modals/QrChuteRegisterModal';

interface RegistryTabProps {
  plantsList: any[];
  chutes: any[];
  allUsers: any[];
  assignments: any[];
  roleAccess: any;
  token: string | null;
  theme: 'dark' | 'light';
  setChutes: React.Dispatch<React.SetStateAction<any[]>>;
  setPlantsList: React.Dispatch<React.SetStateAction<any[]>>;
  loadAssignments: () => Promise<void>;
}

export const RegistryTab: React.FC<RegistryTabProps> = ({
  plantsList,
  chutes,
  allUsers,
  assignments,
  roleAccess,
  token,
  theme,
  setChutes,
  setPlantsList,
  loadAssignments,
}) => {
  const [registrySubTab, setRegistrySubTab] = useState<'plants' | 'chutes' | 'assignments'>('plants');

  // Plant creation form state
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

  // Chute creation form state
  const [regName, setRegName] = useState('');
  const [regPlantId, setRegPlantId] = useState(plantsList[0]?._id || '');
  const [regLat, setRegLat] = useState('');
  const [regLng, setRegLng] = useState('');
  const [regMaterial, setRegMaterial] = useState('generic');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // Assignment form state
  const [assignUserId, setAssignUserId] = useState(allUsers[0]?._id || '');
  const [assignAssetType, setAssignAssetType] = useState<'Plant' | 'Chute'>('Chute');
  const [assignPlantId, setAssignPlantId] = useState(plantsList[0]?._id || '');
  const [assignChuteId, setAssignChuteId] = useState(chutes[0]?._id || '');
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Plant Edit state
  const [editPlantModalOpen, setEditPlantModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<any>(null);
  const [editPlantFields, setEditPlantFields] = useState<any>({});
  const [editPlantLoading, setEditPlantLoading] = useState(false);
  const [editPlantError, setEditPlantError] = useState<string | null>(null);

  // Chute Edit state
  const [editChuteModalOpen, setEditChuteModalOpen] = useState(false);
  const [editingChute, setEditingChute] = useState<any>(null);
  const [editChuteFields, setEditChuteFields] = useState<any>({});
  const [editChuteLoading, setEditChuteLoading] = useState(false);
  const [editChuteError, setEditChuteError] = useState<string | null>(null);
  const [qrRegisterModalOpen, setQrRegisterModalOpen] = useState(false);

  const colors = getThemeColors(theme);
  const GREEN = colors.GREEN;
  const RED = colors.RED;
  const BLUE = colors.BLUE;

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
      
      const plRes = await fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } });
      const plData = await plRes.json();
      if (plRes.ok) setPlantsList(plData);
    } catch (err: any) {
      setPlantRegError(err.message);
    } finally {
      setPlantRegLoading(false);
    }
  };

  const reloadChutesList = async () => {
    try {
      const chutesRes = await fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } });
      const chutesData = await chutesRes.json();
      if (chutesRes.ok) {
        const mapped = chutesData.map((c: any) => {
          const p = plantsList.find((pl: any) => pl._id === c.plantId || pl._id === c.plantId?.toString());
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);
      }
    } catch (err) {
      console.error('Failed to reload chutes list:', err);
    }
  };

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
      await reloadChutesList();
    } catch (err: any) {
      setRegError(err.message);
    }
  };

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

  const handleOpenEditChute = (chute: any) => {
    setEditingChute(chute);
    setEditChuteFields({
      name: chute.name || '',
      materialType: chute.materialType || 'generic',
    });
    setEditChuteError(null);
    setEditChuteModalOpen(true);
  };

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

  return (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Register New Chute</div>
                  <button
                    type="button"
                    onClick={() => setQrRegisterModalOpen(true)}
                    style={{
                      padding: '4px 8px', fontSize: '10px', fontWeight: 700,
                      borderRadius: '4px', border: `1px solid ${BLUE}40`,
                      background: `${BLUE}15`, color: BLUE, cursor: 'pointer'
                    }}
                  >
                    📷 Register via QR
                  </button>
                </div>
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

      <QrChuteRegisterModal
        open={qrRegisterModalOpen}
        onClose={() => setQrRegisterModalOpen(false)}
        plantsList={plantsList}
        token={token}
        theme={theme}
        onChuteRegistered={reloadChutesList}
      />
    </div>
  );
};
