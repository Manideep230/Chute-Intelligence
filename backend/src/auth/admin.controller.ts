import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard, Roles } from './roles.guard';
import { ResetDatabaseDto } from './dto/admin.dto';
import {
  Radar,
  RadarDocument,
  AirBlaster,
  AirBlasterDocument,
  Solenoid,
  SolenoidDocument,
  Compressor,
  CompressorDocument,
  Alert,
  AlertDocument,
  Notification,
  NotificationDocument,
  Telemetry,
  TelemetryDocument,
  GpsLocation,
  GpsLocationDocument,
  HubHealth,
  HubHealthDocument,
  AiPrediction,
  AiPredictionDocument,
  AuditLog,
  AuditLogDocument,
  MaintenanceTicket,
  MaintenanceTicketDocument,
  BlastOutcome,
  BlastOutcomeDocument,
  ChuteUptimeLog,
  ChuteUptimeLogDocument,
  CalibrationLog,
  CalibrationLogDocument,
  Chute,
  ChuteDocument,
} from '../database/schemas';

@ApiTags('Super Admin Operations')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Super Admin')
@ApiBearerAuth()
export class AdminController {
  constructor(
    @InjectModel(Radar.name) private radarModel: Model<RadarDocument>,
    @InjectModel(AirBlaster.name)
    private airBlasterModel: Model<AirBlasterDocument>,
    @InjectModel(Solenoid.name) private solenoidModel: Model<SolenoidDocument>,
    @InjectModel(Compressor.name)
    private compressorModel: Model<CompressorDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    @InjectModel(GpsLocation.name)
    private gpsLocationModel: Model<GpsLocationDocument>,
    @InjectModel(HubHealth.name)
    private hubHealthModel: Model<HubHealthDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(MaintenanceTicket.name)
    private maintenanceTicketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(BlastOutcome.name)
    private blastOutcomeModel: Model<BlastOutcomeDocument>,
    @InjectModel(ChuteUptimeLog.name)
    private chuteUptimeLogModel: Model<ChuteUptimeLogDocument>,
    @InjectModel(CalibrationLog.name)
    private calibrationLogModel: Model<CalibrationLogDocument>,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
  ) {}

