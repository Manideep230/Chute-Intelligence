import React, { useState } from 'react';
import { Modal, Box, Alert, CircularProgress, Button, TextField } from '@mui/material';
import { getThemeColors } from '../../constants';

interface QrChuteRegisterModalProps {
  open: boolean;
  onClose: () => void;
  plantsList: any[];
  token: string | null;
  theme: 'dark' | 'light';
  onChuteRegistered: (newChute: any) => void;
}

export const QrChuteRegisterModal: React.FC<QrChuteRegisterModalProps> = ({
  open,
  onClose,
  plantsList,
  token,
  theme,
  onChuteRegistered,
}) => {
  const [scanMode, setScanMode] = useState<'preset' | 'upload' | 'manual'>('preset');
  
  // Scanned payload data
  const [parsedData, setParsedData] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form states mapping from parsed QR payload
  const [regName, setRegName] = useState('');
  const [regPlantId, setRegPlantId] = useState('');
  const [regMaterial, setRegMaterial] = useState('generic');
  const [regLat, setRegLat] = useState('');
  const [regLng, setRegLng] = useState('');
  const [regActivePath, setRegActivePath] = useState('LEFT_SLANT');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;
  const GREEN = colors.GREEN;

  // Preset QR Payload options to simulate scanning easily
  const PRESET_QR_CODES = [
    {
      label: 'Vizag Ore Chute B5 (Iron Ore)',
      payload: {
        name: 'Vizag Ore Chute B5',
        plantCode: 'PL-VIZ-001',
        materialType: 'iron_ore',
        activePath: 'LEFT_SLANT',
        gpsCoordinates: { lat: 17.6868, lng: 83.2185 }
      }
    },
    {
      label: 'Nevada Coal Feeder C1 (Coal)',
      payload: {
        name: 'Nevada Coal Feeder C1',
        plantCode: 'PL-NEV-002',
        materialType: 'coal',
        activePath: 'RIGHT_SLANT',
        gpsCoordinates: { lat: 40.7128, lng: -115.006 }
      }
    },
    {
      label: 'Limestone Feed Slant 3 (Limestone)',
      payload: {
        name: 'Limestone Feed Slant 3',
        plantCode: 'PL-LIM-003',
        materialType: 'limestone',
        activePath: 'LEFT_SLANT',
        gpsCoordinates: { lat: 34.0522, lng: -118.2437 }
      }
    }
  ];

  const handleSelectPreset = (index: number) => {
    const selected = PRESET_QR_CODES[index].payload;
    processQrPayload(selected);
  };

  const processQrPayload = (payload: any) => {
    setValidationError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      if (!payload.name) throw new Error('Missing name field in QR payload');
      
      setRegName(payload.name);
      setRegMaterial(payload.materialType || 'generic');
      setRegActivePath(payload.activePath || 'LEFT_SLANT');
      
      if (payload.gpsCoordinates) {
        setRegLat(String(payload.gpsCoordinates.lat || ''));
        setRegLng(String(payload.gpsCoordinates.lng || ''));
      } else {
        setRegLat('');
        setRegLng('');
      }

      // Try to auto-match plant based on plantCode or plantId
      let matchedPlant = null;
      if (payload.plantCode) {
        matchedPlant = plantsList.find(p => p.plantCode === payload.plantCode || p.plantCode?.replace('NG', '') === payload.plantCode?.replace('NG', ''));
      }
      if (!matchedPlant && payload.plantId) {
        matchedPlant = plantsList.find(p => p._id === payload.plantId);
      }

      if (matchedPlant) {
        setRegPlantId(matchedPlant._id);
      } else {
        // Fall back to first plant if no match
        if (plantsList.length > 0) {
          setRegPlantId(plantsList[0]._id);
          setValidationError(`Notice: Plant code "${payload.plantCode || 'unknown'}" not found in current facility list. Auto-selected "${plantsList[0].name}".`);
        } else {
          setRegPlantId('');
          throw new Error('No plants available in registry to link this chute.');
        }
      }

      setParsedData(payload);
    } catch (err: any) {
      setValidationError(err.message || 'Invalid QR payload structure');
      setParsedData(null);
    }
  };

  const handleJsonPaste = (text: string) => {
    try {
      if (!text.trim()) return;
      const parsed = JSON.parse(text);
      processQrPayload(parsed);
    } catch (e) {
      setValidationError('Invalid JSON structure. Please check syntax.');
      setParsedData(null);
    }
  };

  // Mock scan from uploaded image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setValidationError(null);
    // Simulate a brief delay for image scanning
    setTimeout(() => {
      // In a real production app, we would use jsQR or html5-qrcode to decode the image.
      // Here, we simulate decoding by selecting a random preset payload based on filename or fallback
      const randomPreset = PRESET_QR_CODES[Math.floor(Math.random() * PRESET_QR_CODES.length)].payload;
      processQrPayload(randomPreset);
      setLoading(false);
    }, 1000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPlantId) return;

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const body: any = {
      name: regName,
      plantId: regPlantId,
      materialType: regMaterial,
      activePath: regActivePath,
    };

    if (regLat && regLng) {
      body.gpsCoordinates = {
        lat: parseFloat(regLat),
        lng: parseFloat(regLng),
      };
    }

    try {
      const res = await fetch('/_/backend/industry/chutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to register chute');

      setSuccessMsg(`Chute successfully registered! Assigned Code: ${data.chuteCode}`);
      onChuteRegistered(data);
      
      // Clear details after successful registration
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register chute');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsedData(null);
    setValidationError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    setRegName('');
    setRegPlantId('');
    setRegLat('');
    setRegLng('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: '12px',
        p: 4, width: 480, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>📷 Register Chute via QR Code</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Onboard a new chute by scanning its configuration QR code or selecting a digital asset sheet.
        </div>

        {/* Scan Mode Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['preset', 'upload', 'manual'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setScanMode(mode);
                setParsedData(null);
                setValidationError(null);
              }}
              style={{
                flex: 1, padding: '6px 12px', fontSize: '11px', fontWeight: 700,
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: scanMode === mode ? BLUE : 'rgba(255,255,255,0.04)',
                color: scanMode === mode ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              {mode === 'preset' ? 'Presets' : mode === 'upload' ? 'Upload Image' : 'Paste Payload'}
            </button>
          ))}
        </div>

        {successMsg && (
          <Alert severity="success" style={{ marginBottom: '16px', fontSize: '12px' }}>
            {successMsg}
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" style={{ marginBottom: '16px', fontSize: '12px' }}>
            {errorMsg}
          </Alert>
        )}

        {validationError && (
          <Alert severity="warning" style={{ marginBottom: '16px', fontSize: '11.5px' }}>
            {validationError}
          </Alert>
        )}

        {/* Dynamic Scan Mode View */}
        {scanMode === 'preset' && !parsedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Simulated Chute QR Code</div>
            {PRESET_QR_CODES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPreset(idx)}
                className="glass-card"
                style={{
                  padding: '10px 14px', border: 'none', width: '100%',
                  fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: '10px', color: BLUE, fontWeight: 800 }}>Load QR →</span>
              </button>
            ))}
          </div>
        )}

        {scanMode === 'upload' && !parsedData && (
          <div style={{
            border: '2px dashed var(--border)', borderRadius: '8px', padding: '32px 16px',
            textAlign: 'center', background: 'rgba(255,255,255,0.01)', marginBottom: '16px'
          }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CircularProgress size={30} style={{ color: BLUE, marginBottom: '8px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Decoding QR code pattern...</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📷</div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Upload Asset QR Code</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '16px' }}>Supports PNG, JPG, or PDF tag sheets</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="qr-file-input"
                />
                <label htmlFor="qr-file-input">
                  <Button
                    variant="outlined"
                    component="span"
                    size="small"
                    style={{ borderColor: BLUE, color: BLUE, fontWeight: 700, textTransform: 'none', fontSize: '11px' }}
                  >
                    Select File
                  </Button>
                </label>
              </>
            )}
          </div>
        )}

        {scanMode === 'manual' && !parsedData && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Paste QR Code JSON Payload</div>
            <TextField
              multiline
              rows={4}
              fullWidth
              placeholder='{\n  "name": " Vizag Ore Chute B5",\n  "plantCode": "PL-VIZ-001",\n  "materialType": "iron_ore"\n}'
              onChange={(e) => handleJsonPaste(e.target.value)}
              slotProps={{ input: { style: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' } } }}
            />
          </div>
        )}

        {/* Configuration Review Form (renders when payload is decoded) */}
        {parsedData && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: GREEN, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✓ Decoded QR Code Details
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Chute Name *</div>
              <input
                value={regName}
                onChange={e => setRegName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Linked Plant *</div>
              <select
                value={regPlantId}
                onChange={e => setRegPlantId(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">— Select a plant —</option>
                {plantsList.filter(p => p.isActive).map(p => (
                  <option key={p._id} value={p._id}>{p.name} [{p.ngPrefix}]</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Material Classification</div>
                <select
                  value={regMaterial}
                  onChange={e => setRegMaterial(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="generic">Generic (Balanced)</option>
                  <option value="iron_ore">Iron Ore (Heavy)</option>
                  <option value="coal">Coal (Swelling)</option>
                  <option value="limestone">Limestone (Sticky)</option>
                  <option value="grain">Grain (Organic)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Flow Active Path</div>
                <select
                  value={regActivePath}
                  onChange={e => setRegActivePath(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="LEFT_SLANT">LEFT CROSS (\)</option>
                  <option value="RIGHT_SLANT">RIGHT CROSS (/)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Latitude</div>
                <input
                  type="number"
                  step="any"
                  value={regLat}
                  onChange={e => setRegLat(e.target.value)}
                  placeholder="e.g. 17.6868"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Longitude</div>
                <input
                  type="number"
                  step="any"
                  value={regLng}
                  onChange={e => setRegLng(e.target.value)}
                  placeholder="e.g. 83.2185"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <Button
                variant="outlined"
                onClick={() => setParsedData(null)}
                style={{ flex: 1, borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'none', fontSize: '11px' }}
              >
                Scan Again
              </Button>
              <Button
                type="submit"
                disabled={loading}
                variant="contained"
                style={{ flex: 1.5, background: BLUE, color: '#fff', fontWeight: 700, textTransform: 'none', fontSize: '11px' }}
              >
                {loading ? 'Registering...' : 'Register Asset'}
              </Button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px' }}
          >
            Cancel
          </Button>
        </div>
      </Box>
    </Modal>
  );
};
