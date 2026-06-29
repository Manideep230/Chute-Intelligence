import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Chute,
  ChuteDocument,
  Radar,
  RadarDocument,
  Compressor,
  CompressorDocument,
  AirBlaster,
  AirBlasterDocument,
  Solenoid,
  SolenoidDocument,
  Telemetry,
  TelemetryDocument,
  Alert,
  AlertDocument,
  AiPrediction,
  AiPredictionDocument,
  MaintenanceTicket,
  MaintenanceTicketDocument,
  BlastOutcome,
  BlastOutcomeDocument,
  AuditLog,
  AuditLogDocument,
  CalibrationLog,
  CalibrationLogDocument,
} from '../database/schemas';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Radar.name) private radarModel: Model<RadarDocument>,
    @InjectModel(Compressor.name)
    private compressorModel: Model<CompressorDocument>,
    @InjectModel(AirBlaster.name)
    private airBlasterModel: Model<AirBlasterDocument>,
    @InjectModel(Solenoid.name) private solenoidModel: Model<SolenoidDocument>,
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(MaintenanceTicket.name)
    private maintenanceModel: Model<MaintenanceTicketDocument>,
    @InjectModel(BlastOutcome.name)
    private blastOutcomeModel: Model<BlastOutcomeDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(CalibrationLog.name)
    private calibrationLogModel: Model<CalibrationLogDocument>,
  ) {}

  async getReportData(chuteId: string, from?: string, to?: string) {
    const chuteObjId = new Types.ObjectId(chuteId);
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [
      chute,
      radars,
      compressor,
      blasters,
      solenoids,
      telemetry,
      alerts,
      prediction,
      tickets,
      blastHistory,
      calibrations,
    ] = await Promise.all([
      this.chuteModel.findById(chuteObjId).lean(),
      this.radarModel.find({ chuteId: chuteObjId }).lean(),
      this.compressorModel.findOne({ chuteId: chuteObjId }).lean(),
      this.airBlasterModel.find({ chuteId: chuteObjId }).lean(),
      this.solenoidModel.find({ chuteId: chuteObjId }).lean(),
      this.telemetryModel
        .find({
          chuteId: chuteObjId,
          timestamp: { $gte: fromDate, $lte: toDate },
        })
        .sort({ timestamp: -1 })
        .limit(200)
        .lean(),
      this.alertModel
        .find({
          chuteId: chuteObjId,
          createdAt: { $gte: fromDate, $lte: toDate },
        })
        .sort({ createdAt: -1 })
        .lean(),
      this.aiPredictionModel
        .findOne({ chuteId: chuteObjId })
        .sort({ createdAt: -1 })
        .lean(),
      this.maintenanceModel
        .find({ chuteId: chuteObjId })
        .sort({ createdAt: -1 })
        .lean(),
      this.blastOutcomeModel
        .find({
          chuteId: chuteObjId,
          createdAt: { $gte: fromDate, $lte: toDate },
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.calibrationLogModel
        .find({ chuteId: chuteObjId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      chute,
      hardware: { radars, compressor, blasters, solenoids },
      telemetry,
      alerts,
      prediction,
      maintenanceTickets: tickets,
      blastHistory,
      calibrations,
      summary: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter((a: any) => a.severity === 'Critical')
          .length,
        resolvedAlerts: alerts.filter((a: any) => a.isResolved).length,
        totalBlasts: blastHistory.length,
        avgBlastEffectiveness:
          blastHistory.length > 0
            ? Math.round(
                blastHistory.reduce(
                  (s: number, b: any) => s + (b.effectivenessScore || 0),
                  0,
                ) / blastHistory.length,
              )
            : 0,
        openTickets: tickets.filter((t: any) => t.status !== 'Resolved').length,
        compressorHealth: (compressor as any)?.healthScore ?? 100,
        avgSolenoidHealth:
          solenoids.length > 0
            ? Math.round(
                solenoids.reduce(
                  (s: number, sv: any) => s + sv.healthScore,
                  0,
                ) / solenoids.length,
              )
            : 100,
      },
    };
  }

  generateCsv(data: any): string {
    const rows: string[] = [];
    rows.push('Nigha Radar - Operational Report');
    rows.push(`Generated: ${data.generatedAt}`);
    rows.push(`Chute: ${data.chute?.name || 'Unknown'}`);
    rows.push(`Period: ${data.period.from} to ${data.period.to}`);
    rows.push('');

    // Summary Section
    rows.push('=== SUMMARY ===');
    rows.push('Metric,Value');
    Object.entries(data.summary).forEach(([k, v]) => {
      rows.push(`${k},${v}`);
    });
    rows.push('');

    // Alerts Section
    rows.push('=== ALERTS ===');
    rows.push('Timestamp,Severity,Source,Message,Resolved');
    data.alerts.forEach((a: any) => {
      rows.push(
        `${a.createdAt},${a.severity},${a.source},"${a.message}",${a.isResolved}`,
      );
    });
    rows.push('');

    // Blast History
    rows.push('=== BLAST HISTORY ===');
    rows.push('Timestamp,Valve,Effectiveness,Success');
    data.blastHistory.forEach((b: any) => {
      rows.push(
        `${b.createdAt},${b.valveNumber || b.blasterNumber},${b.effectivenessScore || 0},${b.success}`,
      );
    });
    rows.push('');

    // Maintenance
    rows.push('=== MAINTENANCE TICKETS ===');
    rows.push('AssetType,Description,Status,Created');
    data.maintenanceTickets.forEach((t: any) => {
      rows.push(`${t.assetType},"${t.description}",${t.status},${t.createdAt}`);
    });

    return rows.join('\n');
  }
}
