import React, { useState } from 'react';
import { getThemeColors } from '../constants';
import { useAuthStore } from '../../../store/authStore';
import { useTelemetryStore } from '../../../store/telemetryStore';
import { useRoleAccess } from '../../../hooks/useRoleAccess';
import { PhoneChangeModal } from './modals/PhoneChangeModal';
import { QrOnboardingModal } from './modals/QrOnboardingModal';
import { DbResetDialog } from './modals/DbResetDialog';

interface ProfileTabProps {
  theme: 'dark' | 'light';
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ theme }) => {
  const { user, token, updateUser } = useAuthStore();
  const { activeChuteId } = useTelemetryStore();
  const roleAccess = useRoleAccess();

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [dbResetDialogOpen, setDbResetDialogOpen] = useState(false);

  const colors = getThemeColors(theme);
  const RED = colors.RED;
  const AMBER = colors.AMBER;
  const BLUE = colors.BLUE;
  return (
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
          
          {activeChuteId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Chute:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Chute telemetry sync active</span>
                </div>
              </div>
              <button
                onClick={() => setQrModalOpen(true)}
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
              onClick={() => setDbResetDialogOpen(true)}
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

      <PhoneChangeModal
        open={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        token={token}
        updateUser={updateUser}
        theme={theme}
      />

      <QrOnboardingModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        activeChuteId={activeChuteId}
        token={token}
        theme={theme}
      />

      <DbResetDialog
        open={dbResetDialogOpen}
        onClose={() => setDbResetDialogOpen(false)}
        token={token}
        theme={theme}
      />
    </div>
  );
};
