import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlastOutcomeDocument = BlastOutcome & Document;

/**
 * BlastOutcome — recorded for every blast event.
 * Compares radar distances 30s before vs 30s after the blast
 * to compute an Effectiveness Score (0–100).
 *
 * Score interpretation:
 *   80–100 : Full clearance — blast was highly effective
 *   50–79  : Partial clearance — chute improved but buildup remains
 *   20–49  : Minimal effect — buildup largely unchanged
 *   0–19   : No effect or worsened — escalation required
 */
@Schema({ timestamps: true })
export class BlastOutcome {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  /** Which physical air blaster fired (1–4) */
  @Prop({ required: true })
  blasterNumber: number;

  /** Solenoid valves that cycled during this blast */
  @Prop({ type: [Number], required: true })
  solenoidValves: number[];

  /** Radar distances (m) captured immediately before the blast, zones 1–4 */
  @Prop({ type: [Number], required: true })
  preBlastDistances: number[];

  /** Radar distances (m) captured ~30s after the blast, zones 1–4 */
  @Prop({ type: [Number], default: [] })
  postBlastDistances: number[];

  /**
   * Effectiveness score 0–100.
   * Computed once postBlastDistances are sampled.
   * -1 means pending (not yet scored).
   */
  @Prop({ required: true, default: -1 })
  effectivenessScore: number;

  /** 'manual' or 'auto' — how the blast was triggered */
  @Prop({ required: true, enum: ['manual', 'auto'], default: 'manual' })
  triggerMode: string;

  /** Whether the blast cleared the chute (effectivenessScore >= 50) */
  @Prop({ required: true, default: false })
  didClear: boolean;

  /** Estimated air volume consumed (litres), derived from pressure × cycle duration */
  @Prop({ required: true, default: 0 })
  estimatedAirLitres: number;

  /**
   * If this blast did not clear and it's the Nth consecutive failed blast,
   * this field holds the count. Used for auto-escalation.
   */
  @Prop({ required: true, default: 0 })
  consecutiveFailedBlastCount: number;
}

export const BlastOutcomeSchema = SchemaFactory.createForClass(BlastOutcome);

// Index for fast retrieval by chute + recency
BlastOutcomeSchema.index({ chuteId: 1, createdAt: -1 });
