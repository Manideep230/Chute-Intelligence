import React, { useState } from 'react';
import { Modal, Box, Alert, Button } from '@mui/material';
import { FileText } from 'lucide-react';
import { getThemeColors } from '../../constants';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  activeChuteId: string | null;
  token: string | null;
  theme: 'dark' | 'light';
}

export const ReportModal: React.FC<ReportModalProps> = ({
  open,
  onClose,
  activeChuteId,
  token,
  theme,
}) => {
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const colors = getThemeColors(theme);
  const BLUE = colors.BLUE;

  const handleDownloadReport = async (fmt: 'pdf' | 'csv') => {
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
        const a = document.createElement('a');
        a.href = url;
        a.download = `nigha_report_${activeChuteId.slice(-6)}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        // Adjust paths relative to components/modals/ReportModal.tsx
        const worker = new Worker(new URL('../../../report.worker.ts', import.meta.url), { type: 'module' });

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
            onClose();
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
      onClose();
    } catch (err: any) {
      setReportError(err.message || 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !reportLoading && onClose()}>
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
            onClick={onClose}
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
  );
};