  /**
   * POST /admin/reset-database
   *
   * Clears ALL operational data while preserving structural data.
   *
   * CLEARED (operational):
   *   Radar, AirBlaster, Solenoid, Compressor, HubHealth, AiPrediction
   *   Alert, Notification, Telemetry, GpsLocation
   *   AuditLog, MaintenanceTicket, BlastOutcome, ChuteUptimeLog, CalibrationLog
   *
   * PRESERVED (structural):
   *   Plant, Chute, User, Role, Organization, Region, Assignment, Webhook, OpcUaConfig
   *
   * After clearing, baseline hardware records are re-seeded for every active chute.
   */
  @Post('reset-database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'DESTRUCTIVE: Wipe all operational data and re-seed baselines (Super Admin only)',
  })
  async resetDatabase(@Body() body: ResetDatabaseDto, @Req() req: any) {
    // Safety gate: must explicitly confirm
    if (!body.confirm || body.confirmPhrase !== 'RESET') {
      throw new ForbiddenException(
        'Safety check failed. Send { "confirm": true, "confirmPhrase": "RESET" } to proceed.',
      );
    }

    // ── 1. Wipe all operational collections ─────────────────────────────────
    const counts: Record<string, number> = {};

    counts.radars = (await this.radarModel.deleteMany({}).exec()).deletedCount;
    counts.airBlasters = (
      await this.airBlasterModel.deleteMany({}).exec()
    ).deletedCount;
    counts.solenoids = (
      await this.solenoidModel.deleteMany({}).exec()
    ).deletedCount;
    counts.compressors = (
      await this.compressorModel.deleteMany({}).exec()
    ).deletedCount;
    counts.hubHealth = (
      await this.hubHealthModel.deleteMany({}).exec()
    ).deletedCount;
    counts.aiPredictions = (
      await this.aiPredictionModel.deleteMany({}).exec()
    ).deletedCount;
    counts.alerts = (await this.alertModel.deleteMany({}).exec()).deletedCount;
    counts.notifications = (
      await this.notificationModel.deleteMany({}).exec()
    ).deletedCount;
    counts.telemetry = (
      await this.telemetryModel.deleteMany({}).exec()
    ).deletedCount;
    counts.gpsLocations = (
      await this.gpsLocationModel.deleteMany({}).exec()
    ).deletedCount;
    counts.auditLogs = (
      await this.auditLogModel.collection.deleteMany({})
    ).deletedCount;
    counts.maintenanceTickets = (
      await this.maintenanceTicketModel.deleteMany({}).exec()
    ).deletedCount;
    counts.blastOutcomes = (
      await this.blastOutcomeModel.deleteMany({}).exec()
    ).deletedCount;
    counts.chuteUptimeLogs = (
      await this.chuteUptimeLogModel.deleteMany({}).exec()
    ).deletedCount;
    counts.calibrationLogs = (
      await this.calibrationLogModel.deleteMany({}).exec()
    ).deletedCount;

    // ── 2. Reset chute operational fields ────────────────────────────────────
    await this.chuteModel
      .updateMany(
        {},
        {
          status: 'Normal',
          totalBlasts: 0,
          consecutiveFailedBlasts: 0,
          blockagePosition: 'None',
          blockageDistance: 3.5,
          nearestSolenoidGroup: 1,
          simulationMode: false,
          activePath: 'LEFT_SLANT',
          lastSyncTime: new Date(),
        },
      )
      .exec();

    // ── 3. Re-seed baseline hardware for each chute ──────────────────────────
    const chutes = await this.chuteModel.find().exec();
    let seededChutes = 0;

    for (const chute of chutes) {
      const chuteId = chute._id;

      // 4 Radars
      for (let i = 1; i <= 4; i++) {
        await this.radarModel.create({
          chuteId,
          zone: i,
          distance: 3.5,
          buildupDetected: false,
          trendDirection: 'stable',
          buildupRatePerMin: 0,
        });
      }

      // 4 Air Blasters
      for (let i = 1; i <= 4; i++) {
        await this.airBlasterModel.create({
          chuteId,
          blasterNumber: i,
          totalBlasts: 0,
          lifespanBlasts: 20000,
          healthScore: 100,
        });
      }

      // 8 Solenoids
      for (let i = 1; i <= 8; i++) {
        await this.solenoidModel.create({
          chuteId,
          valveNumber: i,
          totalCycles: 0,
          lifespanCycles: 50000,
          healthScore: 100,
        });
      }

      // 1 Compressor
      await this.compressorModel.create({
        chuteId,
        pressure: 110,
        runtimeHours: 0,
        refillDuration: 45,
        refillFrequency: 0,
        motorTemperature: 28,
        efficiency: 98,
        healthScore: 100,
        totalAirLitresConsumed: 0,
        unnecessaryBlastsCount: 0,
        airLitresPerBlastAvg: 0,
      });

      // Hub Health
      await this.hubHealthModel.create({
        chuteId,
        isOnline: false,
        localLogsCount: 0,
        lastPing: undefined,
      });

      // AI Predictions
      await this.aiPredictionModel.create({
        chuteId,
        blockageProbability: 5,
        compressorFailureProbability: 2,
        solenoidWearProbability: 0,
        airBlasterMaintenanceProbability: 0,
        recommendedActions: [
          'System reset. Awaiting telemetry from hardware hub.',
        ],
        buildupRatePerMin: 0,
        overallTrend: 'stable',
        lastBlastEffectivenessScore: -1,
        consecutiveFailedBlasts: 0,
        uptimePercent24h: 100,
        blockageMinutesToday: 0,
        airLitresToday: 0,
      });

      seededChutes++;
    }

    // ── 4. Write reset audit entry ───────────────────────────────────────────
    await this.auditLogModel.create({
      userId: req.user._id,
      action: 'DATABASE RESET',
      details:
        `FULL operational database reset executed by ${req.user.name} (${req.user.role}). ` +
        `Deleted: ${Object.entries(counts)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')}. ` +
        `Re-seeded baseline hardware for ${seededChutes} chutes.`,
    });

    return {
      success: true,
      message:
        'Database reset complete. All operational data cleared and baselines re-seeded.',
      clearedCounts: counts,
      seededChutes,
      preservedCollections: [
        'Plants',
        'Chutes',
        'Users',
        'Roles',
        'Organizations',
        'Regions',
        'Assignments',
        'Webhooks',
        'OpcUaConfig',
      ],
      timestamp: new Date().toISOString(),
      executedBy: `${req.user.name} (${req.user.role})`,
    };
  }
}
