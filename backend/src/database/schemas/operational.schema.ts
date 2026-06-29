import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertDocument = Alert & Document;
export type NotificationDocument = Notification & Document;
export type TelemetryDocument = Telemetry & Document;
export type GpsLocationDocument = GpsLocation & Document;
export type HubHealthDocument = HubHealth & Document;
export type AiPredictionDocument = AiPrediction & Document;

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, enum: ['Low', 'Medium', 'High', 'Critical'] })
  severity: string;

  @Prop({ required: true, enum: ['Radar', 'Compressor', 'Solenoid', 'System'] })
  source: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, default: false })
  isResolved: boolean;

  @Prop({ default: null })
  resolvedAt: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index({ chuteId: 1, isResolved: 1 });

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Alert', default: null })
  alertId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({
    type: [String],
    enum: ['in-app', 'browser', 'sms'],
    default: ['in-app'],
  })
  channels: string[];

  @Prop({
    required: true,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  })
  status: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

@Schema({ timestamps: true })
export class Telemetry {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ type: [Number], required: true })
  radarValues: number[]; // e.g. distance of the 4 sensors

  @Prop({ required: true })
  temperature: number;

  @Prop({ required: true })
  humidity: number;

  @Prop({ required: true })
  pressure: number;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);
TelemetrySchema.index({ chuteId: 1, createdAt: -1 });

@Schema({ timestamps: true })
export class GpsLocation {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const GpsLocationSchema = SchemaFactory.createForClass(GpsLocation);

@Schema({ timestamps: true })
export class HubHealth {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, default: true })
  isOnline: boolean;

  @Prop({ default: Date.now })
  lastPing: Date;

  @Prop({ default: 0 })
  localLogsCount: number;
}

export const HubHealthSchema = SchemaFactory.createForClass(HubHealth);

@Schema({ timestamps: true })
export class AiPrediction {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  blockageProbability: number; // percentage 0-100

  @Prop({ required: true, default: 0 })
  compressorFailureProbability: number; // percentage 0-100

  @Prop({ required: true, default: 0 })
  solenoidWearProbability: number; // percentage 0-100

  @Prop({ required: true, default: 0 })
  airBlasterMaintenanceProbability: number; // percentage 0-100

  @Prop({ type: [String], default: [] })
  recommendedActions: string[];

  /**
   * Average buildup rate across all active radar zones (m/min, negative = accumulating).
   * Derived from rolling window of last 10 scans per zone.
   */
  @Prop({ required: true, default: 0 })
  buildupRatePerMin: number;

  /**
   * Fleet-level trend for this chute: 'rising' | 'stable' | 'clearing'
   * Majority-vote across zones weighted by distance from baseline.
   */
  @Prop({
    required: true,
    enum: ['rising', 'stable', 'clearing'],
    default: 'stable',
  })
  overallTrend: string;

  /**
   * Effectiveness score of the last blast (0–100). -1 if never blasted.
   * Displayed on Digital Twin to give operators immediate blast quality feedback.
   */
  @Prop({ required: true, default: -1 })
  lastBlastEffectivenessScore: number;

  /**
   * Number of consecutive blasts that failed to clear (score < 50).
   * Triggers Critical alert at >= 2.
   */
  @Prop({ required: true, default: 0 })
  consecutiveFailedBlasts: number;

  /**
   * Chute uptime percentage in the last 24 hours.
   * Computed from ChuteUptimeLog: (Normal + Blasting seconds) / 86400 × 100
   */
  @Prop({ required: true, default: 100 })
  uptimePercent24h: number;

  /**
   * Total minutes the chute was in 'Blocked' status today (midnight to now).
   */
  @Prop({ required: true, default: 0 })
  blockageMinutesToday: number;

  /**
   * Estimated air litres consumed today across all blasts.
   */
  @Prop({ required: true, default: 0 })
  airLitresToday: number;
}

export const AiPredictionSchema = SchemaFactory.createForClass(AiPrediction);
