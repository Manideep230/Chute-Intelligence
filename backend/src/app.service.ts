import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
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
  HubHealth,
  HubHealthDocument,
  AiPrediction,
  AiPredictionDocument,
  Role,
  RoleDocument,
  Organization,
  OrganizationDocument,
  Region,
  RegionDocument,
} from './database/schemas';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger('DatabaseSeeder');

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Plant.name) private plantModel: Model<PlantDocument>,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Radar.name) private radarModel: Model<RadarDocument>,
    @InjectModel(AirBlaster.name)
    private airBlasterModel: Model<AirBlasterDocument>,
    @InjectModel(Solenoid.name) private solenoidModel: Model<SolenoidDocument>,
    @InjectModel(Compressor.name)
    private compressorModel: Model<CompressorDocument>,
    @InjectModel(HubHealth.name)
    private hubHealthModel: Model<HubHealthDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedData();
    } catch (err) {
      this.logger.error(`Database seeding failed: ${err.message}`);
    }
  }

  getHello(): string {
    return 'Nigha Radar Enterprise Industrial AI API is running.';
  }

  private async seedData() {
    // 0. Seed Organizations and Regions
    let defaultOrg = await this.orgModel
      .findOne({ domain: 'holcim.com' })
      .exec();
    if (!defaultOrg) {
      this.logger.log('Seeding default organization...');
      defaultOrg = await this.orgModel.create({
        name: 'Holcim Group',
        domain: 'holcim.com',
        description:
          'Global building materials and cement plant operations group.',
        subscriptionTier: 'SaaS Enterprise',
        ssoEnabled: true,
      });
    }

    let defaultRegion = await this.regionModel
      .findOne({ name: 'APAC', organizationId: defaultOrg._id })
      .exec();
    if (!defaultRegion) {
      this.logger.log('Seeding default region...');
      defaultRegion = await this.regionModel.create({
        name: 'APAC',
        organizationId: defaultOrg._id,
        description: 'Asia Pacific Regional Division',
      });
    }

    // 1. Seed Roles
    const roleCount = await this.roleModel.countDocuments().exec();
    if (roleCount === 0) {
      this.logger.log('Seeding default roles...');
      await this.roleModel.create([
        { name: 'Super Admin', permissions: ['*'] },
        { name: 'Admin', permissions: ['manage_plants', 'manage_workers'] },
        { name: 'Manager', permissions: ['monitor_chutes', 'manage_tickets'] },
        { name: 'Worker', permissions: ['view_chutes', 'update_tickets'] },
      ]);
    }

    // 1.5 Run Migration to standardise legacy plants, chutes, and users
    await this.runMigration(defaultOrg);

    // 2. Seed Default Plant & Chute
    const plantCount = await this.plantModel.countDocuments().exec();
    let seededPlant: any = null;
    let seededChute: any = null;
    if (plantCount === 0) {
      this.logger.log('Seeding default plant and chute...');
      seededPlant = await this.plantModel.create({
        name: 'Nevada Ore Processing Plant',
        location: 'Nevada, USA',
        gpsCoordinates: { lat: 36.1699, lng: -115.1398 },
        description:
          'Primary mining processing facility with heavy-flow ore transfer chutes.',
        organizationId: defaultOrg._id,
        regionId: defaultRegion._id,
        plantCode: 'NEV',
        ngPrefix: 'NGNEV',
        currentSequence: 0,
        currentChuteSequence: 1,
        isActive: true,
      });

      seededChute = await this.chuteModel.create({
        name: 'Primary Transfer Chute #1',
        plantId: seededPlant._id,
        gpsCoordinates: { lat: 36.1705, lng: -115.1402 },
        status: 'Normal',
        totalBlasts: 0,
        lastSyncTime: new Date(),
        chuteCode: 'NGNEV-CH-00001',
        isActive: true,
      });

      const chuteId = seededChute._id;

      // Seed 4 radars
      for (let i = 1; i <= 4; i++) {
        await this.radarModel.create({
          chuteId,
          zone: i,
          distance: 3.5,
          buildupDetected: false,
        });
      }

      // Seed 4 blasters
      for (let i = 1; i <= 4; i++) {
        await this.airBlasterModel.create({
          chuteId,
          blasterNumber: i,
          totalBlasts: 0,
          lifespanBlasts: 20000,
          healthScore: 100,
        });
      }

      // Seed 8 solenoids
      for (let i = 1; i <= 8; i++) {
        await this.solenoidModel.create({
          chuteId,
          valveNumber: i,
          totalCycles: 0,
          lifespanCycles: 50000,
          healthScore: 100,
        });
      }

      // Seed 1 compressor
      await this.compressorModel.create({
        chuteId,
        pressure: 110,
        runtimeHours: 120,
        refillDuration: 42,
        refillFrequency: 1.5,
        motorTemperature: 32,
        efficiency: 99,
        healthScore: 100,
      });

      // Seed hub health
      await this.hubHealthModel.create({
        chuteId,
        isOnline: true,
        localLogsCount: 0,
        lastPing: new Date(),
      });

      // Seed AI predictions
      await this.aiPredictionModel.create({
        chuteId,
        blockageProbability: 5,
        compressorFailureProbability: 2,
        solenoidWearProbability: 0,
        airBlasterMaintenanceProbability: 0,
        recommendedActions: ['System Operating Normally.'],
      });

      this.logger.log(`Seed plant and chute initialized. Chute ID: ${chuteId}`);
    } else {
      seededPlant = await this.plantModel.findOne({ plantCode: 'NEV' }).exec();
      seededChute = await this.chuteModel
        .findOne({ plantId: seededPlant?._id })
        .exec();
    }

    // 3. Seed Default Users
    const userCount = await this.userModel.countDocuments().exec();
    if (userCount === 0 && seededPlant) {
      this.logger.log('Seeding default users...');
      // Super Admin
      await this.userModel.create({
        ngId: 'NGSA000001',
        name: 'Super Admin',
        phone: '+919999999999',
        role: 'Super Admin',
        isActive: true,
        organizationId: defaultOrg._id,
        assignedPlantIds: [],
      });
      // Worker Tech
      const worker = await this.userModel.create({
        ngId: 'NGNEV000001',
        name: 'Worker Tech',
        phone: '+918888888888',
        role: 'Worker',
        isActive: true,
        organizationId: defaultOrg._id,
        assignedPlantIds: [seededPlant._id],
      });

      // Set current plant sequence
      seededPlant.currentSequence = 1;
      await seededPlant.save();

      // Seed initial assignment for Worker Tech
      if (seededChute) {
        try {
          const assignmentModel = this.userModel.db.model('Assignment');
          await assignmentModel.create({
            userId: worker._id,
            plantId: seededPlant._id,
            chuteId: seededChute._id,
          });
          this.logger.log('Seeded assignment for Worker Tech successfully.');
        } catch (e) {
          this.logger.warn(`Could not seed assignment: ${e.message}`);
        }
      }

      this.logger.log(
        'Seed users successfully created. Super Admin: +919999999999, Worker: +918888888888 (OTP: 123456)',
      );
    }
  }

  private async runMigration(defaultOrg: any) {
    this.logger.log('Running startup database migration...');

    // 1. Backfill existing plants with codes and sequences
    const plants = await this.plantModel.find().exec();
    for (const plant of plants) {
      let updated = false;
      if (!plant.plantCode) {
        // Derive code from name
        const code =
          plant.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .substring(0, 3)
            .toUpperCase() || 'PLT';
        plant.plantCode = code;
        plant.ngPrefix = `NG${code}`;
        updated = true;
      }
      if (
        plant.currentSequence === undefined ||
        plant.currentSequence === null
      ) {
        plant.currentSequence = 0;
        updated = true;
      }
      if (
        plant.currentChuteSequence === undefined ||
        plant.currentChuteSequence === null
      ) {
        plant.currentChuteSequence = 0;
        updated = true;
      }
      if (plant.isActive === undefined || plant.isActive === null) {
        plant.isActive = true;
        updated = true;
      }
      if (updated) {
        await plant.save();
      }
    }

    // 2. Backfill existing chutes with codes and active flag
    const chutes = await this.chuteModel.find().exec();
    for (const chute of chutes) {
      let updated = false;
      if (!chute.chuteCode) {
        const plant = await this.plantModel.findById(chute.plantId).exec();
        if (plant) {
          let unique = false;
          let code = '';
          while (!unique) {
            plant.currentChuteSequence += 1;
            code = `${plant.ngPrefix}-CH-${String(plant.currentChuteSequence).padStart(5, '0')}`;
            const exists = await this.chuteModel
              .findOne({ chuteCode: code })
              .exec();
            if (!exists) {
              unique = true;
            }
          }
          await plant.save();
          chute.chuteCode = code;
          updated = true;
        }
      }
      if (chute.isActive === undefined || chute.isActive === null) {
        chute.isActive = true;
        updated = true;
      }
      if (updated) {
        await chute.save();
      }
    }

    // 3. Backfill existing users (assign default plant, generate sequential ngId)
    const users = await this.userModel.find().exec();
    const defaultPlant = await this.plantModel.findOne().exec();
    for (const user of users) {
      let updated = false;
      if (user.role !== 'Super Admin' && defaultPlant) {
        if (!user.assignedPlantIds || user.assignedPlantIds.length === 0) {
          user.assignedPlantIds = [defaultPlant._id];
          updated = true;
        }
        // If they have standard legacy NG IDs or missing prefix
        if (
          user.ngId &&
          user.ngId.startsWith('NG') &&
          !user.ngId.startsWith('NGSA') &&
          !user.ngId.startsWith(defaultPlant.ngPrefix)
        ) {
          let unique = false;
          let newNgId = '';
          while (!unique) {
            defaultPlant.currentSequence += 1;
            newNgId = `${defaultPlant.ngPrefix}${String(defaultPlant.currentSequence).padStart(6, '0')}`;
            const exists = await this.userModel
              .findOne({ ngId: newNgId })
              .exec();
            if (!exists) {
              unique = true;
            }
          }
          await defaultPlant.save();
          user.ngId = newNgId;
          updated = true;
        }
      } else if (user.role === 'Super Admin') {
        if (user.ngId === 'NG000001') {
          user.ngId = 'NGSA000001';
          updated = true;
        }
        if (!user.assignedPlantIds) {
          user.assignedPlantIds = [];
          updated = true;
        }
      }
      if (updated) {
        await user.save();
      }
    }

    this.logger.log('Startup database migration completed successfully.');
  }
}
