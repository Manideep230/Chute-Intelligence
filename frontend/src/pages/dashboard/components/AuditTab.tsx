import React from 'react';
import { TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { getThemeColors } from '../constants';

interface AuditTabProps {
  auditLogs: any[];
  theme: 'dark' | 'light';
}

export const AuditTab: React.FC<AuditTabProps> = ({ auditLogs, theme }) => {
  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;

  return (
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
  );
};
