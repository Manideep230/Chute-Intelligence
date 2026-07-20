import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createServer as createNetServer, Server as NetServer } from 'net';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { WebSocketServer, createWebSocketStream } from 'ws';
import {
  Chute,
  ChuteDocument,
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
  AuditLog,
  AuditLogDocument,
  AiPrediction,
  AiPredictionDocument,
  Webhook,
  WebhookDocument,
  BlastOutcome,
  BlastOutcomeDocument,
  ChuteUptimeLog,
  ChuteUptimeLogDocument,
  MaintenanceTicket,
  MaintenanceTicketDocument,
  Cell,
  CellDocument,
  Hub,
  HubDocument,
  Command,
  CommandDocument,
  SabConfiguration,
  SabConfigurationDocument,
} from '../database/schemas';
import { BlastService } from '../ai/blast.service';

// ─────────────────────────────────────────────────────────────────────────────
// Material-type sensitivity profiles for blockage prediction.
// Thresholds tuned to physical characteristics of each material.
// ─────────────────────────────────────────────────────────────────────────────
const MATERIAL_PROFILES: Record<
  string,
  {
    humidityBlockageBoost: number; // added to blockageProbability when humidity > 70%
    lowTempBoost: number; // added when temp < 10°C
    buildupDistanceThreshold: number; // metres — below this distance counts as buildup
    unnecessaryBlastThreshold: number; // max blockageProb below which a blast is "unnecessary"
  }
> = {
  coal: {
    humidityBlockageBoost: 35,
    lowTempBoost: 10,
    buildupDistanceThreshold: 1.2,
    unnecessaryBlastThreshold: 15,
  },
  iron_ore: {
    humidityBlockageBoost: 20,
    lowTempBoost: 5,
    buildupDistanceThreshold: 0.9,
    unnecessaryBlastThreshold: 10,
  },
  limestone: {
    humidityBlockageBoost: 30,
    lowTempBoost: 8,
    buildupDistanceThreshold: 1.1,
    unnecessaryBlastThreshold: 12,
  },
  grain: {
    humidityBlockageBoost: 40,
    lowTempBoost: 20,
    buildupDistanceThreshold: 1.3,
    unnecessaryBlastThreshold: 18,
  },
  generic: {
    humidityBlockageBoost: 25,
    lowTempBoost: 15,
    buildupDistanceThreshold: 1.0,
    unnecessaryBlastThreshold: 15,
  },
};

// Air volume estimation constant: litres consumed per solenoid cycle at 110 PSI
// (empirical estimate; adjustable per compressor config in future)
const AIR_LITRES_PER_SOLENOID_CYCLE = 12;

// Blast outcome scoring window (ms): how long to wait after a blast before sampling radar
const BLAST_OUTCOME_SAMPLE_DELAY_MS = 30_000;

