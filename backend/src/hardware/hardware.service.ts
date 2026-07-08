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

    // Default threshold from generic profile
    const threshold = 1.1;

    for (let i = 0; i < radarValues.length; i++) {
      const zone = i + 1;
      const distance = radarValues[i];

      // Publish to MQTT to simulate physical sensor telemetry
      this.mqttService.publish(`nigha/chute/${chuteId}/radar`, {
        zone,
        distance,
        buildupDetected: distance < threshold,
      });
    }

    return {
      success: true,
      message: `Manually set radar telemetry for ${radarValues.length} zones. Auto-blast status: ${autoBlastEnabled ? 'ENABLED (system will attempt auto-clearing)' : 'DISABLED (enable via SAB configuration first)'}`,
      radarValues,
    };
  }
}
