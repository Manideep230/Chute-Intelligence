import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlantDocument = Plant & Document;
export type ChuteDocument = Chute & Document;

@Schema({ timestamps: true })
export class Plant {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false, default: '' })
  location: string; // e.g. "Nevada, USA" — optional, kept for backward compat

  @Prop({ type: { lat: Number, lng: Number }, required: false, default: null })
  gpsCoordinates: { lat: number; lng: number } | null;

  @Prop({ default: '' })
  description: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: false,
    default: null,
  })
  organizationId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Region', required: false, default: null })
  regionId: Types.ObjectId | null;

  @Prop({ required: true, unique: true, index: true })
  plantCode: string;

  @Prop({ required: true })
  ngPrefix: string;

  @Prop({ type: Number, default: 0 })
  currentSequence: number;

  @Prop({ type: Number, default: 0 })
  currentChuteSequence: number;

  @Prop({ default: 'Mining' })
  industryType: string;

  @Prop({ default: '' })
  ownerName: string;

  @Prop({ default: '' })
  contactNumber: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  disabledAt: Date | null;
}

export const PlantSchema = SchemaFactory.createForClass(Plant);

PlantSchema.pre(
  'deleteOne',
  { document: true, query: false },
  async function (this: any) {
    try {
      const chuteModel = this.model('Chute');
      const chutes = await chuteModel.find({ plantId: this._id }).exec();
      for (const chute of chutes) {
        await chute.deleteOne();
      }
    } catch (e) {
      // Ignore model compiler or connection issues during E2E
    }
  },
);

PlantSchema.pre('findOneAndDelete', async function (this: any) {
  try {
    const doc = await this.model.findOne(this.getQuery()).exec();
    if (doc) {
      const chuteModel = this.model.db.model('Chute');
      const chutes = await chuteModel.find({ plantId: doc._id }).exec();
      for (const chute of chutes) {
        await chute.deleteOne();
      }
    }
  } catch (e) {
    // Ignore
  }
});

@Schema({ timestamps: true })
export class Chute {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Plant', required: true })
  plantId: Types.ObjectId;

  @Prop({ type: { lat: Number, lng: Number }, required: false, default: null })
  gpsCoordinates: { lat: number; lng: number } | null;

  @Prop({
    required: true,
    enum: ['Normal', 'Buildup', 'Blocked', 'Blasting'],
    default: 'Normal',
  })
  status: string;

  @Prop({ default: 0 })
  totalBlasts: number;

  @Prop({ default: Date.now })
  lastSyncTime: Date;

  /**
   * Material being handled in this chute.
   * Controls AI sensitivity thresholds:
   *  - 'coal'      : high humidity sensitivity (coal swells when wet)
   *  - 'iron_ore'  : moderate; heavy material, fast buildup
   *  - 'limestone' : high humidity sensitivity, sticky when wet
   *  - 'grain'     : very high humidity sensitivity, low temperature sensitivity
   *  - 'generic'   : default balanced thresholds
   */
  @Prop({
    required: true,
    enum: ['coal', 'iron_ore', 'limestone', 'grain', 'generic'],
    default: 'generic',
  })
  materialType: string;

  /**
   * Number of consecutive blasts that failed to clear this chute.
   * Reset to 0 when chute reaches Normal status.
   * Auto-escalates to Critical alert when >= 2.
   */
  @Prop({ default: 0 })
  consecutiveFailedBlasts: number;

  @Prop({ required: false, unique: true, sparse: true })
  chuteCode: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    required: true,
    enum: ['LEFT_SLANT', 'RIGHT_SLANT'],
    default: 'LEFT_SLANT',
  })
  activePath: string;

  @Prop({ type: Boolean, default: false })
  simulationMode: boolean;

  @Prop({ default: 'None' })
  blockagePosition: string;

  @Prop({ type: Number, default: 3.5 })
  blockageDistance: number;

  @Prop({ type: Number, default: 1 })
  nearestSolenoidGroup: number;

  /**
   * Physical hardware hub device ID linked to this chute via QR onboarding.
   * Set when an operator scans the chute QR code on the physical device.
   * Null means no device has been paired yet.
   */
  @Prop({ type: String, default: null })
  linkedDeviceId: string | null;

  @Prop({ type: Date, default: null })
  deviceLinkedAt: Date | null;
}

export const ChuteSchema = SchemaFactory.createForClass(Chute);

ChuteSchema.pre(
  'deleteOne',
  { document: true, query: false },
  async function (this: any) {
    try {
      const chuteId = this._id;
      const db = this.model('Chute').db;
      const models = [
        'Radar',
        'AirBlaster',
        'Solenoid',
        'Compressor',
        'Telemetry',
        'Alert',
        'Incident',
        'MaintenanceTicket',
        'HubHealth',
        'AiPrediction',
        'BlastOutcome',
        'ChuteUptimeLog',
        'CalibrationLog',
      ];

      for (const mName of models) {
        try {
          const model = db.model(mName);
          await model.deleteMany({ chuteId }).exec();
        } catch (e) {
          // Model might not be compiled yet, ignore
        }
      }
    } catch (e) {
      // Ignore
    }
  },
);

ChuteSchema.pre('findOneAndDelete', async function (this: any) {
  try {
    const doc = await this.model.findOne(this.getQuery()).exec();
    if (doc) {
      const chuteId = doc._id;
      const db = this.model.db;
      const models = [
        'Radar',
        'AirBlaster',
        'Solenoid',
        'Compressor',
        'Telemetry',
        'Alert',
        'Incident',
        'MaintenanceTicket',
        'HubHealth',
        'AiPrediction',
        'BlastOutcome',
        'ChuteUptimeLog',
        'CalibrationLog',
      ];

      for (const mName of models) {
        try {
          const model = db.model(mName);
          await model.deleteMany({ chuteId }).exec();
        } catch (e) {
          // Model might not be compiled yet, ignore
        }
      }
    }
  } catch (e) {
    // Ignore
  }
});

export { Types };
