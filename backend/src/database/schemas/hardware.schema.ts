import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RadarDocument = Radar & Document;
export type AirBlasterDocument = AirBlaster & Document;
export type SolenoidDocument = Solenoid & Document;
export type CompressorDocument = Compressor & Document;

@Schema({ timestamps: true })
export class Radar {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, enum: [1, 2, 3, 4] })
  zone: number;

  @Prop({ required: true, default: 0 })
  distance: number; // Raw sensor reading in metres

  @Prop({ required: true, default: false })
  buildupDetected: boolean;

  @Prop({ default: Date.now })
  lastScanTime: Date;

  /**
   * Distance reading from the previous scan cycle.
   * Used to compute buildupRatePerMin (positive = material accumulating).
   */
  @Prop({ default: null })
  previousDistance: number;

  /**
   * Rate of change in metres per minute.
   * Negative = distance decreasing = material building up.
   * Positive = distance increasing = chute clearing.
   */
  @Prop({ default: 0 })
  buildupRatePerMin: number;

  @Prop({ required: true, default: 100 })
  healthScore: number;

  /**
   * Trend direction based on last N scans:
   * 'rising' | 'stable' | 'clearing'
   */
  @Prop({
    required: true,
    enum: ['rising', 'stable', 'clearing'],
    default: 'stable',
  })
  trendDirection: string;

  /**
   * Calibration baseline distance (metres) — the expected clear-chute reading.
   * Used to detect sensor drift. Set on first successful scan or manual calibration.
   */
  @Prop({ default: null })
  calibrationBaselineDistance: number;

  @Prop({ default: '1.0.0' })
  firmware: string;

  @Prop({ default: '1.0' })
  hardwareVersion: string;

  @Prop({ default: null })
  macAddress: string;

  @Prop({ default: null })
  serialNumber: string;

  @Prop({ default: Date.now })
  installationDate: Date;

  @Prop({ default: Date.now })
  lastMaintenance: Date;

  @Prop({ default: null })
  lastHeartbeat: Date;

  @Prop({ default: 'Offline' })
  onlineStatus: string;
}

export const RadarSchema = SchemaFactory.createForClass(Radar);
RadarSchema.index({ chuteId: 1, zone: 1 });

@Schema({ timestamps: true })
export class AirBlaster {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, enum: [1, 2, 3, 4] })
  blasterNumber: number;

  @Prop({ required: true, default: 0 })
  totalBlasts: number;

  @Prop({ required: true, default: 20000 }) // Lifespan expectation
  lifespanBlasts: number;

  @Prop({ required: true, default: 100 })
  healthScore: number; // Percentage health

  @Prop({ default: Date.now })
  lastBlastTime: Date;

  @Prop({ default: '1.0.0' })
  firmware: string;

  @Prop({ default: '1.0' })
  hardwareVersion: string;

  @Prop({ default: null })
  macAddress: string;

  @Prop({ default: null })
  serialNumber: string;

  @Prop({ default: Date.now })
  installationDate: Date;

  @Prop({ default: Date.now })
  lastMaintenance: Date;

  @Prop({ default: null })
  lastHeartbeat: Date;

  @Prop({ default: 'Offline' })
  onlineStatus: string;
}

export const AirBlasterSchema = SchemaFactory.createForClass(AirBlaster);
AirBlasterSchema.index({ chuteId: 1, blasterNumber: 1 });

@Schema({ timestamps: true })
export class Solenoid {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true })
  valveNumber: number; // 1 to 8

  @Prop({ required: true, default: 0 })
  totalCycles: number;

  @Prop({ required: true, default: 50000 }) // Lifespan cycles
  lifespanCycles: number;

  @Prop({ required: true, default: 100 })
  healthScore: number;

  @Prop({ default: Date.now })
  lastCycleTime: Date;

  @Prop({ default: '1.0.0' })
  firmware: string;

  @Prop({ default: '1.0' })
  hardwareVersion: string;

  @Prop({ default: null })
  macAddress: string;

  @Prop({ default: null })
  serialNumber: string;

  @Prop({ default: Date.now })
  installationDate: Date;

  @Prop({ default: Date.now })
  lastMaintenance: Date;

  @Prop({ default: null })
  lastHeartbeat: Date;

  @Prop({ default: 'Offline' })
  onlineStatus: string;
}

export const SolenoidSchema = SchemaFactory.createForClass(Solenoid);
SolenoidSchema.index({ chuteId: 1, valveNumber: 1 });

@Schema({ timestamps: true })
export class Compressor {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  pressure: number; // PSI

  @Prop({ required: true, default: 0 })
  runtimeHours: number;

  @Prop({ required: true, default: 0 })
  refillDuration: number; // seconds to refill

  @Prop({ required: true, default: 0 })
  refillFrequency: number; // times per hour

  @Prop({ required: true, default: 25 })
  motorTemperature: number; // Celsius

  @Prop({ required: true, default: 100 })
  efficiency: number; // Percentage

  @Prop({ required: true, default: 100 })
  healthScore: number;

  /**
   * Cumulative air volume consumed by all blasts (litres).
   * Estimated: pressure × tank_volume_factor × cycles.
   */
  @Prop({ required: true, default: 0 })
  totalAirLitresConsumed: number;

  /**
   * Number of blasts that scored < 20 effectiveness AND had no radar buildup > threshold.
   * These are blasts that consumed air without meaningful cause.
   */
  @Prop({ required: true, default: 0 })
  unnecessaryBlastsCount: number;

  /**
   * Rolling average litres per blast (last 50 blasts).
   * Used for ROI air-cost calculations.
   */
  @Prop({ required: true, default: 0 })
  airLitresPerBlastAvg: number;

  @Prop({ default: '1.0.0' })
  firmware: string;

  @Prop({ default: '1.0' })
  hardwareVersion: string;

  @Prop({ default: null })
  macAddress: string;

  @Prop({ default: null })
  serialNumber: string;

  @Prop({ default: Date.now })
  installationDate: Date;

  @Prop({ default: Date.now })
  lastMaintenance: Date;

  @Prop({ default: null })
  lastHeartbeat: Date;

  @Prop({ default: 'Offline' })
  onlineStatus: string;
}

export const CompressorSchema = SchemaFactory.createForClass(Compressor);
CompressorSchema.index({ chuteId: 1 });
