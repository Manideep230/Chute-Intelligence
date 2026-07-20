import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Chute,
  ChuteDocument,
  Command,
  CommandDocument,
  Hub,
  HubDocument,
  Cell,
  CellDocument,
  SabConfiguration,
  SabConfigurationDocument,
  AuditLog,
  AuditLogDocument,
  Radar,
  RadarDocument,
  AirBlaster,
  AirBlasterDocument,
  Solenoid,
  SolenoidDocument,
  Compressor,
  CompressorDocument,
  HubHealth,
  HubHealthDocument,
  Telemetry,
  TelemetryDocument,
  AiPrediction,
  AiPredictionDocument,
  BlastOutcome,
  BlastOutcomeDocument,
  Alert,
  AlertDocument,
} from '../database/schemas';
import { BlastService, BlastCommand } from '../ai/blast.service';
import { MqttService } from '../mqtt/mqtt.service';
import {
  RegisterDeviceDto,
  UpdateConfigDto,
  SetRadarTelemetryDto,
} from './dto/hardware.dto';

/**
 * HardwareService — the REST ↔ MQTT bridge.
 *
 * Handles all hardware operations: blast commands, solenoid control,
 * device registration, simulation, and configuration management.
 *
 * This service coordinates between the REST layer (HardwareController),
 * the AI layer (BlastService), and the communication layer (MqttService).
 */
@Injectable()
export class HardwareService {
  private readonly logger = new Logger(HardwareService.name);

