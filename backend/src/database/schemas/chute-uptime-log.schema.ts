import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChuteUptimeLogDocument = ChuteUptimeLog & Document;

/**
 * ChuteUptimeLog — one record per status transition.
 * Records the status that was ENTERED, when it was entered,
 * and how long it lasted (durationSeconds, populated when the next
 * transition closes this record).
 *
 * Enables:
 *  - Uptime % calculation (sum of 'Normal' duration / total time)
 *  - Blockage minutes per shift
 *  - Worst-performing chute identification
 *  - ROI calculation (blockage minutes × cost per minute)
 */
@Schema({ timestamps: true })
export class ChuteUptimeLog {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  /** The status that was entered at enteredAt */
  @Prop({ required: true, enum: ['Normal', 'Buildup', 'Blocked', 'Blasting'] })
  status: string;

  /** When this status began */
  @Prop({ required: true, default: Date.now })
  enteredAt: Date;

  /**
   * When this status ended (null = currently active).
   * Populated when the next status transition occurs.
   */
  @Prop({ default: null })
  exitedAt: Date;

  /**
   * Duration in seconds (null until exitedAt is set).
   * Pre-computed for fast aggregation queries.
   */
  @Prop({ default: null })
  durationSeconds: number;

  /**
   * What caused the transition INTO this status:
   * 'radar_detection' | 'blast_clearance' | 'manual_override' | 'system_init'
   */
  @Prop({ required: true, default: 'system_init' })
  transitionCause: string;
}

export const ChuteUptimeLogSchema =
  SchemaFactory.createForClass(ChuteUptimeLog);

// Compound index for per-chute time-range queries (shift reports, KPI calculations)
ChuteUptimeLogSchema.index({ chuteId: 1, enteredAt: -1 });
ChuteUptimeLogSchema.index({ chuteId: 1, status: 1, enteredAt: -1 });
