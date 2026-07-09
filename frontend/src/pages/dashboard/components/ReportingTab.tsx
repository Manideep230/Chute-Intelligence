import React, { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { FileText, Download, CheckSquare } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ReportingTabProps {
  activeChuteId: string;
  token: string;
}

export const ReportingTab: React.FC<ReportingTabProps> = React.memo(({ activeChuteId, token }) => {
  const [reportType, setReportType] = useState('daily');
  const [format, setFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState('');

  const triggerDownload = async () => {
    setDownloading(true);
    setMsg('');
    try {
      const fromIso = new Date(startDate).toISOString();
      const toIso = new Date(endDate).toISOString();

      if (format === 'csv') {
        const res = await fetch(`/_/backend/reports/${activeChuteId}?format=csv&from=${fromIso}&to=${toIso}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to retrieve CSV report');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nigha_report_${reportType}_${startDate}.csv`;
        a.click();
        setMsg('CSV report downloaded successfully.');
      } else {
        // Fetch JSON data for PDF or Excel formatting
        const res = await fetch(`/_/backend/reports/${activeChuteId}?format=json&from=${fromIso}&to=${toIso}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to retrieve report data');
        const data = await res.json();

        if (format === 'pdf') {
          const doc = new jsPDF();
          doc.setFontSize(18);
          doc.text(`Nigha Radar - Operational Report (${reportType.toUpperCase()})`, 14, 20);
          
          doc.setFontSize(11);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
          doc.text(`Chute: ${data.chute?.name || 'RMHS Chute #1'}`, 14, 34);
          doc.text(`Period: ${startDate} to ${endDate}`, 14, 40);

          doc.setFontSize(14);
          doc.text('=== Operational Summary ===', 14, 52);
          
          let y = 60;
          Object.entries(data.summary).forEach(([k, v]) => {
            doc.setFontSize(10);
            doc.text(`${k}: ${v}`, 14, y);
            y += 6;
          });

          // Add Alerts Table
          if (data.alerts && data.alerts.length > 0) {
            y += 10;
            doc.setFontSize(14);
            doc.text('=== Active & Unresolved Alarms ===', 14, y);
            const alertRows = data.alerts.map((a: any) => [
              new Date(a.createdAt).toLocaleDateString(),
              a.severity,
              a.source,
              a.message,
              a.isResolved ? 'Yes' : 'No'
            ]);
            (doc as any).autoTable({
              startY: y + 5,
              head: [['Date', 'Severity', 'Source', 'Message', 'Resolved']],
              body: alertRows
            });
          }

          doc.save(`nigha_report_${reportType}_${startDate}.pdf`);
          setMsg('PDF report generated and downloaded.');
        } else if (format === 'excel') {
          // Construct Excel XML or HTML spreadsheet
          let content = '<table>';
          content += '<tr><th colspan="2">Nigha Radar Operational Report</th></tr>';
          content += `<tr><td>Generated</td><td>${new Date().toLocaleString()}</td></tr>`;
          content += `<tr><td>Chute</td><td>${data.chute?.name || 'RMHS Chute'}</td></tr>`;
          content += `<tr><td>Period</td><td>${startDate} to ${endDate}</td></tr>`;
          content += '<tr></tr>';
          content += '<tr><th>Summary Metric</th><th>Value</th></tr>';
          
          Object.entries(data.summary).forEach(([k, v]) => {
            content += `<tr><td>${k}</td><td>${v}</td></tr>`;
          });
          
          content += '</table>';

          const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `nigha_report_${reportType}_${startDate}.xls`;
          a.click();
          setMsg('Excel (.xls) report generated and downloaded.');
        }
      }
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>📂 Enterprise Reporting & Exports</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Generate daily, weekly, monthly, incident, and equipment logs in PDF, CSV, and Excel formats.</p>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={16} /> Export Report Panel
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
              <option value="daily">Daily Operational Report</option>
              <option value="weekly">Weekly Operational Report</option>
              <option value="monthly">Monthly Operational Report</option>
              <option value="incident">Incident Summary Report</option>
              <option value="maintenance">Maintenance Log Report</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>File Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }}>
              <option value="pdf">Acrobat PDF (.pdf)</option>
              <option value="csv">Comma Separated Value (.csv)</option>
              <option value="excel">Microsoft Excel (.xls)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>From Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>To Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--border-light)', color: 'var(--text-primary)', fontSize: '12px' }} />
          </div>
        </div>

        <button onClick={triggerDownload} disabled={downloading} style={{ padding: '10px 16px', background: 'var(--accent-primary)', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '8px' }}>
          {downloading ? <CircularProgress size={16} color="inherit" /> : <><Download size={14} /> Download Export Report</>}
        </button>

        {msg && (
          <div style={{
            fontSize: '11px',
            color: msg.includes('Error') ? 'var(--accent-red)' : 'var(--accent-green)',
            padding: '8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '4px',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckSquare size={12} /> {msg}
          </div>
        )}
      </div>
    </div>
  );
});
