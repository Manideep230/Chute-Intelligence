import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HubDocument = Hub & Document;

/**
 * Hub — the industrial edge gateway (Nigha Hub).
 *
 * Each Hub connects to the EMQX MQTT broker and manages
 * local SABs, solenoids, radars, and compressor connections.
 *
 * Hierarchy: Plant → Chute → Cell → Hub
 */
@Schema({ timestamps: true })
export class Hub {
  /**
   * Unique 16-digit hardware identifier.
   * Printed on the device and encoded in the QR sticker.
   */
  @Prop({ required: true, unique: true, index: true })
  hubId: string;

  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cell', default: null })
  cellId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Plant', default: null })
  plantId: Types.ObjectId | null;

  @Prop({ default: '' })
  hubName: string;

  // ── Authentication & Identity ───────────────────────────────────────────

  /** Operator-assigned pass name for MQTT topic authentication */
  @Prop({ required: true })
  passName: string;

  /** Secret key paired with passName, validated on every command */
  @Prop({ required: true })
  passKey: string;

  /** SIM card number for cellular-connected hubs (optional) */
  @Prop({ type: String, default: null })
  simNumber: string | null;

  @Prop({ type: String, default: null })
  macAddress: string | null;

  @Prop({ type: String, default: null })
  serialNumber: string | null;

  @Prop({ type: String, default: null })
  deviceModel: string | null;

  // ── Firmware & Hardware ─────────────────────────────────────────────────

  @Prop({ default: '1.0.0' })
  firmware: string;

  @Prop({ default: '1.0' })
  hardwareVersion: string;

  // ── Heartbeat & Health ──────────────────────────────────────────────────

  @Prop({ type: Date, default: null })
  lastHeartbeat: Date | null;

  @Prop({
    required: true,
    enum: ['Online', 'Offline', 'Warning', 'Fault', 'Maintenance', 'CalibrationRequired'],
    default: 'Offline',
  })
  status: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  registrationDate: Date | null;
}

export const HubSchema = SchemaFactory.createForClass(Hub);
HubSchema.index({ chuteId: 1 });
HubSchema.index({ cellId: 1 });
HubSchema.index({ plantId: 1 });
HubSchema.index({ status: 1 });