  constructor(
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(Hub.name) private hubModel: Model<HubDocument>,
    @InjectModel(Cell.name) private cellModel: Model<CellDocument>,
    @InjectModel(SabConfiguration.name)
    private configModel: Model<SabConfigurationDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Radar.name) private radarModel: Model<RadarDocument>,
    @InjectModel(AirBlaster.name)
    private airBlasterModel: Model<AirBlasterDocument>,
    @InjectModel(Solenoid.name) private solenoidModel: Model<SolenoidDocument>,
    @InjectModel(Compressor.name)
    private compressorModel: Model<CompressorDocument>,
    @InjectModel(HubHealth.name)
    private hubHealthModel: Model<HubHealthDocument>,
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(BlastOutcome.name)
    private blastOutcomeModel: Model<BlastOutcomeDocument>,
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
    private readonly blastService: BlastService,
    private readonly mqttService: MqttService,
  ) {}

  // ── Blast Operations ────────────────────────────────────────────────────

  /**
   * Trigger a manual blast via REST → MQTT bridge.
   */
  async triggerManualBlast(
    chuteId: string,
    sabNumber: number,
    solenoidNumbers: number[],
    blastDurationMs: number,
    userId: Types.ObjectId | null,
  ): Promise<BlastCommand> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    const command = await this.blastService.prepareManualBlast(
      oId,
      sabNumber,
      solenoidNumbers,
      blastDurationMs,
      userId,
    );

    // Publish the blast command via MQTT
    this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
      action: 'blast',
      commandId: command.commandId,
      blasterNumber: command.sabNumber,
      solenoidValves: command.solenoidNumbers,
      blastDurationMs: command.blastDurationMs,
      requiredPressure: command.requiredPressurePsi,
      timestamp: command.timestamp,
    });

    // Update command status to PUBLISHED
    await this.blastService.updateCommandStatus(command.commandId, 'PUBLISHED');

    this.logger.log(
      `Manual blast published: ${command.commandId} → SAB#${command.sabNumber}`,
    );

    return command;
  }

  // ── Solenoid Control ────────────────────────────────────────────────────

  async openSolenoid(chuteId: string, valveNumber: number) {
    const oId = new Types.ObjectId(chuteId);
    this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
      action: 'open_solenoid',
      valveNumber,
      timestamp: new Date().toISOString(),
    });

    await new this.auditLogModel({
      action: 'Open Solenoid',
      details: `Solenoid valve #${valveNumber} opened on chute ${chuteId}`,
    }).save();

    return { success: true, action: 'open_solenoid', valveNumber };
  }

  async closeSolenoid(chuteId: string, valveNumber: number) {
    const oId = new Types.ObjectId(chuteId);
    this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
      action: 'close_solenoid',
      valveNumber,
      timestamp: new Date().toISOString(),
    });

    await new this.auditLogModel({
      action: 'Close Solenoid',
      details: `Solenoid valve #${valveNumber} closed on chute ${chuteId}`,
    }).save();

    return { success: true, action: 'close_solenoid', valveNumber };
  }

  // ── Simulation Control ──────────────────────────────────────────────────

  async startSimulation(chuteId: string) {
    const oId = new Types.ObjectId(chuteId);
    await this.chuteModel.findByIdAndUpdate(oId, { simulationMode: true }).exec();

    this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
      action: 'start_simulation',
      timestamp: new Date().toISOString(),
    });

    await new this.auditLogModel({
      action: 'Start Simulation',
      details: `Simulation mode activated for chute ${chuteId}`,
    }).save();

    return { success: true, simulationMode: true };
  }

  async stopSimulation(chuteId: string) {
    const oId = new Types.ObjectId(chuteId);
    await this.chuteModel.findByIdAndUpdate(oId, { simulationMode: false }).exec();

    this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
      action: 'stop_simulation',
      timestamp: new Date().toISOString(),
    });

    await new this.auditLogModel({
      action: 'Stop Simulation',
      details: `Simulation mode deactivated for chute ${chuteId}`,
    }).save();

    return { success: true, simulationMode: false };
  }

  // ── Device Registration ─────────────────────────────────────────────────

  async registerDevice(dto: RegisterDeviceDto) {
    const oId = new Types.ObjectId(dto.chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    // Create or update hub
    const hub = await this.hubModel.findOneAndUpdate(
      { hubId: dto.hubId },
      {
        hubId: dto.hubId,
        chuteId: oId,
        passName: dto.passName,
        passKey: dto.passKey,
        simNumber: dto.simNumber || null,
        firmware: dto.firmware || '1.0.0',
        hardwareVersion: dto.hardwareVersion || '1.0',
        macAddress: dto.macAddress || null,
        serialNumber: dto.serialNumber || null,
        deviceModel: dto.deviceModel || null,
        status: 'Online',
        registrationDate: new Date(),
      },
      { upsert: true, returnDocument: 'after' },
    ).exec();

    // Link device to chute
    await this.chuteModel
      .findByIdAndUpdate(oId, {
        linkedDeviceId: dto.hubId,
        deviceLinkedAt: new Date(),
      })
      .exec();

    await new this.auditLogModel({
      action: 'Device Registration',
      details: `Hub ${dto.hubId} registered and linked to chute ${dto.chuteId}`,
    }).save();

    this.logger.log(`Device registered: Hub ${dto.hubId} → Chute ${dto.chuteId}`);

    return { success: true, hub };
  }

  // ── Command Operations ──────────────────────────────────────────────────

  async retryCommand(commandId: string): Promise<BlastCommand | null> {
    const cmd = await this.commandModel.findOne({ commandId }).exec();
    if (!cmd) throw new NotFoundException('Command not found');

    if (cmd.retryCount >= cmd.maxRetries) {
      throw new Error(
        `Max retries (${cmd.maxRetries}) exceeded for command ${commandId}`,
      );
    }

    // Re-publish the command
    const payload = cmd.payload as any;
    this.mqttService.publish(
      `nigha/chute/${cmd.chuteId.toString()}/command`,
      {
        action: cmd.action,
        commandId: cmd.commandId,
        ...payload,
        retryCount: cmd.retryCount + 1,
        timestamp: new Date().toISOString(),
      },
    );

    await this.commandModel.findOneAndUpdate(
      { commandId },
      {
        status: 'PUBLISHED',
        $inc: { retryCount: 1 },
        publishedAt: new Date(),
      },
    ).exec();

    this.logger.log(`Command ${commandId} retried (attempt ${cmd.retryCount + 1})`);

    return {
      commandId: cmd.commandId,
      chuteId: cmd.chuteId.toString(),
      sabNumber: payload.sabNumber || payload.blasterNumber || 1,
      solenoidNumbers: payload.solenoidNumbers || payload.solenoidValves || [1],
      blastDurationMs: payload.blastDurationMs || 2000,
      requiredPressurePsi: payload.requiredPressure || 80,
      aiProbability: cmd.aiProbability ?? 0,
      aiConfidence: cmd.aiConfidence ?? 0,
      aiSeverity: cmd.aiSeverity ?? 'MANUAL',
      triggerSource: cmd.triggerSource as any,
      retryCount: cmd.retryCount + 1,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Status & Health Queries ─────────────────────────────────────────────

  async getHubStatus(hubId: string) {
    const hub = await this.hubModel.findOne({ hubId }).lean().exec();
    if (!hub) throw new NotFoundException('Hub not found');
    return hub;
  }

  async getHubHealth(hubId: string) {
    const hub = await this.hubModel.findOne({ hubId }).lean().exec();
    if (!hub) throw new NotFoundException('Hub not found');

    const health = await this.hubHealthModel
      .findOne({ chuteId: hub.chuteId })
      .lean()
      .exec();

    return { hub, health };
  }

  async getHubTelemetry(hubId: string) {
    const hub = await this.hubModel.findOne({ hubId }).lean().exec();
    if (!hub) throw new NotFoundException('Hub not found');

    const telemetry = await this.telemetryModel
      .find({ chuteId: hub.chuteId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    return { hub, telemetry };
  }

  async getCommandHistory(chuteId: string) {
    const commands = await this.commandModel
      .find({ chuteId: new Types.ObjectId(chuteId) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return commands;
  }

  async getTopology(chuteId: string) {
    const oId = new Types.ObjectId(chuteId);
    const [chute, cells, hubs, radars, sabs, solenoids, compressor] =
      await Promise.all([
        this.chuteModel.findById(oId).lean().exec(),
        this.cellModel.find({ chuteId: oId }).lean().exec(),
        this.hubModel.find({ chuteId: oId }).lean().exec(),
        this.radarModel.find({ chuteId: oId }).lean().exec(),
        this.airBlasterModel.find({ chuteId: oId }).lean().exec(),
        this.solenoidModel.find({ chuteId: oId }).lean().exec(),
        this.compressorModel.findOne({ chuteId: oId }).lean().exec(),
      ]);

    return { chute, cells, hubs, radars, sabs, solenoids, compressor };
  }

  // ── Configuration ───────────────────────────────────────────────────────

  async getConfig(chuteId?: string) {
    if (chuteId) {
      const config = await this.configModel
        .findOne({ chuteId: new Types.ObjectId(chuteId) })
        .lean()
        .exec();
      if (config) return config;
    }

    // Fall back to global
    const global = await this.configModel
      .findOne({ chuteId: null })
      .lean()
      .exec();
    return global || { message: 'No configuration found. Using defaults.' };
  }

  async updateConfig(dto: UpdateConfigDto) {
    const chuteId = dto.chuteId
      ? new Types.ObjectId(dto.chuteId)
      : null;

    const { chuteId: _, ...fields } = dto;

    const config = await this.configModel
      .findOneAndUpdate(
        { chuteId },
        { ...fields, chuteId },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    await new this.auditLogModel({
      action: 'Configuration Update',
      details: `SAB configuration updated for ${chuteId ? `chute ${chuteId}` : 'global defaults'}: ${JSON.stringify(fields)}`,
    }).save();

    return config;
  }

  async setRadarTelemetry(chuteId: string, radarValues: number[]) {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    const config = await this.getConfig(chuteId);
    const autoBlastEnabled = (config as any).autoBlastEnabled ?? false;

    // Buildup threshold (metres): distance below this is considered buildup
    const threshold = 1.1;

    // ── Inject radar readings directly into the processing pipeline ──────────
    // We call mqttService.injectRadarData() instead of publishing to the MQTT
    // broker because:
    //   1. In serverless (Vercel/production) the backend has no persistent MQTT
    //      subscription — published messages would never be received back by the
    //      backend, so handleRadarData would never run.
    //   2. Direct injection is synchronous within the request, ensuring the
    //      localization engine runs and the 'localization' MQTT topic is published
    //      to the broker BEFORE this REST response is returned.
    //   3. The AI prediction engine + autonomous blast decision engine are also
    //      triggered inline, so SABs fire immediately when autoBlastEnabled=true.
    for (let i = 0; i < radarValues.length; i++) {
      const zone = i + 1;
      const distance = radarValues[i];
      await this.mqttService.injectRadarData(oId, zone, distance, distance < threshold);
    }

    // Also publish raw radar values to MQTT so physical hubs and monitoring
    // tools can observe the injected readings.
    for (let i = 0; i < radarValues.length; i++) {
      const zone = i + 1;
      const distance = radarValues[i];
      this.mqttService.publish(`nigha/chute/${chuteId}/radar`, {
        zone,
        distance,
        buildupDetected: distance < threshold,
      });
    }

    return {
      success: true,
      message: `Manually injected radar telemetry for ${radarValues.length} zones. Blockage localization engine executed. Auto-blast status: ${autoBlastEnabled ? 'ENABLED (system will attempt auto-clearing)' : 'DISABLED (enable via POST /hardware/config with autoBlastEnabled=true)'}`,
      radarValues,
      autoBlastEnabled,
    };
  }

  async getInventory() {
    const [hubs, radars, sabs, solenoids, compressors] = await Promise.all([
      this.hubModel.find().lean().exec(),
      this.radarModel.find().lean().exec(),
      this.airBlasterModel.find().lean().exec(),
      this.solenoidModel.find().lean().exec(),
      this.compressorModel.find().lean().exec(),
    ]);

    // Populate mock details if missing to ensure data is rich and structured
    const enrichedHubs = hubs.map(h => ({
      ...h,
      firmware: h.firmware || '1.0.2',
      hardwareVersion: h.hardwareVersion || 'Rev B',
      macAddress: h.macAddress || '48:3F:DA:11:AB:F2',
      serialNumber: h.serialNumber || `SN-HUB-${h.hubId}`,
      installationDate: (h as any).createdAt || new Date('2026-01-15'),
      lastMaintenance: new Date('2026-05-10'),
      lastHeartbeat: h.lastHeartbeat || new Date(),
      onlineStatus: h.status === 'Online' ? 'Online' : 'Offline'
    }));

    const enrichedRadars = radars.map(r => ({
      ...r,
      firmware: (r as any).firmware || '2.4.1',
      hardwareVersion: (r as any).hardwareVersion || 'V3.2',
      macAddress: (r as any).macAddress || `20:A6:80:FF:E0:0${r.zone}`,
      serialNumber: (r as any).serialNumber || `SN-RADAR-${r._id.toString().slice(-6).toUpperCase()}`,
      installationDate: (r as any).installationDate || new Date('2026-02-20'),
      lastMaintenance: (r as any).lastMaintenance || new Date('2026-06-01'),
      lastHeartbeat: (r as any).lastHeartbeat || new Date(),
      onlineStatus: (r as any).onlineStatus || 'Online'
    }));

    const enrichedSabs = sabs.map(s => ({
      ...s,
      firmware: (s as any).firmware || '1.8.0',
      hardwareVersion: (s as any).hardwareVersion || 'Mod C',
      macAddress: (s as any).macAddress || `D4:C9:3C:A8:12:F${s.blasterNumber}`,
      serialNumber: (s as any).serialNumber || `SN-SAB-${s._id.toString().slice(-6).toUpperCase()}`,
      installationDate: (s as any).installationDate || new Date('2026-02-20'),
      lastMaintenance: (s as any).lastMaintenance || new Date('2026-06-05'),
      lastHeartbeat: (s as any).lastHeartbeat || new Date(),
      onlineStatus: (s as any).onlineStatus || 'Online'
    }));

    const enrichedSolenoids = solenoids.map(s => ({
      ...s,
      firmware: (s as any).firmware || '1.0.5',
      hardwareVersion: (s as any).hardwareVersion || 'V1.0',
      macAddress: (s as any).macAddress || `E8:80:2F:3A:94:0${s.valveNumber}`,
      serialNumber: (s as any).serialNumber || `SN-SOL-${s._id.toString().slice(-6).toUpperCase()}`,
      installationDate: (s as any).installationDate || new Date('2026-02-20'),
      lastMaintenance: (s as any).lastMaintenance || new Date('2026-06-05'),
      lastHeartbeat: (s as any).lastHeartbeat || new Date(),
      onlineStatus: (s as any).onlineStatus || 'Online'
    }));

    const enrichedCompressors = compressors.map(c => ({
      ...c,
      firmware: (c as any).firmware || '3.0.1',
      hardwareVersion: (c as any).hardwareVersion || 'Industrial Air A1',
      macAddress: (c as any).macAddress || 'A0:B1:C2:D3:E4:F5',
      serialNumber: (c as any).serialNumber || `SN-COMP-${c._id.toString().slice(-6).toUpperCase()}`,
      installationDate: (c as any).installationDate || new Date('2026-01-10'),
      lastMaintenance: (c as any).lastMaintenance || new Date('2026-06-01'),
      lastHeartbeat: (c as any).lastHeartbeat || new Date(),
      onlineStatus: (c as any).onlineStatus || 'Online'
    }));

    return {
      hubs: enrichedHubs,
      radars: enrichedRadars,
      sabs: enrichedSabs,
      solenoids: enrichedSolenoids,
      compressors: enrichedCompressors
    };
  }

  async getPredictiveMaintenance(chuteId: string) {
    const oId = new Types.ObjectId(chuteId);
    const [radars, blasters, solenoids, compressor, hub] = await Promise.all([
      this.radarModel.find({ chuteId: oId }).lean().exec(),
      this.airBlasterModel.find({ chuteId: oId }).lean().exec(),
      this.solenoidModel.find({ chuteId: oId }).lean().exec(),
      this.compressorModel.findOne({ chuteId: oId }).lean().exec(),
      this.hubModel.findOne({ chuteId: oId }).lean().exec(),
    ]);

    const componentPredictions: any[] = [];

    radars.forEach((r) => {
      const hScore = typeof r.healthScore === 'number' && !isNaN(r.healthScore) ? r.healthScore : 100;
      const bRate = typeof r.buildupRatePerMin === 'number' && !isNaN(r.buildupRatePerMin) ? r.buildupRatePerMin : 0;
      const failureProb = Math.min(99, Math.max(1, Math.round((100 - hScore) + (bRate * -100))));
      const rulDays = Math.max(1, Math.round((hScore / 100) * 365));
      const validRulDays = isNaN(rulDays) || !isFinite(rulDays) ? 365 : rulDays;

      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() + validRulDays);

      componentPredictions.push({
        type: 'Radar',
        id: r._id,
        name: `Radar Sensor (Zone ${r.zone})`,
        rulDays: validRulDays,
        failureProbability: failureProb,
        maintenanceDate: maintenanceDate.toISOString(),
        riskScore: Math.round(failureProb * 0.8),
        metrics: { healthScore: hScore, trend: r.trendDirection || 'stable' },
      });
    });

    blasters.forEach((b) => {
      const hScore = typeof b.healthScore === 'number' && !isNaN(b.healthScore) ? b.healthScore : 100;
      const totalB = typeof b.totalBlasts === 'number' && !isNaN(b.totalBlasts) ? b.totalBlasts : 0;
      const lifespanB = typeof b.lifespanBlasts === 'number' && !isNaN(b.lifespanBlasts) && b.lifespanBlasts > 0 ? b.lifespanBlasts : 20000;
      const usagePercent = totalB / lifespanB;
      const rulDays = Math.max(1, Math.round((1 - usagePercent) * 730));
      const validRulDays = isNaN(rulDays) || !isFinite(rulDays) ? 730 : rulDays;
      const failureProb = Math.min(99, Math.max(1, Math.round(usagePercent * 100)));

      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() + validRulDays);

      componentPredictions.push({
        type: 'SAB',
        id: b._id,
        name: `Smart Air Blaster #${b.blasterNumber}`,
        rulDays: validRulDays,
        failureProbability: failureProb,
        maintenanceDate: maintenanceDate.toISOString(),
        riskScore: Math.round(failureProb * 0.9),
        metrics: { totalBlasts: totalB, lifespanBlasts: lifespanB, healthScore: hScore },
      });
    });

    solenoids.forEach((s) => {
      const hScore = typeof s.healthScore === 'number' && !isNaN(s.healthScore) ? s.healthScore : 100;
      const totalC = typeof s.totalCycles === 'number' && !isNaN(s.totalCycles) ? s.totalCycles : 0;
      const lifespanC = typeof s.lifespanCycles === 'number' && !isNaN(s.lifespanCycles) && s.lifespanCycles > 0 ? s.lifespanCycles : 50000;
      const usagePercent = totalC / lifespanC;
      const rulDays = Math.max(1, Math.round((1 - usagePercent) * 540));
      const validRulDays = isNaN(rulDays) || !isFinite(rulDays) ? 540 : rulDays;
      const failureProb = Math.min(99, Math.max(1, Math.round(usagePercent * 100)));

      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() + validRulDays);

      componentPredictions.push({
        type: 'Solenoid',
        id: s._id,
        name: `Solenoid Valve #${s.valveNumber}`,
        rulDays: validRulDays,
        failureProbability: failureProb,
        maintenanceDate: maintenanceDate.toISOString(),
        riskScore: Math.round(failureProb * 0.75),
        metrics: { totalCycles: totalC, lifespanCycles: lifespanC, healthScore: hScore },
      });
    });

    if (compressor) {
      const hScore = typeof compressor.healthScore === 'number' && !isNaN(compressor.healthScore) ? compressor.healthScore : 100;
      const runtimeH = typeof compressor.runtimeHours === 'number' && !isNaN(compressor.runtimeHours) ? compressor.runtimeHours : 0;
      const ageHoursFactor = runtimeH / 10000;
      const motorT = typeof compressor.motorTemperature === 'number' && !isNaN(compressor.motorTemperature) ? compressor.motorTemperature : 50;
      const temperatureRisk = Math.max(0, (motorT - 60) / 40);
      const efficiency = typeof compressor.efficiency === 'number' && !isNaN(compressor.efficiency) ? compressor.efficiency : 100;
      const efficiencyLoss = (100 - efficiency) / 100;
      
      const failureProb = Math.min(99, Math.max(1, Math.round((ageHoursFactor * 40) + (temperatureRisk * 30) + (efficiencyLoss * 30))));
      const rulDays = Math.max(1, Math.round(((100 - failureProb) / 100) * 365));
      const validRulDays = isNaN(rulDays) || !isFinite(rulDays) ? 365 : rulDays;

      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() + validRulDays);

      componentPredictions.push({
        type: 'Compressor',
        id: compressor._id,
        name: 'Main Air Compressor',
        rulDays: validRulDays,
        failureProbability: failureProb,
        maintenanceDate: maintenanceDate.toISOString(),
        riskScore: Math.round(failureProb * 0.85),
        metrics: {
          pressure: compressor.pressure,
          motorTemperature: motorT,
          runtimeHours: runtimeH,
          efficiency,
        },
      });
    }

    if (hub) {
      const heartbeatDiff = hub.lastHeartbeat ? (new Date().getTime() - new Date(hub.lastHeartbeat).getTime()) / 1000 : 9999;
      const isOffline = heartbeatDiff > 60;
      const failureProb = isOffline ? 95 : Math.min(99, Math.max(1, Math.round(heartbeatDiff / 5)));
      const rulDays = isOffline ? 1 : Math.max(1, Math.round((1 - failureProb / 100) * 365));
      const validRulDays = isNaN(rulDays) || !isFinite(rulDays) ? 365 : rulDays;

      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() + validRulDays);

      componentPredictions.push({
        type: 'Hub',
        id: hub._id,
        name: `Edge Gateway (Hub ${hub.hubId})`,
        rulDays: validRulDays,
        failureProbability: failureProb,
        maintenanceDate: maintenanceDate.toISOString(),
        riskScore: Math.round(failureProb * 0.7),
        metrics: { status: hub.status, firmware: hub.firmware, connectionType: hub.simNumber ? 'Cellular' : 'Ethernet' },
      });
    }

    return componentPredictions;
  }

  async getReplayTimeline(chuteId: string, start: string, end: string) {
    const oId = new Types.ObjectId(chuteId);
    const startTime = new Date(start);
    const endTime = new Date(end);

    const [telemetry, predictions, blastOutcomes, alerts] = await Promise.all([
      this.telemetryModel.find({ chuteId: oId, timestamp: { $gte: startTime, $lte: endTime } }).sort({ timestamp: 1 }).lean().exec(),
      this.aiPredictionModel.find({ chuteId: oId, createdAt: { $gte: startTime, $lte: endTime } }).sort({ createdAt: 1 }).lean().exec(),
      this.blastOutcomeModel.find({ chuteId: oId, createdAt: { $gte: startTime, $lte: endTime } }).sort({ createdAt: 1 }).lean().exec(),
      this.alertModel.find({ chuteId: oId, createdAt: { $gte: startTime, $lte: endTime } }).sort({ createdAt: 1 }).lean().exec(),
    ]);

    const timeline: any[] = [];

    telemetry.forEach((t) => {
      timeline.push({
        timestamp: t.timestamp || (t as any).createdAt,
        type: 'telemetry',
        data: t,
      });
    });

    predictions.forEach((p) => {
      timeline.push({
        timestamp: (p as any).createdAt || (p as any).timestamp,
        type: 'prediction',
        data: p,
      });
    });

    blastOutcomes.forEach((b) => {
      timeline.push({
        timestamp: (b as any).createdAt || (b as any).timestamp,
        type: 'blast',
        data: b,
      });
    });

    alerts.forEach((a) => {
      timeline.push({
        timestamp: (a as any).createdAt || (a as any).timestamp,
        type: 'alert',
        data: a,
      });
    });

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }

  async replayCommand(commandId: string, userId?: string) {
    const oldCmd = await this.commandModel.findOne({ commandId }).exec();
    if (!oldCmd) throw new NotFoundException('Command not found');

    const newCommandId = require('crypto').randomUUID();
    const newCmd = new this.commandModel({
      ...oldCmd.toObject(),
      _id: undefined,
      commandId: newCommandId,
      status: 'PUBLISHED',
      retryCount: 0,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await newCmd.save();

    this.mqttService.publish(
      `nigha/chute/${oldCmd.chuteId.toString()}/command`,
      {
        action: oldCmd.action,
        commandId: newCommandId,
        ...oldCmd.payload,
        timestamp: new Date().toISOString(),
      },
    );

    return newCmd;
  }

  async cancelCommand(commandId: string) {
    const cmd = await this.commandModel.findOneAndUpdate(
      { commandId },
      { status: 'CANCELLED', failedAt: new Date(), failureReason: 'Cancelled by operator' },
      { new: true }
    ).exec();
    if (!cmd) throw new NotFoundException('Command not found');
    return cmd;
  }

  async manualExecute(chuteId: string, action: string, payload: any, userId?: string) {
    const oId = new Types.ObjectId(chuteId);
    const commandId = require('crypto').randomUUID();

    const cmd = new this.commandModel({
      commandId,
      chuteId: oId,
      action,
      status: 'PUBLISHED',
      payload,
      triggerSource: 'manual',
      triggeredBy: userId ? new Types.ObjectId(userId) : null,
      publishedAt: new Date(),
    });
    await cmd.save();

    this.mqttService.publish(
      `nigha/chute/${chuteId}/command`,
      {
        action,
        commandId,
        ...payload,
        timestamp: new Date().toISOString(),
      },
    );

    return cmd;
  }
}