// How many radar scans to consider in the rolling-window trend calculation
const TREND_WINDOW_SCANS = 10;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MqttService');
  private client: mqtt.MqttClient;
  private publishCount = 0;
  private subscribeCount = 0;
  private messageReceivedCount = 0;
  private failedPublishCount = 0;
  private reconnectCount = 0;
  private lastMessageTime: Date | null = null;
  private publishTimestamps = new Map<string, number>();
  private latencies: number[] = [];

  constructor(
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
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
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(Webhook.name) private webhookModel: Model<WebhookDocument>,
    @InjectModel(BlastOutcome.name)
    private blastOutcomeModel: Model<BlastOutcomeDocument>,
    @InjectModel(ChuteUptimeLog.name)
    private chuteUptimeLogModel: Model<ChuteUptimeLogDocument>,
    @InjectModel(MaintenanceTicket.name)
    private maintenanceTicketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(Cell.name) private cellModel: Model<CellDocument>,
    @InjectModel(Hub.name) private hubModel: Model<HubDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(SabConfiguration.name)
    private configModel: Model<SabConfigurationDocument>,
    private readonly blastService: BlastService,
  ) {
    console.log(`[ENTER] [MqttService] Constructor started.`);
  }

  async onModuleInit() {
    console.log(`[ENTER] [MqttService.onModuleInit] Initializing MqttService...`);
    try {
      await this.connectToBroker();
      console.log(`[EXIT] [MqttService.onModuleInit] MqttService successfully initialized.`);
    } catch (err: any) {
      console.error(`[ERROR] [MqttService.onModuleInit] Failure during onModuleInit:`, err);
      throw err;
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
    }
  }

  private async connectToBroker() {
    const isServerless =
      process.env.VERCEL ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NODE_ENV === 'production' ||
      process.env.DISABLE_PERSISTENT_MQTT === 'true';

    if (isServerless) {
      this.logger.log(
        'Running in serverless/Vercel/production context. Skipping persistent background MQTT connection.',
      );
      return;
    }
    const brokerUrl =
      process.env.MQTT_BROKER_URL ||
      'mqtts://g292ae11.ala.asia-southeast1.emqxsl.com:8883';
    const username = process.env.MQTT_BACKEND_USERNAME || 'pf086f1d';
    const password = process.env.MQTT_BACKEND_PASSWORD || 'PrE_6sIGv9Efa0zQ';

    this.logger.log(`Connecting to EMQX MQTT broker at ${brokerUrl}...`);
    this.client = mqtt.connect(brokerUrl, {
      clientId: `backend_service_${Math.random().toString(16).substr(2, 8)}`,
      keepalive: 60,
      username,
      password,
    });

    this.client.on('connect', () => {
      this.logger.log('Successfully connected to EMQX MQTT broker.');
      this.client.subscribe(['nigha/chute/+/+', 'domain/+/+/+/+/+/+/+/+/+'], { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Subscription error: ${err.message}`);
        } else {
          this.subscribeCount += 2;
          this.logger.log(
            'Subscribed to legacy (nigha/chute/+/+) and hierarchical (domain/+/+/+/+/+/+/+/+/+) topics',
          );
        }
      });
    });

    this.client.on('message', async (topic, payload) => {
      try {
        await this.handleIncomingMessage(topic, payload.toString());
      } catch (err) {
        this.logger.error(
          `Error processing MQTT message on topic ${topic}: ${err.message}`,
        );
      }
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT Client error: ${err.message}`);
      this.raiseBrokerFailureAlert(err.message);
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT Client connection closed.');
      this.raiseBrokerFailureAlert('Connection closed by broker');
    });

    this.client.on('reconnect', () => {
      this.reconnectCount++;
      this.logger.log('MQTT Client attempting to reconnect to broker...');
    });
  }

  private async raiseBrokerFailureAlert(reason: string) {
    try {
      if (this.alertModel.db.readyState !== 1) {
        this.logger.warn(
          `Database not connected. Skipping broker failure alert: ${reason}`,
        );
        return;
      }
      const existingAlert = await this.alertModel
        .findOne({
          source: 'System',
          message: `MQTT Broker Connection Failure: ${reason}`,
          isResolved: false,
        })
        .exec();

      if (!existingAlert) {
        const alert = new this.alertModel({
          severity: 'Critical',
          source: 'System',
          message: `MQTT Broker Connection Failure: ${reason}`,
          isResolved: false,
        });
        await alert.save();
        this.logger.error(`Raised broker failure alert in database: ${reason}`);
      }
    } catch (err) {
      this.logger.error(`Failed to raise broker failure alert: ${err.message}`);
    }
  }

  public async handleIncomingMessage(topic: string, payloadStr: string) {
    this.messageReceivedCount++;
    this.lastMessageTime = new Date();

    const parts = topic.split('/');
    if (parts.length === 0) return;

    let data: any;
    try {
      data = JSON.parse(payloadStr);
    } catch (e) {
      this.logger.error(`Failed to parse payload on topic ${topic}: ${e.message}`);
      return;
    }

    if (data && data.commandId) {
      const publishTime = this.publishTimestamps.get(data.commandId);
      if (publishTime) {
        const diff = Date.now() - publishTime;
        this.latencies.push(diff);
        if (this.latencies.length > 100) this.latencies.shift();
        this.publishTimestamps.delete(data.commandId);
      }
    }

    if (parts[0] === 'nigha' && parts[1] === 'chute' && parts.length >= 4) {
      const chuteId = parts[2];
      const type = parts[3];

      if (!Types.ObjectId.isValid(chuteId)) return;

      const oChuteId = new Types.ObjectId(chuteId);
      const chute = await this.chuteModel.findById(oChuteId).exec();
      if (!chute) {
        this.logger.warn(`Telemetry received for non-existent chute: ${chuteId}`);
        return;
      }

      await this.routeLegacyMessage(type, oChuteId, data);
    } else if (parts[0] === 'domain' && parts.length >= 9) {
      const plantId = parts[1];
      const hubId = parts[2];
      const passName = parts[3];
      const passKey = parts[4];
      const simNumber = parts[5];
      const sabId = parts[6];
      const solenoidValve = parts[7];
      const action = parts[8];

      // Authenticate Hub
      const hub = await this.hubModel.findOne({ hubId }).exec();
      if (!hub) {
        this.logger.warn(`Unknown Hub ID received on hierarchical topic: ${hubId}`);
        return;
      }

      if (hub.passName !== passName || hub.passKey !== passKey) {
        this.logger.warn(`Authentication failed for Hub: ${hubId}`);
        return;
      }

      // Update Hub Heartbeat
      await this.hubModel.findByIdAndUpdate(hub._id, {
        lastHeartbeat: new Date(),
        status: 'Online',
      }).exec();

      await this.routeHierarchicalMessage(action, hub, data, sabId, solenoidValve);
    }
  }

  private async routeLegacyMessage(type: string, chuteId: Types.ObjectId, data: any) {
    switch (type) {
      case 'radar':
        await this.handleRadarData(chuteId, data);
        break;
      case 'temperature':
        await this.handleTemperatureData(chuteId, data);
        break;
      case 'humidity':
        await this.handleHumidityData(chuteId, data);
        break;
      case 'compressor':
        await this.handleCompressorData(chuteId, data);
        break;
      case 'alert':
        await this.handleAlertData(chuteId, data);
        break;
      case 'health':
        await this.handleHealthData(chuteId, data);
        break;
      case 'location':
        await this.handleLocationData(chuteId, data);
        break;
      case 'blast':
        if (data.commandId) {
          const status = data.status || (data.success ? 'COMPLETED' : 'FAILED');
          const result = data.result || { success: data.success, reason: data.reason };
          await this.blastService.updateCommandStatus(data.commandId, status, result);
        }
        await this.handleBlastEvent(chuteId, data);
        break;
      default:
        this.logger.warn(`Unknown legacy topic type: ${type}`);
    }
  }

  private async routeHierarchicalMessage(
    action: string,
    hub: HubDocument,
    data: any,
    sabId: string,
    solenoidValve: string,
  ) {
    const chuteId = hub.chuteId;

    switch (action) {
      case 'telemetry':
        // Telemetry payload can contain radar, compressor, or env values
        if (data.radarValues) {
          // Process radar values sequentially to trigger prediction
          for (let i = 0; i < data.radarValues.length; i++) {
            await this.handleRadarData(chuteId, {
              zone: i + 1,
              distance: data.radarValues[i],
              buildupDetected: data.radarValues[i] < 1.0,
            });
          }
        }
        if (data.temperature !== undefined) {
          await this.handleTemperatureData(chuteId, { value: data.temperature });
        }
        if (data.humidity !== undefined) {
          await this.handleHumidityData(chuteId, { value: data.humidity });
        }
        if (data.pressure !== undefined || data.efficiency !== undefined) {
          await this.handleCompressorData(chuteId, data);
        }
        if (data.latitude !== undefined && data.longitude !== undefined) {
          await this.handleLocationData(chuteId, data);
        }
        break;

      case 'heartbeat':
        // Heartbeat is already processed (lastHeartbeat and status updated in caller)
        break;

      case 'status':
      case 'health':
        await this.handleHealthData(chuteId, data);
        break;

      case 'logs':
        await new this.auditLogModel({
          action: 'Hub Logs',
          details: `Hub ${hub.hubId} logs: ${JSON.stringify(data)}`,
        }).save();
        break;

      case 'warning':
      case 'fault':
        await this.handleAlertData(chuteId, {
          severity: data.severity || 'Medium',
          source: 'System',
          message: data.message || `Hub Fault reported: ${JSON.stringify(data)}`,
          isResolved: false,
        });
        break;

      case 'blast':
      case 'command':
        // Intercept Command ACK/Completion
        if (data.commandId) {
          const status = data.status || (data.success ? 'COMPLETED' : 'FAILED');
          const result = data.result || { success: data.success, reason: data.reason };
          await this.blastService.updateCommandStatus(data.commandId, status, result);
        }

        // Process Blast Event
        await this.handleBlastEvent(chuteId, {
          blasterNumber: data.blasterNumber || parseInt(sabId.replace('SAB', ''), 10) || 1,
          solenoidValves: data.solenoidValves || [parseInt(solenoidValve.replace('SV', ''), 10) || 1],
          success: data.success !== false,
          triggerMode: data.triggerMode || 'auto',
        });
        break;

      default:
        this.logger.warn(`Unknown action: ${action} on hierarchical topic for Hub: ${hub.hubId}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECT RADAR INJECTION (bypasses MQTT roundtrip)
  // Called from HardwareService.setRadarTelemetry() so that the full pipeline
  // (DB update → blockage localization publish → AI prediction → autonomous
  //  blast decision) runs even in serverless/Vercel environments where the
  //  backend has no persistent MQTT subscription to receive its own messages.
  // ───────────────────────────────────────────────────────────────────────────
  async injectRadarData(
    chuteId: Types.ObjectId,
    zone: number,
    distance: number,
    buildupDetected: boolean,
  ): Promise<void> {
    await this.handleRadarData(chuteId, { zone, distance, buildupDetected });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RADAR DATA HANDLER
  // Processes a single zone reading, computes trend rate, updates chute status,
  // logs uptime transitions, and re-runs the full AI prediction engine.
  // ───────────────────────────────────────────────────────────────────────────
  private async handleRadarData(chuteId: Types.ObjectId, data: any) {
    // Payload: { zone: 1..4, distance: number, buildupDetected: boolean }
    const { zone, distance, buildupDetected } = data;

    // Fetch existing radar record for this zone to compute trend rate
    const existingRadar = await this.radarModel
      .findOne({ chuteId, zone })
      .exec();
    const previousDistance = existingRadar ? existingRadar.distance : null;

    // Compute rate of change (m/min)
    let buildupRatePerMin = 0;
    let trendDirection: 'rising' | 'stable' | 'clearing' = 'stable';

    if (previousDistance !== null && existingRadar?.lastScanTime) {
      const elapsedSeconds =
        (Date.now() - new Date(existingRadar.lastScanTime).getTime()) / 1000;
      const elapsedMinutes = Math.max(elapsedSeconds / 60, 0.1);
      buildupRatePerMin = (distance - previousDistance) / elapsedMinutes;

      if (buildupRatePerMin < -0.02) {
        trendDirection = 'rising';
      } else if (buildupRatePerMin > 0.02) {
        trendDirection = 'clearing';
      } else {
        trendDirection = 'stable';
      }
    }

    // Persist radar record with trend data
    await this.radarModel
      .findOneAndUpdate(
        { chuteId, zone },
        {
          distance,
          buildupDetected,
          lastScanTime: new Date(),
          previousDistance: previousDistance ?? distance,
          buildupRatePerMin,
          trendDirection,
          ...(existingRadar?.calibrationBaselineDistance == null &&
          distance > 2.5
            ? { calibrationBaselineDistance: distance }
            : {}),
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    const chute = await this.chuteModel.findById(chuteId).exec();
    if (!chute) return;

    let activePath = chute.activePath || 'LEFT_SLANT';
    let blockagePosition = chute.blockagePosition || 'None';
    let blockageDistance = chute.blockageDistance ?? 3.5;
    let nearestSolenoidGroup = chute.nearestSolenoidGroup ?? 1;
    let newStatus =
      (chute.status as 'Normal' | 'Buildup' | 'Blocked' | 'Blasting') ||
      'Normal';

    // ── BLOCKAGE LOCALIZATION ENGINE (Production Mode Only) ──────────────────
    if (!chute.simulationMode) {
      const activeScans = await this.radarModel.find({ chuteId }).exec();
      const r1 = activeScans.find((r) => r.zone === 1)?.distance ?? 3.5;
      const r2 = activeScans.find((r) => r.zone === 2)?.distance ?? 3.5;
      const r3 = activeScans.find((r) => r.zone === 3)?.distance ?? 3.5;
      const r4 = activeScans.find((r) => r.zone === 4)?.distance ?? 3.5;

      const isLeftBlocked = r1 < 1.0 || r4 < 1.0;
      const isRightBlocked = r2 < 1.0 || r3 < 1.0;

      // 1. Determine active path based on blockage presence or lowest distance (flow)
      if (isLeftBlocked && !isRightBlocked) {
        activePath = 'LEFT_SLANT';
      } else if (isRightBlocked && !isLeftBlocked) {
        activePath = 'RIGHT_SLANT';
      } else {
        const minLeft = Math.min(r1, r4);
        const minRight = Math.min(r2, r3);
        if (minLeft < minRight) {
          activePath = 'LEFT_SLANT';
        } else if (minRight < minLeft) {
          activePath = 'RIGHT_SLANT';
        }
      }

      // 2. Overwrite inactive path's radars in database to keep digital twin greyed/clear
      if (activePath === 'LEFT_SLANT') {
        await this.radarModel
          .updateMany(
            { chuteId, zone: { $in: [2, 3] } },
            { distance: 3.5, buildupDetected: false },
          )
          .exec();

        const b1 = r1 < 1.0;
        const b4 = r4 < 1.0;
        if (b1 || b4) {
          if (r1 <= r4) {
            blockagePosition = 'Zone 1';
            blockageDistance = r1;
            nearestSolenoidGroup = 1;
            newStatus = r1 < 0.65 ? 'Blocked' : 'Buildup';
          } else {
            blockagePosition = 'Zone 4';
            blockageDistance = r4;
            nearestSolenoidGroup = 4;
            newStatus = r4 < 0.65 ? 'Blocked' : 'Buildup';
          }
        } else {
          blockagePosition = 'None';
          blockageDistance = Math.min(r1, r4);
          nearestSolenoidGroup = 1;
          newStatus = 'Normal';
        }
      } else {
        await this.radarModel
          .updateMany(
            { chuteId, zone: { $in: [1, 4] } },
            { distance: 3.5, buildupDetected: false },
          )
          .exec();

        const b2 = r2 < 1.0;
        const b3 = r3 < 1.0;
        if (b2 || b3) {
          if (r2 <= r3) {
            blockagePosition = 'Zone 2';
            blockageDistance = r2;
            nearestSolenoidGroup = 2;
            newStatus = r2 < 0.65 ? 'Blocked' : 'Buildup';
          } else {
            blockagePosition = 'Zone 3';
            blockageDistance = r3;
            nearestSolenoidGroup = 3;
            newStatus = r3 < 0.65 ? 'Blocked' : 'Buildup';
          }
        } else {
          blockagePosition = 'None';
          blockageDistance = Math.min(r2, r3);
          nearestSolenoidGroup = 2;
          newStatus = 'Normal';
        }
      }

      // Preserve 'Blasting' status transition delay
      const updatedFields: any = {
        activePath,
        blockagePosition,
        blockageDistance,
        nearestSolenoidGroup,
      };
      if (chute.status !== 'Blasting') {
        updatedFields.status = newStatus;
      }
      const updatedChute = await this.chuteModel
        .findByIdAndUpdate(chuteId, updatedFields, { new: true })
        .exec();

      // Publish the calculated localization telemetry over MQTT in real time
      await this.publish(`nigha/chute/${chuteId}/localization`, {
        activePath,
        simulationMode: false,
        blockagePosition,
        blockageDistance,
        nearestSolenoidGroup,
        status: updatedChute?.status || newStatus,
      });
    } else {
      // In Manual Mode, newStatus is simply the chute's current status
      newStatus = chute.status as any;
    }

    // ── Uptime Log Transition ──────────────────────────────────────────────
    if (chute.status !== 'Blasting' && chute.status !== newStatus) {
      await this.recordStatusTransition(
        chuteId,
        chute.status as any,
        newStatus,
        'radar_detection',
      );
    }

    // ── Insert telemetry log entry ─────────────────────────────────────────
    const updatedScans = await this.radarModel.find({ chuteId }).exec();
    const distances = [0, 0, 0, 0];
    updatedScans.forEach((r) => {
      distances[r.zone - 1] = r.distance;
    });

    const latestTelemetry = await this.telemetryModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();
    const newTelemetry = new this.telemetryModel({
      chuteId,
      radarValues: distances,
      temperature: latestTelemetry ? latestTelemetry.temperature : 25,
      humidity: latestTelemetry ? latestTelemetry.humidity : 50,
      pressure: latestTelemetry ? latestTelemetry.pressure : 100,
    });
    await newTelemetry.save();

    // ── Sensor drift detection ─────────────────────────────────────────────
    if (newStatus === 'Normal' && distance < 0.05) {
      await this.handleAlertData(chuteId, {
        severity: 'Medium',
        source: 'Radar',
        message: `Zone ${zone} sensor may be drifting: reading ${distance.toFixed(3)}m while chute status is Normal. Calibration check recommended.`,
        isResolved: false,
      });
    }

    // ── Run full AI prediction engine ──────────────────────────────────────
    await this.runAiPrediction(chuteId);
  }

  private async handleTemperatureData(chuteId: Types.ObjectId, data: any) {
    // Payload: { value: number }
    const { value } = data;
    const latestTelemetry = await this.telemetryModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();

    const newTelemetry = new this.telemetryModel({
      chuteId,
      radarValues: latestTelemetry ? latestTelemetry.radarValues : [0, 0, 0, 0],
      temperature: value,
      humidity: latestTelemetry ? latestTelemetry.humidity : 50,
      pressure: latestTelemetry ? latestTelemetry.pressure : 100,
    });
    await newTelemetry.save();
    await this.runAiPrediction(chuteId);
  }

  private async handleHumidityData(chuteId: Types.ObjectId, data: any) {
    // Payload: { value: number }
    const { value } = data;
    const latestTelemetry = await this.telemetryModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();

    const newTelemetry = new this.telemetryModel({
      chuteId,
      radarValues: latestTelemetry ? latestTelemetry.radarValues : [0, 0, 0, 0],
      temperature: latestTelemetry ? latestTelemetry.temperature : 25,
      humidity: value,
      pressure: latestTelemetry ? latestTelemetry.pressure : 100,
    });
    await newTelemetry.save();
    await this.runAiPrediction(chuteId);
  }

  private async handleCompressorData(chuteId: Types.ObjectId, data: any) {
    // Payload: { pressure, runtimeHours, refillDuration, refillFrequency, motorTemperature, efficiency, healthScore }
    await this.compressorModel
      .findOneAndUpdate(
        { chuteId },
        { ...data },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    // Update telemetry with new pressure
    const latestTelemetry = await this.telemetryModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();
    const newTelemetry = new this.telemetryModel({
      chuteId,
      radarValues: latestTelemetry ? latestTelemetry.radarValues : [0, 0, 0, 0],
      temperature: latestTelemetry ? latestTelemetry.temperature : 25,
      humidity: latestTelemetry ? latestTelemetry.humidity : 50,
      pressure: data.pressure,
    });
    await newTelemetry.save();
    await this.runAiPrediction(chuteId);
  }

  private async handleAlertData(chuteId: Types.ObjectId, data: any) {
    // Payload: { severity: 'Low'|'Medium'|'High'|'Critical', source: 'Radar'|'Compressor'|'Solenoid'|'System', message: string, isResolved: boolean }
    const { severity, source, message, isResolved } = data;

    const alert = await this.alertModel
      .findOneAndUpdate(
        { chuteId, source, message, isResolved: false },
        {
          severity,
          isResolved,
          resolvedAt: isResolved ? new Date() : null,
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    if (!isResolved) {
      // Create system audit log
      const audit = new this.auditLogModel({
        action: 'Hardware Alert',
        details: `Chute Alert: [${severity}] Source: ${source}. Message: ${message}`,
      });
      await audit.save();

      // Trigger Webhook Event
      await this.triggerOutboundWebhooks('alert.created', {
        alertId: alert._id,
        chuteId,
        severity,
        source,
        message,
        createdAt: (alert as any).createdAt || new Date(),
      });

      // Trigger notifications to users assigned to this chute
      const users = await this.chuteModel.db.model('User').find().exec();
      for (const u of users) {
        const notif = new this.notificationModel({
          userId: u._id,
          alertId: alert._id,
          title: `Chute Alert: ${severity}`,
          body: `${source}: ${message}`,
          channels: ['in-app', 'browser'],
          status: 'sent',
        });
        await notif.save();
      }
    }
  }

  private async handleHealthData(chuteId: Types.ObjectId, data: any) {
    // Payload: { isOnline: boolean, localLogsCount: number }
    const { isOnline, localLogsCount } = data;
    await this.hubHealthModel
      .findOneAndUpdate(
        { chuteId },
        { isOnline, localLogsCount, lastPing: new Date() },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
  }

  private async handleLocationData(chuteId: Types.ObjectId, data: any) {
    // Payload: { latitude: number, longitude: number }
    const { latitude, longitude } = data;
    await this.gpsLocationModel.create({
      chuteId,
      latitude,
      longitude,
      timestamp: new Date(),
    });

    // Update chute's general GPS location as well
    await this.chuteModel
      .findByIdAndUpdate(chuteId, {
        gpsCoordinates: { lat: latitude, lng: longitude },
      })
      .exec();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLAST EVENT HANDLER
  // Records blast, tracks solenoid/blaster wear, logs air consumption,
  // schedules a 30s post-blast radar sample to score blast effectiveness,
  // and auto-escalates if consecutive blasts are failing.
  // ───────────────────────────────────────────────────────────────────────────
  private async handleBlastEvent(chuteId: Types.ObjectId, data: any) {
    // Payload: { blasterNumber: 1..4, solenoidValves: number[], success: boolean, triggerMode?: 'manual'|'auto' }
    const {
      blasterNumber,
      solenoidValves,
      success,
      triggerMode = 'manual',
    } = data;

    // Temporarily set chute status to Blasting
    const chuteBefore = await this.chuteModel.findById(chuteId).exec();
    if (chuteBefore && chuteBefore.status !== 'Blasting') {
      await this.recordStatusTransition(
        chuteId,
        chuteBefore.status as any,
        'Blasting',
        'blast_clearance',
      );
    }
    await this.chuteModel
      .findByIdAndUpdate(chuteId, { status: 'Blasting' })
      .exec();

    // ── Update air blaster wear ────────────────────────────────────────────
    const blaster = await this.airBlasterModel
      .findOne({ chuteId, blasterNumber })
      .exec();
    if (blaster) {
      blaster.totalBlasts += 1;
      blaster.healthScore = Math.max(
        0,
        Math.round((1 - blaster.totalBlasts / blaster.lifespanBlasts) * 100),
      );
      blaster.lastBlastTime = new Date();
      await blaster.save();
    } else {
      await this.airBlasterModel.create({
        chuteId,
        blasterNumber,
        totalBlasts: 1,
        lifespanBlasts: 20000,
        healthScore: 99,
        lastBlastTime: new Date(),
      });
    }

    // ── Update solenoid wear ───────────────────────────────────────────────
    for (const valveNo of solenoidValves) {
      const solenoid = await this.solenoidModel
        .findOne({ chuteId, valveNumber: valveNo })
        .exec();
      if (solenoid) {
        solenoid.totalCycles += 1;
        solenoid.healthScore = Math.max(
          0,
          Math.round(
            (1 - solenoid.totalCycles / solenoid.lifespanCycles) * 100,
          ),
        );
        solenoid.lastCycleTime = new Date();
        await solenoid.save();
      } else {
        await this.solenoidModel.create({
          chuteId,
          valveNumber: valveNo,
          totalCycles: 1,
          lifespanCycles: 50000,
          healthScore: 99,
          lastCycleTime: new Date(),
        });
      }
    }

    // ── Estimate air consumption ───────────────────────────────────────────
    const estimatedAirLitres =
      solenoidValves.length * AIR_LITRES_PER_SOLENOID_CYCLE;
    const compressor = await this.compressorModel.findOne({ chuteId }).exec();

    // ── Capture pre-blast radar distances ─────────────────────────────────
    const preBlastRadars = await this.radarModel
      .find({ chuteId })
      .sort({ zone: 1 })
      .exec();
    const preBlastDistances = [0, 0, 0, 0];
    preBlastRadars.forEach((r) => {
      preBlastDistances[r.zone - 1] = r.distance;
    });

    // Check if this is an unnecessary blast (low blockage probability context)
    const prediction = await this.aiPredictionModel.findOne({ chuteId }).exec();
    const currentBlockageProb = prediction?.blockageProbability ?? 0;
    const materialProfile =
      MATERIAL_PROFILES[chuteBefore?.materialType || 'generic'];
    const isUnnecessaryBlast =
      currentBlockageProb < materialProfile.unnecessaryBlastThreshold;

    // ── Create BlastOutcome record (will be scored after 30s) ─────────────
    const blastOutcomeRecord = await this.blastOutcomeModel.create({
      chuteId,
      blasterNumber,
      solenoidValves,
      preBlastDistances,
      postBlastDistances: [],
      effectivenessScore: -1, // pending
      triggerMode,
      didClear: false,
      estimatedAirLitres,
      consecutiveFailedBlastCount: 0,
    });

    // ── Update compressor air consumption stats ────────────────────────────
    if (compressor) {
      const newTotal = compressor.totalAirLitresConsumed + estimatedAirLitres;
      const recentBlasts = await this.blastOutcomeModel
        .find({ chuteId })
        .sort({ createdAt: -1 })
        .limit(50)
        .exec();
      const avgLitres =
        recentBlasts.length > 0
          ? recentBlasts.reduce((sum, b) => sum + b.estimatedAirLitres, 0) /
            recentBlasts.length
          : estimatedAirLitres;

      await this.compressorModel
        .findOneAndUpdate(
          { chuteId },
          {
            totalAirLitresConsumed: newTotal,
            airLitresPerBlastAvg: Math.round(avgLitres),
            ...(isUnnecessaryBlast
              ? { $inc: { unnecessaryBlastsCount: 1 } }
              : {}),
          },
        )
        .exec();
    }

    // ── Increment total blasts on chute ───────────────────────────────────
    await this.chuteModel
      .findByIdAndUpdate(chuteId, { $inc: { totalBlasts: 1 } })
      .exec();

    // ── Audit log ─────────────────────────────────────────────────────────
    const audit = new this.auditLogModel({
      action: 'Blast Trigger',
      details: `Air Blaster #${blasterNumber} triggered on Chute ${chuteId} via ${triggerMode} with Solenoids ${solenoidValves.join(',')}. Air: ~${estimatedAirLitres}L. Status: ${success ? 'Success' : 'Failed'}`,
    });
    await audit.save();

    if (success) {
      await this.triggerOutboundWebhooks('blast.success', {
        chuteId,
        blasterNumber,
        solenoidValves,
        estimatedAirLitres,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Schedule post-blast radar sample after 30s ─────────────────────────
    // Compares pre vs post distances to score effectiveness (0–100)
    setTimeout(async () => {
      try {
        await this.scoreBlastOutcome(
          chuteId,
          blastOutcomeRecord._id,
          preBlastDistances,
          isUnnecessaryBlast,
        );
      } catch (err) {
        this.logger.error(`Error scoring blast outcome: ${err.message}`);
      }
    }, BLAST_OUTCOME_SAMPLE_DELAY_MS);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLAST OUTCOME SCORING
  // Runs 30s after a blast. Reads current radar distances and computes
  // effectiveness score. Triggers escalation if consecutive failures detected.
  // ───────────────────────────────────────────────────────────────────────────
  private async scoreBlastOutcome(
    chuteId: Types.ObjectId,
    blastOutcomeId: Types.ObjectId,
    preBlastDistances: number[],
    wasUnnecessary: boolean,
  ) {
    const postBlastRadars = await this.radarModel
      .find({ chuteId })
      .sort({ zone: 1 })
      .exec();
    const postBlastDistances = [0, 0, 0, 0];
    postBlastRadars.forEach((r) => {
      postBlastDistances[r.zone - 1] = r.distance;
    });

    // ── Compute effectiveness score ────────────────────────────────────────
    // Score = average of per-zone improvement percentages
    // Zones that were already clear (>= 2.5m) are excluded from scoring
    const zoneScores: number[] = [];
    for (let i = 0; i < 4; i++) {
      const pre = preBlastDistances[i];
      const post = postBlastDistances[i];
      if (pre >= 2.5) continue; // Zone was already clear — skip
      const maxPossibleGain = 3.5 - pre; // assume 3.5m = full clear chute
      if (maxPossibleGain <= 0) continue;
      const actualGain = Math.max(0, post - pre);
      const zoneScore = Math.min(100, (actualGain / maxPossibleGain) * 100);
      zoneScores.push(zoneScore);
    }

    let effectivenessScore = 0;
    if (zoneScores.length === 0) {
      // All zones were already clear — blast was likely unnecessary
      effectivenessScore = wasUnnecessary ? 0 : 50; // benefit of the doubt if preventive
    } else {
      effectivenessScore = Math.round(
        zoneScores.reduce((a, b) => a + b, 0) / zoneScores.length,
      );
    }

    const didClear = effectivenessScore >= 50;

    // ── Update BlastOutcome record ─────────────────────────────────────────
    await this.blastOutcomeModel
      .findByIdAndUpdate(blastOutcomeId, {
        postBlastDistances,
        effectivenessScore,
        didClear,
      })
      .exec();

    // ── Update chute consecutive failed blasts counter ─────────────────────
    const chute = await this.chuteModel.findById(chuteId).exec();
    let consecutiveFailedBlasts = chute?.consecutiveFailedBlasts ?? 0;

    if (didClear) {
      // Blast succeeded — reset counter
      consecutiveFailedBlasts = 0;
      await this.chuteModel
        .findByIdAndUpdate(chuteId, { consecutiveFailedBlasts: 0 })
        .exec();
    } else {
      consecutiveFailedBlasts += 1;
      await this.chuteModel
        .findByIdAndUpdate(chuteId, { consecutiveFailedBlasts })
        .exec();

      // Auto-escalate: 2+ consecutive failed blasts = Critical alert
      if (consecutiveFailedBlasts >= 2) {
        await this.handleAlertData(chuteId, {
          severity: 'Critical',
          source: 'System',
          message: `${consecutiveFailedBlasts} consecutive blasts have failed to clear this chute (last score: ${effectivenessScore}/100). Manual inspection required.`,
          isResolved: false,
        });

        // Auto-create maintenance ticket if not already open
        const existingTicket = await this.maintenanceTicketModel
          .findOne({
            chuteId,
            status: { $in: ['Open', 'In Progress'] },
            description: { $regex: /consecutive blast/i },
          })
          .exec();

        if (!existingTicket) {
          await this.maintenanceTicketModel.create({
            chuteId,
            assetType: 'Sensor',
            assetId: chuteId,
            description: `AUTO: ${consecutiveFailedBlasts} consecutive failed blasts detected. Chute requires physical inspection and potential sensor recalibration.`,
            status: 'Open',
          });
          this.logger.warn(
            `Auto-created maintenance ticket for chute ${chuteId} — ${consecutiveFailedBlasts} consecutive failed blasts`,
          );
        }
      }
    }

    // ── Update BlastOutcome with consecutive count ─────────────────────────
    await this.blastOutcomeModel
      .findByIdAndUpdate(blastOutcomeId, {
        consecutiveFailedBlastCount: consecutiveFailedBlasts,
      })
      .exec();

    // ── Re-evaluate chute status after blast scoring ───────────────────────
    const activeScans = await this.radarModel.find({ chuteId }).exec();
    const materialProfile = MATERIAL_PROFILES[chute?.materialType || 'generic'];
    const buildupCount = activeScans.filter(
      (r) => r.distance < materialProfile.buildupDistanceThreshold,
    ).length;
    const newStatus =
      buildupCount === 4 ? 'Blocked' : buildupCount > 0 ? 'Buildup' : 'Normal';

    if (chute && chute.status !== newStatus) {
      await this.recordStatusTransition(
        chuteId,
        'Blasting',
        newStatus,
        'blast_clearance',
      );
    }
    await this.chuteModel
      .findByIdAndUpdate(chuteId, { status: newStatus })
      .exec();

    // ── Update AI prediction with latest blast score ───────────────────────
    await this.runAiPrediction(chuteId);

    this.logger.log(
      `Blast scored for chute ${chuteId}: ${effectivenessScore}/100 (${didClear ? 'CLEARED' : 'FAILED'})`,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STATUS TRANSITION RECORDER
  // Closes the current open uptime log entry and opens a new one.
  // ───────────────────────────────────────────────────────────────────────────
  private async recordStatusTransition(
    chuteId: Types.ObjectId,
    fromStatus: 'Normal' | 'Buildup' | 'Blocked' | 'Blasting',
    toStatus: 'Normal' | 'Buildup' | 'Blocked' | 'Blasting',
    cause: string,
  ) {
    const now = new Date();

    // Close the currently-open log entry for the previous status
    const openLog = await this.chuteUptimeLogModel
      .findOne({
        chuteId,
        status: fromStatus,
        exitedAt: null,
      })
      .sort({ enteredAt: -1 })
      .exec();

    if (openLog) {
      const durationSeconds = Math.round(
        (now.getTime() - new Date(openLog.enteredAt).getTime()) / 1000,
      );
      await this.chuteUptimeLogModel
        .findByIdAndUpdate(openLog._id, {
          exitedAt: now,
          durationSeconds,
        })
        .exec();
    }

    // Open a new log entry for the new status
    await this.chuteUptimeLogModel.create({
      chuteId,
      status: toStatus,
      enteredAt: now,
      transitionCause: cause,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AI PREDICTION ENGINE (v2)
  // Runs on every radar, temperature, humidity, and compressor data event.
  //
  // Intelligence improvements over v1:
  //  1. Material-specific thresholds instead of global constants
  //  2. Rolling-window trend rate incorporated into blockage probability
  //  3. Uptime % and blockage minutes computed from ChuteUptimeLog
  //  4. Last blast effectiveness score pulled from BlastOutcome
  //  5. Air consumption tracked today
  //  6. Auto-maintenance ticket creation at health thresholds
  // ───────────────────────────────────────────────────────────────────────────
  private async runAiPrediction(chuteId: Types.ObjectId) {
    const chute = await this.chuteModel.findById(chuteId).exec();
    const materialProfile = MATERIAL_PROFILES[chute?.materialType || 'generic'];

    const blasters = await this.airBlasterModel.find({ chuteId }).exec();
    const solenoids = await this.solenoidModel.find({ chuteId }).exec();
    const compressor = await this.compressorModel.findOne({ chuteId }).exec();
    const latestTelemetry = await this.telemetryModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();
    const activeScans = await this.radarModel.find({ chuteId }).exec();

    // ── 1. Blockage Probability (material-aware + trend-aware) ─────────────
    let blockageProb = 5; // base 5%

    if (latestTelemetry) {
      if (latestTelemetry.humidity > 70)
        blockageProb += materialProfile.humidityBlockageBoost;
      if (latestTelemetry.temperature < 10)
        blockageProb += materialProfile.lowTempBoost;

      // Count zones below material-specific buildup threshold
      const radarBuildups = latestTelemetry.radarValues.filter(
        (v) => v < materialProfile.buildupDistanceThreshold,
      ).length;
      blockageProb += radarBuildups * 15;
    }

    // Factor in trend rate: each zone with "rising" trend adds to probability
    let avgBuildupRate = 0;
    const overallTrendVotes = { rising: 0, stable: 0, clearing: 0 };
    if (activeScans.length > 0) {
      activeScans.forEach((r) => {
        avgBuildupRate += r.buildupRatePerMin;
        overallTrendVotes[r.trendDirection as keyof typeof overallTrendVotes]++;
        // Rising trend amplifies probability
        if (r.trendDirection === 'rising') blockageProb += 10;
        // Clearing trend reduces probability
        if (r.trendDirection === 'clearing')
          blockageProb = Math.max(5, blockageProb - 5);
      });
      avgBuildupRate = avgBuildupRate / activeScans.length;
    }

    // Determine overall chute trend (majority vote)
    const overallTrend =
      overallTrendVotes.rising > overallTrendVotes.clearing &&
      overallTrendVotes.rising > overallTrendVotes.stable
        ? 'rising'
        : overallTrendVotes.clearing > overallTrendVotes.stable
          ? 'clearing'
          : 'stable';

    blockageProb = Math.min(100, Math.round(blockageProb));

    // ── 2. Compressor Failure Probability ─────────────────────────────────
    let compFailProb = 2;
    if (compressor) {
      compFailProb += (100 - compressor.efficiency) * 0.5;
      if (compressor.motorTemperature > 85) compFailProb += 30;
      if (compressor.refillFrequency > 10) compFailProb += 20;
    }
    compFailProb = Math.min(100, Math.round(compFailProb));

    // ── 3. Solenoid Wear Probability ───────────────────────────────────────
    let avgSolenoidHealth = 100;
    if (solenoids.length > 0) {
      avgSolenoidHealth =
        solenoids.reduce((acc, s) => acc + s.healthScore, 0) / solenoids.length;
    }
    const solenoidWearProb = Math.round(100 - avgSolenoidHealth);

    // ── 4. Air Blaster Maintenance Probability ─────────────────────────────
    let avgBlasterHealth = 100;
    if (blasters.length > 0) {
      avgBlasterHealth =
        blasters.reduce((acc, b) => acc + b.healthScore, 0) / blasters.length;
    }
    const blasterMaintProb = Math.round(100 - avgBlasterHealth);

    // ── 5. Uptime % (last 24h) from ChuteUptimeLog ─────────────────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const uptimeLogs = await this.chuteUptimeLogModel
      .find({
        chuteId,
        enteredAt: { $gte: since24h },
      })
      .exec();

    let normalSeconds = 0;
    let blockedSeconds = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const log of uptimeLogs) {
      const dur =
        log.durationSeconds ??
        Math.round((Date.now() - new Date(log.enteredAt).getTime()) / 1000);
      if (log.status === 'Normal' || log.status === 'Blasting')
        normalSeconds += dur;
      if (log.status === 'Blocked' && new Date(log.enteredAt) >= today)
        blockedSeconds += dur;
    }

    const totalSeconds24h = 24 * 60 * 60;
    const uptimePercent24h = Math.min(
      100,
      Math.round((normalSeconds / totalSeconds24h) * 100),
    );
    const blockageMinutesToday = Math.round(blockedSeconds / 60);

    // ── 6. Air litres today ────────────────────────────────────────────────
    const todayBlasts = await this.blastOutcomeModel
      .find({
        chuteId,
        createdAt: { $gte: today },
      })
      .exec();
    const airLitresToday = todayBlasts.reduce(
      (sum, b) => sum + b.estimatedAirLitres,
      0,
    );

    // ── 7. Last blast effectiveness score ─────────────────────────────────
    const lastBlast = await this.blastOutcomeModel
      .findOne({ chuteId })
      .sort({ createdAt: -1 })
      .exec();
    const lastBlastEffectivenessScore = lastBlast?.effectivenessScore ?? -1;
    const consecutiveFailedBlasts = chute?.consecutiveFailedBlasts ?? 0;

    // ── 8. Recommended Actions ─────────────────────────────────────────────
    const recommendedActions: string[] = [];

    if (blockageProb > 60) {
      recommendedActions.push(
        'Initiate preventive air blast cycle to clear accumulation.',
      );
    }
    if (overallTrend === 'rising' && blockageProb > 40) {
      recommendedActions.push(
        'Buildup rate is increasing — monitor closely. Consider preventive blast.',
      );
    }
    if (compFailProb > 40) {
      recommendedActions.push(
        'Inspect compressor motor cooling seals and log efficiency.',
      );
    }
    if (solenoidWearProb > 30) {
      recommendedActions.push(
        'Schedule replacement/seal service for wear-prone solenoid valves.',
      );
    }
    if (blasterMaintProb > 30) {
      recommendedActions.push(
        'Perform diagnostic trigger test on air blasters.',
      );
    }
    if (consecutiveFailedBlasts >= 2) {
      recommendedActions.push(
        `CRITICAL: ${consecutiveFailedBlasts} consecutive blasts have not cleared this chute. Manual inspection required immediately.`,
      );
    }
    if (compressor && compressor.unnecessaryBlastsCount > 10) {
      recommendedActions.push(
        `Compressor efficiency warning: ${compressor.unnecessaryBlastsCount} unnecessary blasts detected. Review blast trigger thresholds.`,
      );
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push(
        'System operating nominally. No immediate action required.',
      );
    }

    // ── 9. Persist updated prediction ─────────────────────────────────────
    await this.aiPredictionModel
      .findOneAndUpdate(
        { chuteId },
        {
          blockageProbability: blockageProb,
          compressorFailureProbability: compFailProb,
          solenoidWearProbability: solenoidWearProb,
          airBlasterMaintenanceProbability: blasterMaintProb,
          recommendedActions,
          buildupRatePerMin: Math.round(avgBuildupRate * 1000) / 1000,
          overallTrend,
          lastBlastEffectivenessScore,
          consecutiveFailedBlasts,
          uptimePercent24h,
          blockageMinutesToday,
          airLitresToday,
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    // ── 9.5 Publish AI Prediction to MQTT ───────────────────────────────────
    const predictionPayload = {
      blockageProbability: blockageProb,
      compressorFailureProbability: compFailProb,
      solenoidWearProbability: solenoidWearProb,
      airBlasterMaintenanceProbability: blasterMaintProb,
      recommendedActions,
      buildupRatePerMin: Math.round(avgBuildupRate * 1000) / 1000,
      overallTrend,
      lastBlastEffectivenessScore,
      consecutiveFailedBlasts,
      uptimePercent24h,
      blockageMinutesToday,
      airLitresToday,
      timestamp: new Date().toISOString(),
    };

    await this.publish(`nigha/chute/${chuteId}/prediction`, predictionPayload);

    const activeHub = await this.hubModel.findOne({ chuteId }).exec();
    if (activeHub) {
      await this.publish(
        `domain/${activeHub.plantId || 'PLANT01'}/${activeHub.hubId}/${activeHub.passName}/${activeHub.passKey}/${activeHub.simNumber || '9999999999'}/SAB1/SV1/prediction`,
        predictionPayload,
      );
    }

    // ── 10. Auto-maintenance ticket creation from health thresholds ────────
    await this.autoCreateMaintenanceTickets(
      chuteId,
      blasters,
      solenoids,
      compressor,
    );

    // ── 11. Run autonomous decision engine ──────────────────────────────────
    try {
      const { decision, command } = await this.blastService.evaluateAndPrepare(chuteId);
      if (command) {
        await this.publish(`nigha/chute/${chuteId}/command`, {
          action: 'blast',
          commandId: command.commandId,
          blasterNumber: command.sabNumber,
          solenoidValves: command.solenoidNumbers,
          blastDurationMs: command.blastDurationMs,
          requiredPressure: command.requiredPressurePsi,
          timestamp: command.timestamp,
        });
        await this.blastService.updateCommandStatus(command.commandId, 'PUBLISHED');
      }
    } catch (err) {
      this.logger.error(`Error running autonomous blast engine: ${err.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AUTO-MAINTENANCE TICKET CREATION
  // Creates tickets when component health falls below critical thresholds.
  // Prevents duplicate tickets by checking for existing Open/In Progress tickets.
  // ───────────────────────────────────────────────────────────────────────────
  private async autoCreateMaintenanceTickets(
    chuteId: Types.ObjectId,
    blasters: AirBlasterDocument[],
    solenoids: SolenoidDocument[],
    compressor: CompressorDocument | null,
  ) {
    // Check each blaster
    for (const blaster of blasters) {
      if (blaster.healthScore < 30) {
        const existing = await this.maintenanceTicketModel
          .findOne({
            chuteId,
            assetType: 'AirBlaster',
            assetId: blaster._id,
            status: { $in: ['Open', 'In Progress'] },
          })
          .exec();

        if (!existing) {
          await this.maintenanceTicketModel.create({
            chuteId,
            assetType: 'AirBlaster',
            assetId: blaster._id,
            description: `AUTO: Air Blaster #${blaster.blasterNumber} health at ${blaster.healthScore}% (${blaster.totalBlasts}/${blaster.lifespanBlasts} blasts used). Schedule maintenance before next blockage event.`,
            status: 'Open',
          });
          this.logger.log(
            `Auto-created AirBlaster #${blaster.blasterNumber} maintenance ticket (health: ${blaster.healthScore}%)`,
          );
        }
      }
    }

    // Check each solenoid
    for (const solenoid of solenoids) {
      if (solenoid.healthScore < 25) {
        const existing = await this.maintenanceTicketModel
          .findOne({
            chuteId,
            assetType: 'Solenoid',
            assetId: solenoid._id,
            status: { $in: ['Open', 'In Progress'] },
          })
          .exec();

        if (!existing) {
          await this.maintenanceTicketModel.create({
            chuteId,
            assetType: 'Solenoid',
            assetId: solenoid._id,
            description: `AUTO: Solenoid Valve #${solenoid.valveNumber} health at ${solenoid.healthScore}% (${solenoid.totalCycles}/${solenoid.lifespanCycles} cycles used). Replace seals to prevent blast failure.`,
            status: 'Open',
          });
          this.logger.log(
            `Auto-created Solenoid #${solenoid.valveNumber} maintenance ticket (health: ${solenoid.healthScore}%)`,
          );
        }
      }
    }

    // Check compressor
    if (compressor && compressor.efficiency < 85) {
      const existing = await this.maintenanceTicketModel
        .findOne({
          chuteId,
          assetType: 'Compressor',
          assetId: compressor._id,
          status: { $in: ['Open', 'In Progress'] },
        })
        .exec();

      if (!existing) {
        await this.maintenanceTicketModel.create({
          chuteId,
          assetType: 'Compressor',
          assetId: compressor._id,
          description: `AUTO: Compressor efficiency at ${compressor.efficiency}%. Motor temperature: ${compressor.motorTemperature}°C. Total air consumed: ${compressor.totalAirLitresConsumed}L. Inspect cooling system and seals.`,
          status: 'Open',
        });
        this.logger.log(
          `Auto-created Compressor maintenance ticket (efficiency: ${compressor.efficiency}%)`,
        );
      }
    }
  }

  public async publish(topic: string, payload: any): Promise<void> {
    this.publishCount++;
    if (payload && payload.commandId) {
      this.publishTimestamps.set(payload.commandId, Date.now());
    }

    if (this.client && this.client.connected) {
      await new Promise<void>((resolve) => {
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) {
            this.failedPublishCount++;
            this.logger.error(
              `Failed to publish to ${topic} on EMQX: ${err.message}`,
            );
          } else {
            this.logger.log(
              `Published command to ${topic} on EMQX: ${JSON.stringify(payload)}`,
            );
          }
          resolve();
        });
      });
    } else if (
      process.env.VERCEL ||
      process.env.DISABLE_PERSISTENT_MQTT === 'true'
    ) {
      this.logger.log(
        `Serverless: Opening on-demand connection to publish to ${topic}...`,
      );
      const brokerUrl =
        process.env.MQTT_BROKER_URL ||
        'mqtts://g292ae11.ala.asia-southeast1.emqxsl.com:8883';
      const username = process.env.MQTT_BACKEND_USERNAME || 'pf086f1d';
      const password = process.env.MQTT_BACKEND_PASSWORD || 'PrE_6sIGv9Efa0zQ';

      await new Promise<void>((resolve) => {
        const tempClient = mqtt.connect(brokerUrl, {
          clientId: `backend_temp_${Math.random().toString(16).substr(2, 8)}`,
          username,
          password,
        });

        tempClient.on('connect', () => {
          tempClient.publish(
            topic,
            JSON.stringify(payload),
            { qos: 1 },
            (err) => {
              if (err) {
                this.logger.error(`Serverless publish failed: ${err.message}`);
              } else {
                this.logger.log(`Serverless published command to ${topic}`);
              }
              tempClient.end(false, () => resolve());
            },
          );
        });

        tempClient.on('error', (err) => {
          this.logger.error(`Serverless temp client error: ${err.message}`);
          tempClient.end(false, () => resolve());
        });
      });
    } else {
      this.logger.warn(
        `Cannot publish to ${topic} - EMQX MQTT client not connected.`,
      );
    }
  }

  private async triggerOutboundWebhooks(event: string, payload: any) {
    this.logger.log(`Dispatching outbound webhooks for event: ${event}`);
    try {
      const webhooks = await this.webhookModel
        .find({ isActive: true, events: event })
        .exec();
      for (const hook of webhooks) {
        this.logger.log(`Firing webhook to url: ${hook.url}`);
        fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nigha-Event': event,
            'X-Nigha-Signature': hook.secret || 'default-secret',
          },
          body: JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data: payload,
          }),
        }).catch((err) => {
          this.logger.error(
            `Failed to post webhook payload to ${hook.url}: ${err.message}`,
          );
        });
      }
    } catch (err) {
      this.logger.error(`Error querying webhooks: ${err.message}`);
    }
  }

  public getMonitoringStats() {
    const isServerless =
      process.env.VERCEL ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.DISABLE_PERSISTENT_MQTT === 'true';

    const avgLatency = this.latencies.length > 0
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : 30;

    return {
      connected: this.client ? this.client.connected : true,
      isServerless: !!isServerless,
      publishCount: this.publishCount,
      subscribeCount: this.subscribeCount,
      messageReceivedCount: this.messageReceivedCount,
      failedPublishCount: this.failedPublishCount,
      reconnectCount: this.reconnectCount,
      lastMessageTime: this.lastMessageTime ? this.lastMessageTime.toISOString() : null,
      latency: avgLatency,
      publishRate: Math.max(1, Math.round(this.publishCount / 5)),
      subscribeRate: Math.max(1, Math.round(this.subscribeCount / 5)),
    };
  }
}
