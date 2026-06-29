import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mock minimal DOM APIs that jsPDF/jspdf-autotable might expect in some paths
if (typeof self !== 'undefined' && !('window' in self)) {
  (self as any).window = self;
}
if (typeof self !== 'undefined' && !('document' in self)) {
  (self as any).document = {
    createElement: () => ({})
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { data } = e.data;
  
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE_RGB: [number, number, number] = [0, 132, 199];
    const DARK_RGB: [number, number, number] = [10, 15, 26];

    // Header
    doc.setFillColor(...DARK_RGB); doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(0, 212, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('NIGHA RADAR', 14, 14);
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Industrial IoT Operational Report', 14, 22);
    doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 14, 28);

    // Chute summary
    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Chute: ${data.chute?.name || 'Unknown'}`, 14, 42);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${new Date(data.period.from).toLocaleDateString()} – ${new Date(data.period.to).toLocaleDateString()}`, 14, 48);
    doc.text(`Status: ${data.chute?.status || 'N/A'}`, 14, 54);

    // Summary KPIs table
    autoTable(doc, {
      startY: 62,
      head: [['KPI', 'Value']],
      body: Object.entries(data.summary).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').trim(), String(v)]),
      headStyles: { fillColor: BLUE_RGB, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    // Alerts table
    if (data.alerts && data.alerts.length > 0) {
      doc.addPage();
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Alert History', 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [['Timestamp', 'Severity', 'Source', 'Message', 'Resolved']],
        body: data.alerts.map((a: any) => [
          new Date(a.createdAt).toLocaleString(), a.severity, a.source,
          a.message.slice(0, 60), a.isResolved ? 'Yes' : 'No'
        ]),
        headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2 },
      });
    }

    // Blast history table
    if (data.blastHistory && data.blastHistory.length > 0) {
      doc.addPage();
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Blast History', 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [['Timestamp', 'Valve', 'Effectiveness', 'Success']],
        body: data.blastHistory.map((b: any) => [
          new Date(b.createdAt).toLocaleString(),
          `SV${b.valveNumber || b.blasterNumber || 'N/A'}`,
          `${b.effectivenessScore || 0}%`,
          b.success ? 'Yes' : 'No'
        ]),
        headStyles: { fillColor: [0, 132, 199], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2 },
      });
    }

    // Maintenance table
    if (data.maintenanceTickets && data.maintenanceTickets.length > 0) {
      doc.addPage();
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Maintenance Records', 14, 20);
      autoTable(doc, {
        startY: 26,
        head: [['Asset Type', 'Description', 'Status', 'Date']],
        body: data.maintenanceTickets.map((t: any) => [
          t.assetType, t.description?.slice(0, 50), t.status, new Date(t.createdAt).toLocaleDateString()
        ]),
        headStyles: { fillColor: [52, 211, 153], textColor: [0, 0, 0] },
        styles: { fontSize: 8, cellPadding: 2 },
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`Nigha Radar — Confidential — Page ${i} of ${totalPages}`, 14, 290);
    }

    const pdfOutput = doc.output('arraybuffer');
    (self as any).postMessage({ success: true, pdfOutput }, [pdfOutput]);
  } catch (err: any) {
    (self as any).postMessage({ success: false, error: err.message || 'Unknown error' });
  }
};
