import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MqttService } from '../mqtt/mqtt.service';
import {
  Plant,
  PlantDocument,
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
  AiPrediction,
  AiPredictionDocument,
  AuditLog,
  AuditLogDocument,
  MaintenanceTicket,
  MaintenanceTicketDocument,
  Assignment,
  AssignmentDocument,
  Webhook,
  WebhookDocument,
  OpcUaConfig,
  OpcUaConfigDocument,
  BlastOutcome,
  BlastOutcomeDocument,
  ChuteUptimeLog,
  ChuteUptimeLogDocument,
  CalibrationLog,
  CalibrationLogDocument,
} from '../database/schemas';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class IndustryService {
  constructor(
    @InjectModel(Plant.name) private plantModel: Model<PlantDocument>,
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
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(MaintenanceTicket.name)
    private maintenanceTicketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Webhook.name) private webhookModel: Model<WebhookDocument>,
    @InjectModel(OpcUaConfig.name)
    private opcUaConfigModel: Model<OpcUaConfigDocument>,
    @InjectModel(BlastOutcome.name)
    private blastOutcomeModel: Model<BlastOutcomeDocument>,
    @InjectModel(ChuteUptimeLog.name)
    private chuteUptimeLogModel: Model<ChuteUptimeLogDocument>,
    @InjectModel(CalibrationLog.name)
    private calibrationLogModel: Model<CalibrationLogDocument>,
    private mqttService: MqttService,
    private cacheService: CacheService,
  ) {}

  // --- PLANTS ---
  async getPlants(user?: any): Promise<Plant[]> {
    if (user && user.role === 'Admin') {
      const plantIds = (user.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      return this.plantModel
        .find({
          _id: { $in: plantIds.map((id: string) => new Types.ObjectId(id)) },
        })
        .lean()
        .exec() as any;
    }
    if (user && user.role === 'Manager') {
      const assignments = await this.assignmentModel
        .find({ userId: user._id, plantId: { $ne: null } })
        .lean()
        .exec();
      const plantIds = assignments.map((a) => a.plantId);
      return this.plantModel.find({ _id: { $in: plantIds } }).lean().exec() as any;
    }
    if (user && user.role === 'Worker') {
      const assignments = await this.assignmentModel
        .find({ userId: user._id, chuteId: { $ne: null } })
        .lean()
        .exec();
      const chuteIds = assignments.map((a) => a.chuteId);
      const chutes = await this.chuteModel
        .find({ _id: { $in: chuteIds } })
        .lean()
        .exec();
      const plantIds = chutes.map((c) => c.plantId);
      return this.plantModel.find({ _id: { $in: plantIds } }).lean().exec() as any;
    }

    const cacheKey = 'plants_all';
    if (process.env.NODE_ENV !== 'test') {
      const cached = await this.cacheService.get<Plant[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    const plants = await this.plantModel.find().lean().exec() as any;
    if (process.env.NODE_ENV !== 'test') {
      await this.cacheService.set(cacheKey, plants, 60);
    }
    return plants;
  }

  async createPlant(data: Partial<Plant>): Promise<Plant> {
    if (!data.plantCode) {
      const name = data.name || 'Plant';
      let code =
        name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .substring(0, 3)
          .toUpperCase() || 'PLT';
      let exists = await this.plantModel.findOne({ plantCode: code }).exec();
      let attempt = 1;
      while (exists) {
        code = `${code.substring(0, 2)}${attempt++}`;
        exists = await this.plantModel.findOne({ plantCode: code }).exec();
      }
      data.plantCode = code;
    }
    data.ngPrefix = `NG${data.plantCode.toUpperCase()}`;
    data.currentSequence =
      data.currentSequence !== undefined ? data.currentSequence : 0;
    data.currentChuteSequence =
      data.currentChuteSequence !== undefined ? data.currentChuteSequence : 0;
    data.isActive = data.isActive !== undefined ? data.isActive : true;
    const plant = new this.plantModel(data);
    await plant.save();
    await this.cacheService.del('plants_all');

    const audit = new this.auditLogModel({
      action: 'Plant Creation',
      details: `Created plant ${plant.name}`,
    });
    await audit.save();

    return plant;
  }

  // --- CHUTES ---
  async getChutes(plantId?: string, user?: any): Promise<Chute[]> {
    const query: any = {};

    // Helper to generate query matching either string or ObjectId
    const getPlantIdMatcher = (idStr: string) => {
      const matchers: any[] = [idStr];
      try {
        matchers.push(new Types.ObjectId(idStr));
      } catch (e) {}
      return { $in: matchers };
    };

    if (plantId) {
      query.plantId = getPlantIdMatcher(plantId);
    }

    if (user) {
      if (user.role === 'Admin') {
        const allowedPlantIds = (user.assignedPlantIds || []).map((id: any) =>
          id.toString(),
        );
        if (plantId) {
          if (!allowedPlantIds.includes(plantId)) {
            return [];
          }
        } else {
          const matchers: any[] = [];
          allowedPlantIds.forEach((id) => {
            matchers.push(id);
            try {
              matchers.push(new Types.ObjectId(id));
            } catch (e) {}
          });
          query.plantId = { $in: matchers };
        }
      } else if (user.role === 'Manager' || user.role === 'Worker') {
        const assignments = await this.assignmentModel
          .find({ userId: user._id })
          .lean()
          .exec();
        const allowedChuteIds = assignments
          .filter((a) => a.chuteId)
          .map((a) => a.chuteId.toString());

        if (user.role === 'Manager') {
          const allowedPlantIds = assignments
            .filter((a) => a.plantId)
            .map((a) => a.plantId.toString());
          const matchers: any[] = [];
          allowedPlantIds.forEach((id) => {
            matchers.push(id);
            try {
              matchers.push(new Types.ObjectId(id));
            } catch (e) {}
          });
          const plantChutes = await this.chuteModel
            .find({ plantId: { $in: matchers } })
            .lean()
            .exec();
          plantChutes.forEach((c) => {
            const idStr = (c as any)._id.toString();
            if (!allowedChuteIds.includes(idStr)) {
              allowedChuteIds.push(idStr);
            }
          });
        }

        query._id = {
          $in: allowedChuteIds.map((id) => new Types.ObjectId(id)),
        };
      }
    }

    const results = await this.chuteModel.find(query).lean().exec() as any;
    return results;
  }

  async createChute(data: Partial<Chute>, caller?: any): Promise<Chute> {
    if (!data.plantId) {
      throw new BadRequestException('Plant ID is required to create a chute');
    }
    const plant = await this.plantModel
      .findByIdAndUpdate(
        data.plantId,
        { $inc: { currentChuteSequence: 1 } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!plant) {
      throw new NotFoundException('Plant not found');
    }
    data.chuteCode = `${plant.ngPrefix}-CH-${String(plant.currentChuteSequence).padStart(5, '0')}`;
    data.isActive = data.isActive !== undefined ? data.isActive : true;

    // Explicitly cast plantId to ObjectId so it gets saved properly as Types.ObjectId in DB
    try {
      data.plantId = new Types.ObjectId(data.plantId as any);
    } catch (e) {}

    const chute = new this.chuteModel(data);
    await chute.save();
    await this.cacheService.invalidatePattern('chutes_');

    // Auto-create associated components for simulation convenience
    const chuteId = chute._id;

    // 4 Radars
    for (let i = 1; i <= 4; i++) {
      await this.radarModel.create({
        chuteId,
        zone: i,
        distance: 3.5,
        buildupDetected: false,
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
      refillFrequency: 2,
      motorTemperature: 28,
      efficiency: 98,
      healthScore: 100,
    });
    // Hub Health
    await this.hubHealthModel.create({
      chuteId,
      isOnline: true,
      localLogsCount: 0,
    });
    // AI Predictions
    await this.aiPredictionModel.create({
      chuteId,
      blockageProbability: 2,
      compressorFailureProbability: 1,
      solenoidWearProbability: 0,
      airBlasterMaintenanceProbability: 0,
      recommendedActions: ['System Operating Normally.'],
    });

    const audit = new this.auditLogModel({
      action: 'Chute Creation',
      details: `Created chute ${chute.name} and initialized hardware models`,
    });
    await audit.save();

    return chute;
  }

  // --- UPDATE PLANT ---
  async updatePlant(
    id: string,
    data: Partial<Plant>,
    caller: any,
  ): Promise<Plant> {
    const allowedFields = [
      'name',
      'location',
      'description',
      'industryType',
      'ownerName',
      'contactNumber',
      'email',
      'address',
    ];
    const update: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) update[key] = data[key];
    }
    const plant = await this.plantModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();
    if (!plant) throw new NotFoundException('Plant not found');
    await this.cacheService.del('plants_all');
    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Plant Update',
      details: `Updated plant ${plant.name} (${plant.plantCode}) — fields: ${Object.keys(update).join(', ')}`,
    });
    await audit.save();
    return plant;
  }

  // --- DISABLE PLANT ---
  async disablePlant(id: string, caller: any): Promise<Plant> {
    const plant = await this.plantModel
      .findByIdAndUpdate(
        id,
        { isActive: false, disabledAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();
    if (!plant) throw new NotFoundException('Plant not found');
    await this.cacheService.del('plants_all');
    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Plant Disabled',
      details: `Disabled plant ${plant.name} (${plant.plantCode})`,
    });
    await audit.save();
    return plant;
  }

  // --- ENABLE PLANT ---
  async enablePlant(id: string, caller: any): Promise<Plant> {
    const plant = await this.plantModel
      .findByIdAndUpdate(
        id,
        { isActive: true, disabledAt: null },
        { returnDocument: 'after' },
      )
      .exec();
    if (!plant) throw new NotFoundException('Plant not found');
    await this.cacheService.del('plants_all');
    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Plant Enabled',
      details: `Re-enabled plant ${plant.name} (${plant.plantCode})`,
    });
    await audit.save();
    return plant;
  }

  // --- UPDATE CHUTE ---
  async updateChute(
    id: string,
    data: Partial<Chute>,
    caller: any,
  ): Promise<Chute> {
    const allowedFields = [
      'name',
      'materialType',
      'gpsCoordinates',
      'simulationMode',
      'activePath',
      'blockagePosition',
      'blockageDistance',
      'nearestSolenoidGroup',
      'status',
    ];
    const update: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) update[key] = data[key];
    }
    const chute = await this.chuteModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();
    if (!chute) throw new NotFoundException('Chute not found');
    await this.cacheService.invalidatePattern('chutes_');

    // Handle Manual Simulation Mode transitions and overrides
    if (update.simulationMode !== undefined) {
      if (update.simulationMode === false) {
        // Reset manual blockages and publish override_radar to simulator for all 4 zones to resume drifting
        await this.chuteModel
          .findByIdAndUpdate(id, {
            blockagePosition: 'None',
            blockageDistance: 3.5,
            nearestSolenoidGroup: 1,
            status: 'Normal',
          })
          .exec();

        for (let zone = 1; zone <= 4; zone++) {
          this.mqttService.publish(`nigha/chute/${id}/command`, {
            action: 'override_radar',
            zone,
            distance: 3.5,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // If manual blockage is injected, override the simulator's radar
    if (chute.simulationMode && update.blockageDistance !== undefined) {
      let zone = 1;
      if (update.blockagePosition) {
        const match = String(update.blockagePosition).match(/Zone\s*(\d)/i);
        if (match) {
          zone = parseInt(match[1]);
        }
      } else if (update.nearestSolenoidGroup) {
        zone = update.nearestSolenoidGroup;
      }

      this.mqttService.publish(`nigha/chute/${id}/command`, {
        action: 'override_radar',
        zone,
        distance: update.blockageDistance,
        timestamp: new Date().toISOString(),
      });
    }

    // Publish the updated localization telemetry over MQTT in real time
    const updatedChute = await this.chuteModel.findById(id).exec();
    if (updatedChute) {
      this.mqttService.publish(`nigha/chute/${id}/localization`, {
        activePath: updatedChute.activePath,
        simulationMode: updatedChute.simulationMode,
        blockagePosition: updatedChute.blockagePosition,
        blockageDistance: updatedChute.blockageDistance,
        nearestSolenoidGroup: updatedChute.nearestSolenoidGroup,
        status: updatedChute.status,
      });
    }

    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Chute Update',
      details: `Updated chute ${chute.name} (${chute.chuteCode}) — fields: ${Object.keys(update).join(', ')}`,
    });
    await audit.save();
    return chute;
  }

  // --- DISABLE CHUTE ---
  async disableChute(id: string, caller: any): Promise<Chute> {
    const chute = await this.chuteModel
      .findByIdAndUpdate(id, { isActive: false }, { returnDocument: 'after' })
      .exec();
    if (!chute) throw new NotFoundException('Chute not found');
    await this.cacheService.invalidatePattern('chutes_');
    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Chute Disabled',
      details: `Disabled chute ${chute.name} (${chute.chuteCode})`,
    });
    await audit.save();
    return chute;
  }

  // --- ENABLE CHUTE ---
  async enableChute(id: string, caller: any): Promise<Chute> {
    const chute = await this.chuteModel
      .findByIdAndUpdate(id, { isActive: true }, { returnDocument: 'after' })
      .exec();
    if (!chute) throw new NotFoundException('Chute not found');
    await this.cacheService.invalidatePattern('chutes_');
    const audit = new this.auditLogModel({
      userId: caller?._id,
      action: 'Chute Enabled',
      details: `Re-enabled chute ${chute.name} (${chute.chuteCode})`,
    });
    await audit.save();
    return chute;
  }

  // --- DETAILED CHUTE STATUS ---
  async getChuteDetail(chuteId: string): Promise<any> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).lean().exec();
    if (!chute) {
      throw new NotFoundException('Chute not found');
    }

    // Run all independent queries in parallel — each previously had its own
    // sequential round-trip to MongoDB. Promise.all collapses them into one batch.
    const [radars, blasters, solenoids, compressor, prediction, health, alerts, telemetry] =
      await Promise.all([
        this.radarModel.find({ chuteId: oId }).sort({ zone: 1 }).lean().exec(),
        this.airBlasterModel.find({ chuteId: oId }).sort({ blasterNumber: 1 }).lean().exec(),
        this.solenoidModel.find({ chuteId: oId }).sort({ valveNumber: 1 }).lean().exec(),
        this.compressorModel.findOne({ chuteId: oId }).lean().exec(),
        this.aiPredictionModel.findOne({ chuteId: oId }).lean().exec(),
        this.hubHealthModel.findOne({ chuteId: oId }).lean().exec(),
        this.alertModel.find({ chuteId: oId, isResolved: false }).lean().exec(),
        this.telemetryModel
          .find({ chuteId: oId })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
          .exec(),
      ]);

    return {
      chute,
      radars,
      blasters,
      solenoids,
      compressor,
      prediction,
      health,
      activeAlertsCount: alerts.length,
      alerts,
      telemetry: telemetry.reverse(),
    };
  }

  // --- MANUAL BLAST CONTROL ---
  async triggerManualBlast(
    chuteId: string,
    blasterNumber: number | undefined,
    valveNumber: number | undefined,
    userId: string,
  ): Promise<{ message: string }> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) {
      throw new NotFoundException('Chute not found');
    }

    // Determine target group and solenoids based on manual trigger inputs
    let blastGroup = 1;
    if (blasterNumber !== undefined) {
      const bNum = Number(blasterNumber);
      if (bNum >= 1 && bNum <= 4) {
        blastGroup = bNum;
      }
    } else if (valveNumber !== undefined) {
      const vNum = Number(valveNumber);
      if (isNaN(vNum) || vNum < 1 || vNum > 8) {
        throw new BadRequestException('Invalid valve number. Must be 1 to 8.');
      }
      if (vNum === 1 || vNum === 2) blastGroup = 1;
      else if (vNum === 3 || vNum === 4) blastGroup = 2;
      else if (vNum === 5 || vNum === 6) blastGroup = 3;
      else if (vNum === 7 || vNum === 8) blastGroup = 4;
    } else {
      blastGroup = chute.nearestSolenoidGroup || 1;
    }

    const groupSolenoidsMap: Record<number, string[]> = {
      1: ['S1A', 'S1B', 'S1C', 'S1D'],
      2: ['S2A', 'S2B', 'S2C', 'S2D'],
      3: ['S3A', 'S3B', 'S3C', 'S3D'],
      4: ['S4A', 'S4B', 'S4C', 'S4D'],
    };

    const solenoids = groupSolenoidsMap[blastGroup] || [
      'S1A',
      'S1B',
      'S1C',
      'S1D',
    ];

    // Publish blast command via MQTT
    const topic = `nigha/chute/${chuteId}/command`;
    const payload = {
      action: 'blast',
      blastGroup,
      solenoids,
      triggeredBy: userId,
      timestamp: new Date().toISOString(),
    };

    this.mqttService.publish(topic, payload);

    // Write audit log
    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Manual Blast Trigger Request',
      details: `User triggered manual blast on Chute ${chute.name} (Group: ${blastGroup}, Solenoids: ${solenoids.join(', ')})`,
    });
    await audit.save();

    return {
      message: `Manual blast command published for Solenoid Group ${blastGroup} (${solenoids.join(', ')})`,
    };
  }

  // ── SIMULATION MODE (Manual / Testing Mode) ──────────────────────────────
  // When simulationMode = true, blockage data is set manually by the operator.
  // Radar telemetry from the backend localization engine is BYPASSED.
  // When simulationMode = false (Production), the localization engine uses
  // real radar data from MQTT to determine activePath and blockagePosition.
  async setSimulationMode(
    chuteId: string,
    enabled: boolean,
    blockageData?: {
      activePath?: 'LEFT_SLANT' | 'RIGHT_SLANT';
      blockagePosition?: string;
      blockageDistance?: number;
      nearestSolenoidGroup?: number;
      injectRadarZone?: number; // Zone to override_radar with blockage (1-4)
    },
    userId?: string,
  ): Promise<{ message: string; chute: any }> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) {
      throw new NotFoundException('Chute not found');
    }

    const updateFields: any = { simulationMode: enabled };

    if (enabled && blockageData) {
      // Manual mode: apply operator-provided blockage context
      if (blockageData.activePath)
        updateFields.activePath = blockageData.activePath;
      if (blockageData.blockagePosition !== undefined)
        updateFields.blockagePosition = blockageData.blockagePosition;
      if (blockageData.blockageDistance !== undefined)
        updateFields.blockageDistance = blockageData.blockageDistance;
      if (blockageData.nearestSolenoidGroup !== undefined)
        updateFields.nearestSolenoidGroup = blockageData.nearestSolenoidGroup;

      // Determine status from blockage distance
      if (blockageData.blockageDistance !== undefined) {
        if (blockageData.blockageDistance < 0.65) {
          updateFields.status = 'Blocked';
        } else if (blockageData.blockageDistance < 1.0) {
          updateFields.status = 'Buildup';
        } else {
          updateFields.status = 'Normal';
          updateFields.blockagePosition = 'None';
        }
      }

      // If a specific radar zone should be overridden, publish override command to simulator
      if (
        blockageData.injectRadarZone &&
        blockageData.blockageDistance !== undefined
      ) {
        const zone = blockageData.injectRadarZone;
        const distance = blockageData.blockageDistance;
        const overrideTopic = `nigha/chute/${chuteId}/command`;
        this.mqttService.publish(overrideTopic, {
          action: 'override_radar',
          zone,
          distance,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (!enabled) {
      // Switching back to production mode: clear manual overrides
      updateFields.blockagePosition = 'None';
      updateFields.blockageDistance = 3.5;
      updateFields.status = 'Normal';

      // Clear all radar overrides via MQTT command — reset all zones
      for (let zone = 1; zone <= 4; zone++) {
        this.mqttService.publish(`nigha/chute/${chuteId}/command`, {
          action: 'override_radar',
          zone,
          distance: 3.5,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const updatedChute = await this.chuteModel
      .findByIdAndUpdate(oId, updateFields, { new: true })
      .exec();

    // Immediately publish localization event so Digital Twin updates in real time
    const localizationPayload = {
      activePath: updatedChute?.activePath || 'LEFT_SLANT',
      simulationMode: enabled,
      blockagePosition: updatedChute?.blockagePosition || 'None',
      blockageDistance: updatedChute?.blockageDistance ?? 3.5,
      nearestSolenoidGroup: updatedChute?.nearestSolenoidGroup ?? 1,
      status: updatedChute?.status || 'Normal',
    };
    this.mqttService.publish(
      `nigha/chute/${chuteId}/localization`,
      localizationPayload,
    );

    // Audit log
    if (userId) {
      const audit = new this.auditLogModel({
        userId: new Types.ObjectId(userId),
        action: enabled
          ? 'Simulation Mode Enabled'
          : 'Simulation Mode Disabled',
        details: `Chute ${chute.name}: simulationMode set to ${enabled}. ${
          enabled && blockageData
            ? `Manual blockage: ${blockageData.blockagePosition || 'N/A'} @ ${blockageData.blockageDistance ?? 'N/A'}m, Group ${blockageData.nearestSolenoidGroup ?? 'N/A'}`
            : 'Reverted to Production (Radar) Mode.'
        }`,
      });
      await audit.save();
    }

    return {
      message: enabled
        ? `Simulation Mode ENABLED on ${chute.name}. Manual blockage data applied.`
        : `Simulation Mode DISABLED on ${chute.name}. Reverted to Production Radar Mode.`,
      chute: updatedChute,
    };
  }

  // ── QR DEVICE ONBOARDING ──────────────────────────────────────────────────

  /**
   * Generates a QR token payload for the given chute.
   * The frontend renders this as a QR code. When a physical hub device
   * scans the code, it calls claimDevice() to pair itself to this chute.
   */
  async generateQrToken(chuteId: string): Promise<any> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    const plant = await this.plantModel.findById(chute.plantId).exec();
    const plantCode = plant?.plantCode || 'UNKNOWN';

    // Build a deterministic signature from chuteId + chuteCode + plantCode
    // This is a lightweight non-cryptographic token for display purposes.
    // Production deployments should sign this with a private key.
    const timestamp = new Date().toISOString();
    const signature = Buffer.from(
      `${chuteId}:${chute.chuteCode}:${plantCode}:${timestamp}`,
    ).toString('base64');

    return {
      chuteId,
      chuteCode: chute.chuteCode,
      plantCode,
      plantName: plant?.name || '',
      chuteName: chute.name,
      linkedDeviceId: (chute as any).linkedDeviceId || null,
      deviceLinkedAt: (chute as any).deviceLinkedAt || null,
      qrPayload: {
        chuteId,
        chuteCode: chute.chuteCode,
        plantCode,
        timestamp,
        signature,
      },
    };
  }

  /**
   * Claims a chute for a specific physical hardware device.
   * Called by the dashboard operator after scanning the QR code on the device.
   * The deviceId is the hardware hub's unique identifier (MAC address, serial, etc.).
   */
  async claimDevice(
    chuteId: string,
    deviceId: string,
    userId: string,
  ): Promise<{ message: string; chute: any }> {
    if (!deviceId || deviceId.trim().length === 0) {
      throw new BadRequestException('deviceId must not be empty');
    }

    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    const updatedChute = await this.chuteModel
      .findByIdAndUpdate(
        oId,
        { linkedDeviceId: deviceId.trim(), deviceLinkedAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();

    await this.cacheService.invalidatePattern('chutes_');

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Device Onboarding',
      details: `Physical hub device "${deviceId}" paired to chute ${chute.name} (${chute.chuteCode}) via QR onboarding.`,
    });
    await audit.save();

    return {
      message: `Device "${deviceId}" successfully linked to chute ${chute.name} (${chute.chuteCode}).`,
      chute: updatedChute,
    };
  }

  /**
   * Removes the device link from a chute (unpairing).
   */
  async unlinkDevice(
    chuteId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const oId = new Types.ObjectId(chuteId);
    const chute = await this.chuteModel.findById(oId).exec();
    if (!chute) throw new NotFoundException('Chute not found');

    const oldDevice = (chute as any).linkedDeviceId;
    await this.chuteModel
      .findByIdAndUpdate(oId, { linkedDeviceId: null, deviceLinkedAt: null })
      .exec();
    await this.cacheService.invalidatePattern('chutes_');

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Device Unlinked',
      details: `Physical hub device "${oldDevice}" unlinked from chute ${chute.name} (${chute.chuteCode}).`,
    });
    await audit.save();

    return { message: `Device unlinked from chute ${chute.name}.` };
  }

  // --- ALERTS ---
  async getAlerts(chuteId?: string, user?: any): Promise<Alert[]> {
    const query: any = {};
    if (chuteId) {
      query.chuteId = new Types.ObjectId(chuteId);
    } else if (user) {
      const chutes = await this.getChutes(undefined, user);
      const chuteIds = chutes.map((c) => (c as any)._id);
      query.chuteId = { $in: chuteIds };
    }
    return this.alertModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.alertModel.findById(alertId).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    await alert.save();

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Resolve Alert',
      details: `Resolved alert: ${alert.message} (${alert.source})`,
    });
    await audit.save();

    return alert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.alertModel.findById(alertId).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = new Types.ObjectId(userId);
    await alert.save();

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Acknowledge Alert',
      details: `Acknowledged alert: ${alert.message} (${alert.source})`,
    });
    await audit.save();

    return alert;
  }

  async silenceAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.alertModel.findById(alertId).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.isSilenced = true;
    alert.silencedAt = new Date();
    await alert.save();

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Silence Alert',
      details: `Silenced alert: ${alert.message} (${alert.source})`,
    });
    await audit.save();

    return alert;
  }

  async escalateAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.alertModel.findById(alertId).exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    const currentSev = alert.severity;
    let newSev = 'Critical';
    if (currentSev === 'Low' || currentSev === 'Info' || currentSev === 'INFO') {
      newSev = 'Warning';
    } else if (currentSev === 'Warning' || currentSev === 'Medium' || currentSev === 'WARNING') {
      newSev = 'Critical';
    } else {
      newSev = 'Emergency';
    }

    alert.severity = newSev;
    await alert.save();

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Escalate Alert',
      details: `Escalated alert severity from ${currentSev} to ${newSev}: ${alert.message}`,
    });
    await audit.save();

    return alert;
  }

  // --- AUDIT LOGS ---
  async getAuditLogs(user?: any): Promise<AuditLog[]> {
    const query: any = {};
    if (user && user.role !== 'Super Admin') {
      const allowedUsers = await this.plantModel.db
        .model('User')
        .find({
          assignedPlantIds: { $in: user.assignedPlantIds },
        })
        .lean()
        .exec();
      const userIds = allowedUsers.map((u) => u._id);
      query.userId = { $in: userIds };
    }
    return this.auditLogModel
      .find(query)
      .populate('userId', 'name ngId role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec() as any;
  }

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as any;
  }

  async getMqttStats() {
    return this.mqttService.getMonitoringStats();
  }

  // --- MAINTENANCE TICKETS ---
  async getMaintenanceTickets(user?: any): Promise<MaintenanceTicket[]> {
    const query: any = {};
    if (user) {
      const chutes = await this.getChutes(undefined, user);
      const chuteIds = chutes.map((c) => (c as any)._id);
      query.chuteId = { $in: chuteIds };
    }
    return this.maintenanceTicketModel
      .find(query)
      .populate('chuteId', 'name')
      .populate('assignedTo', 'name ngId role')
      .sort({ createdAt: -1 })
      .lean()
      .exec() as any;
  }

  async createMaintenanceTicket(data: any): Promise<MaintenanceTicket> {
    const ticket = new this.maintenanceTicketModel({
      chuteId: new Types.ObjectId(data.chuteId),
      assetType: data.assetType,
      assetId: new Types.ObjectId(data.assetId),
      description: data.description,
      status: 'Open',
      assignedTo: data.assignedTo ? new Types.ObjectId(data.assignedTo) : null,
    });
    await ticket.save();

    const audit = new this.auditLogModel({
      action: 'Maintenance Ticket Created',
      details: `Created ${ticket.assetType} maintenance ticket for Chute ${ticket.chuteId}`,
    });
    await audit.save();

    return ticket;
  }

  async addServiceHistory(
    ticketId: string,
    action: string,
    notes: string,
    userId: string,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.maintenanceTicketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.serviceHistory.push({
      date: new Date(),
      action,
      performedBy: new Types.ObjectId(userId),
      notes,
    });

    await ticket.save();

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Maintenance Service Logged',
      details: `Logged service action "${action}" on ticket ${ticketId}`,
    });
    await audit.save();

    return ticket;
  }

  async updateTicketStatus(
    ticketId: string,
    status: string,
    userId: string,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.maintenanceTicketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    await ticket.save();

    // If resolved, reset health score of the asset to 100!
    if (status === 'Resolved') {
      const assetType = ticket.assetType;
      const assetId = ticket.assetId;
      if (assetType === 'AirBlaster') {
        await this.airBlasterModel
          .findByIdAndUpdate(assetId, { healthScore: 100, totalBlasts: 0 })
          .exec();
      } else if (assetType === 'Solenoid') {
        await this.solenoidModel
          .findByIdAndUpdate(assetId, { healthScore: 100, totalCycles: 0 })
          .exec();
      } else if (assetType === 'Compressor') {
        await this.compressorModel
          .findByIdAndUpdate(assetId, { healthScore: 100, efficiency: 100 })
          .exec();
      } else if (assetType === 'Sensor') {
        await this.radarModel
          .findByIdAndUpdate(assetId, { distance: 3.5, buildupDetected: false })
          .exec();
      }
    }

    const audit = new this.auditLogModel({
      userId: new Types.ObjectId(userId),
      action: 'Maintenance Ticket Status Update',
      details: `Updated ticket ${ticketId} status from ${oldStatus} to ${status}`,
    });
    await audit.save();

    return ticket;
  }

  // --- HISTORICAL TELEMETRY TRENDS ---
  async getTelemetryTrends(chuteId: string, limit = 50): Promise<Telemetry[]> {
    return this.telemetryModel
      .find({ chuteId: new Types.ObjectId(chuteId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec()
      .then((res) => (res as any[]).reverse());
  }

  // --- WEBHOOKS ---
  async getWebhooks(organizationId: string): Promise<Webhook[]> {
    return this.webhookModel
      .find({ organizationId: new Types.ObjectId(organizationId) })
      .lean()
      .exec() as any;
  }

  async createWebhook(organizationId: string, data: any): Promise<Webhook> {
    const webhook = new this.webhookModel({
      organizationId: new Types.ObjectId(organizationId),
      name: data.name,
      url: data.url,
      events: data.events || ['alert.created', 'blast.success'],
      secret: data.secret || Math.random().toString(36).substring(2, 15),
    });
    await webhook.save();
    return webhook;
  }

  async deleteWebhook(webhookId: string): Promise<any> {
    return this.webhookModel.findByIdAndDelete(webhookId).exec();
  }

  // --- OPC-UA / PLC MAPPING CONFIGS ---
  async getOpcUaConfig(plantId: string): Promise<OpcUaConfig | null> {
    const cacheKey = `opc_config_${plantId}`;
    const cached = await this.cacheService.get<OpcUaConfig>(cacheKey);
    if (cached) {
      return cached;
    }
    const config = await this.opcUaConfigModel
      .findOne({ plantId: new Types.ObjectId(plantId) })
      .lean()
      .exec();
    if (config) {
      await this.cacheService.set(cacheKey, config, 120);
    }
    return config as any;
  }

  async saveOpcUaConfig(plantId: string, data: any): Promise<OpcUaConfig> {
    const config = await this.opcUaConfigModel
      .findOneAndUpdate(
        { plantId: new Types.ObjectId(plantId) },
        {
          endpointUrl: data.endpointUrl,
          namespaceUri: data.namespaceUri,
          registerMappings: data.registerMappings,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    await this.cacheService.del(`opc_config_${plantId}`);
    return config;
  }

  // --- BLAST HISTORY & OUTCOMES ---

  /**
   * Returns the last N blast outcomes for a chute with effectiveness scores.
   * Used by the Dashboard to display blast quality history and trend.
   */
  async getBlastHistory(chuteId: string, limit = 20): Promise<BlastOutcome[]> {
    return this.blastOutcomeModel
      .find({ chuteId: new Types.ObjectId(chuteId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec() as any;
  }

  // --- CHUTE KPIs ---

  /**
   * Returns a complete set of chute intelligence KPIs for a single chute:
   *  - Uptime % (24h)
   *  - Blockage minutes today
   *  - Total blasts today / this week
   *  - Average blast effectiveness score
   *  - Air litres consumed today
   *  - Consecutive failed blasts
   *  - Last blast score
   *  - Open auto-created maintenance tickets count
   */
  async getChuteKpis(chuteId: string): Promise<any> {
    const oId = new Types.ObjectId(chuteId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [prediction, todayBlasts, weekBlasts, openAutoTickets, uptimeLogs] =
      await Promise.all([
        this.aiPredictionModel.findOne({ chuteId: oId }).lean().exec(),
        this.blastOutcomeModel
          .find({ chuteId: oId, createdAt: { $gte: today } })
          .lean()
          .exec(),
        this.blastOutcomeModel
          .find({ chuteId: oId, createdAt: { $gte: since7d } })
          .lean()
          .exec(),
        this.maintenanceTicketModel
          .countDocuments({
            chuteId: oId,
            status: { $in: ['Open', 'In Progress'] },
            description: { $regex: /^AUTO:/i },
          })
          .exec(),
        this.chuteUptimeLogModel
          .find({ chuteId: oId, enteredAt: { $gte: since24h } })
          .lean()
          .exec(),
      ]);

    const scoredBlasts = weekBlasts.filter((b) => b.effectivenessScore >= 0);
    const avgEffectiveness =
      scoredBlasts.length > 0
        ? Math.round(
            scoredBlasts.reduce((s, b) => s + b.effectivenessScore, 0) /
              scoredBlasts.length,
          )
        : -1;

    return {
      uptimePercent24h: prediction?.uptimePercent24h ?? 100,
      blockageMinutesToday: prediction?.blockageMinutesToday ?? 0,
      airLitresToday: prediction?.airLitresToday ?? 0,
      lastBlastEffectivenessScore:
        prediction?.lastBlastEffectivenessScore ?? -1,
      consecutiveFailedBlasts: prediction?.consecutiveFailedBlasts ?? 0,
      overallTrend: prediction?.overallTrend ?? 'stable',
      buildupRatePerMin: prediction?.buildupRatePerMin ?? 0,
      blastsToday: todayBlasts.length,
      blastsThisWeek: weekBlasts.length,
      avgBlastEffectivenessThisWeek: avgEffectiveness,
      openAutoTickets,
      uptimeLogs: uptimeLogs.slice(0, 20), // last 20 transitions
    };
  }

  /**
   * Fleet-wide KPI summary across all chutes in a plant (or all plants).
   * Returns the metrics needed for the Fleet KPI Dashboard panel.
   */
  async getFleetKpis(plantId?: string, user?: any): Promise<any> {
    const chutes = await this.getChutes(plantId, user);

    const results = await Promise.all(
      chutes.map(async (chute) => {
        const chuteId = (chute as any)._id as Types.ObjectId;
        const prediction = await this.aiPredictionModel
          .findOne({ chuteId })
          .exec();
        const openAlerts = await this.alertModel
          .countDocuments({ chuteId, isResolved: false })
          .exec();
        return {
          chuteId: chuteId.toString(),
          chuteName: chute.name,
          status: chute.status,
          materialType: (chute as any).materialType ?? 'generic',
          uptimePercent24h: prediction?.uptimePercent24h ?? 100,
          blockageMinutesToday: prediction?.blockageMinutesToday ?? 0,
          blockageProbability: prediction?.blockageProbability ?? 0,
          overallTrend: prediction?.overallTrend ?? 'stable',
          lastBlastScore: prediction?.lastBlastEffectivenessScore ?? -1,
          consecutiveFailedBlasts: prediction?.consecutiveFailedBlasts ?? 0,
          openAlerts,
          airLitresToday: prediction?.airLitresToday ?? 0,
        };
      }),
    );

    // Fleet-level aggregates
    const avgUptime =
      results.length > 0
        ? Math.round(
            results.reduce((s, c) => s + c.uptimePercent24h, 0) /
              results.length,
          )
        : 100;
    const totalBlockageMinutes = results.reduce(
      (s, c) => s + c.blockageMinutesToday,
      0,
    );
    const worstChute = results.reduce(
      (worst, c) =>
        c.uptimePercent24h < (worst?.uptimePercent24h ?? 101) ? c : worst,
      null as any,
    );
    const criticalChutes = results.filter(
      (c) => c.status === 'Blocked' || c.consecutiveFailedBlasts >= 2,
    );

    return {
      fleetSize: chutes.length,
      fleetUptimePercent24h: avgUptime,
      totalBlockageMinutesToday: totalBlockageMinutes,
      criticalChuteCount: criticalChutes.length,
      worstPerformer: worstChute,
      chutes: results,
    };
  }

  async getAssignments(user?: any): Promise<Assignment[]> {
    const query: any = {};
    if (user && user.role !== 'Super Admin') {
      if (user.role === 'Admin') {
        const allowedPlantIds = (user.assignedPlantIds || []).map((id: any) =>
          id.toString(),
        );
        query.plantId = {
          $in: allowedPlantIds.map((id: string) => new Types.ObjectId(id)),
        };
      } else if (user.role === 'Manager') {
        const managerAssignments = await this.assignmentModel
          .find({ userId: user._id })
          .lean()
          .exec();
        const plantIds = managerAssignments
          .filter((a) => a.plantId)
          .map((a) => a.plantId);
        const chuteIds = managerAssignments
          .filter((a) => a.chuteId)
          .map((a) => a.chuteId);
        query.$or = [
          { userId: user._id },
          { plantId: { $in: plantIds } },
          { chuteId: { $in: chuteIds } },
        ];
      } else {
        query.userId = user._id;
      }
    }
    return this.assignmentModel
      .find(query)
      .populate('userId', 'name role phone ngId')
      .populate('plantId', 'name location')
      .populate('chuteId', 'name')
      .lean()
      .exec() as any;
  }

  async createAssignment(
    userId: string,
    plantId?: string,
    chuteId?: string,
    creator?: any,
  ): Promise<Assignment> {
    if (creator && creator.role !== 'Super Admin') {
      if (creator.role === 'Admin') {
        const allowedPlantIds = (creator.assignedPlantIds || []).map(
          (id: any) => id.toString(),
        );
        if (plantId && !allowedPlantIds.includes(plantId)) {
          throw new BadRequestException(
            'Cannot assign user to an unassigned plant',
          );
        }
        if (chuteId) {
          const chute = await this.chuteModel.findById(chuteId).exec();
          if (!chute || !allowedPlantIds.includes(chute.plantId.toString())) {
            throw new BadRequestException(
              'Cannot assign user to a chute in an unassigned plant',
            );
          }
        }
      } else if (creator.role === 'Manager') {
        const managerAssignments = await this.assignmentModel
          .find({ userId: creator._id })
          .exec();
        const allowedChuteIds = managerAssignments
          .filter((a) => a.chuteId)
          .map((a) => a.chuteId.toString());
        const allowedPlantIds = managerAssignments
          .filter((a) => a.plantId)
          .map((a) => a.plantId.toString());

        if (chuteId) {
          const chute = await this.chuteModel.findById(chuteId).exec();
          if (!chute) {
            throw new BadRequestException('Chute not found');
          }
          const isChuteAllowed =
            allowedChuteIds.includes(chuteId) ||
            allowedPlantIds.includes(chute.plantId.toString());
          if (!isChuteAllowed) {
            throw new BadRequestException(
              'Managers can only assign workers to chutes they are assigned to',
            );
          }
        } else {
          throw new BadRequestException(
            'Managers can only assign workers to specific chutes',
          );
        }
      }
    }

    const query: any = { userId: new Types.ObjectId(userId) };
    if (plantId) query.plantId = new Types.ObjectId(plantId);
    if (chuteId) query.chuteId = new Types.ObjectId(chuteId);

    const existing = await this.assignmentModel.findOne(query).exec();
    if (existing) {
      throw new BadRequestException('Assignment already exists');
    }

    const assignment = new this.assignmentModel({
      userId: new Types.ObjectId(userId),
      plantId: plantId ? new Types.ObjectId(plantId) : null,
      chuteId: chuteId ? new Types.ObjectId(chuteId) : null,
    });
    await assignment.save();

    const audit = new this.auditLogModel({
      action: 'Assignment Creation',
      details: `Created assignment for user ${userId} to Plant: ${plantId || 'None'}, Chute: ${chuteId || 'None'}`,
    });
    await audit.save();

    return assignment;
  }

  async deleteAssignment(
    id: string,
    deleter?: any,
  ): Promise<{ message: string }> {
    const assignment = await this.assignmentModel.findById(id).exec();
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (deleter && deleter.role !== 'Super Admin') {
      if (deleter.role === 'Admin') {
        const allowedPlantIds = (deleter.assignedPlantIds || []).map(
          (id: any) => id.toString(),
        );
        if (
          assignment.plantId &&
          !allowedPlantIds.includes(assignment.plantId.toString())
        ) {
          throw new BadRequestException(
            'Cannot revoke assignment for an unassigned plant',
          );
        }
      } else if (deleter.role === 'Manager') {
        const managerAssignments = await this.assignmentModel
          .find({ userId: deleter._id })
          .exec();
        const allowedChuteIds = managerAssignments
          .filter((a) => a.chuteId)
          .map((a) => a.chuteId.toString());
        const allowedPlantIds = managerAssignments
          .filter((a) => a.plantId)
          .map((a) => a.plantId.toString());

        if (assignment.chuteId) {
          const chute = await this.chuteModel
            .findById(assignment.chuteId)
            .exec();
          const isChuteAllowed =
            allowedChuteIds.includes(assignment.chuteId.toString()) ||
            (chute && allowedPlantIds.includes(chute.plantId.toString()));
          if (!isChuteAllowed) {
            throw new BadRequestException(
              'Managers can only delete assignments for chutes they are assigned to',
            );
          }
        } else {
          throw new BadRequestException(
            'Managers cannot delete plant-level assignments',
          );
        }
      }
    }

    await assignment.deleteOne();

    const audit = new this.auditLogModel({
      action: 'Assignment Deletion',
      details: `Revoked assignment ${id} for user ${assignment.userId}`,
    });
    await audit.save();

    return { message: 'Assignment deleted successfully' };
  }

  // --- CALIBRATION ---
  async saveCalibration(
    chuteId: string,
    zone: number,
    baselineDistance: number,
    measuredDistance: number,
    calibrationMode: 'Auto' | 'Manual',
    notes: string,
    userId: string,
  ) {
    if (zone < 1 || zone > 4) throw new BadRequestException('Zone must be 1–4');
    const chuteObjId = new Types.ObjectId(chuteId);

    const accuracy =
      baselineDistance > 0
        ? Math.max(
            0,
            100 -
              Math.abs(
                (measuredDistance - baselineDistance) / baselineDistance,
              ) *
                100,
          )
        : 100;
    const passed = accuracy >= 85;

    const calibration = await this.calibrationLogModel.create({
      chuteId: chuteObjId,
      zone,
      baselineDistance,
      measuredDistance,
      accuracyPercent: Math.round(accuracy * 10) / 10,
      calibrationMode,
      passed,
      performedBy: new Types.ObjectId(userId),
      notes,
    });

    // Update radar calibration baseline
    await this.radarModel.findOneAndUpdate(
      { chuteId: chuteObjId, zone },
      { calibrationBaselineDistance: measuredDistance },
    );

    // Write immutable audit log
    await this.auditLogModel.create({
      action: 'RADAR_CALIBRATION',
      details: `Zone ${zone} calibrated: baseline=${baselineDistance}m, measured=${measuredDistance}m, accuracy=${accuracy.toFixed(1)}%, passed=${passed}`,
      userId: new Types.ObjectId(userId),
    });

    return {
      calibration,
      passed,
      accuracyPercent: calibration.accuracyPercent,
    };
  }

  async getCalibrationHistory(chuteId: string, limit = 20) {
    return this.calibrationLogModel
      .find({ chuteId: new Types.ObjectId(chuteId) })
      .populate('performedBy', 'name role ngId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
