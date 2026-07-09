import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommandDocument = Command & Document;

/**
 * Command — audit/lifecycle record for every command dispatched to hardware.
 *
 * Tracks the full lifecycle: CREATED → QUEUED → PUBLISHED → RECEIVED →
 * VALIDATED → EXECUTING → COMPLETED / FAILED / TIMEOUT.
 *
 * Every state transition timestamp is recorded for traceability and replay.
 */
@Schema({ timestamps: true })
export class Command {
  /**
   * Globally unique command identifier (UUID v4).
   * Referenced in MQTT payloads so acknowledgements can be correlated.
   */
  @Prop({ required: true, unique: true, index: true })
  commandId: string;

  // ── Target Device Mapping ───────────────────────────────────────────────

  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cell', default: null })
  cellId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  hubId: string | null;

  @Prop({ type: String, default: null })
  sabId: string | null;

  @Prop({ type: String, default: null })
  solenoidId: string | null;

  // ── Command Details ─────────────────────────────────────────────────────

  @Prop({
    required: true,
    enum: [
      'blast',
      'open_solenoid',
      'close_solenoid',
      'override_radar',
      'calibrate',
      'restart',
      'start_simulation',
      'stop_simulation',
      'diagnostics',
      'firmware_update',
    ],
  })
  action: string;

  /**
   * Full lifecycle status.
   * Updated as acknowledgements arrive from the hub via MQTT.
   */
  @Prop({
    required: true,
    enum: [
      'CREATED',
      'QUEUED',
      'PUBLISHED',
      'RECEIVED',
      'VALIDATED',
      'EXECUTING',
      'COMPLETED',
      'FAILED',
      'TIMEOUT',
      'CANCELLED',
    ],
    default: 'CREATED',
  })
  status: string;

  /** The raw MQTT payload that was (or will be) published */
  @Prop({ type: Object, default: {} })
  payload: Record<string, any>;

  /** Result data returned by the hub upon completion */
  @Prop({ type: Object, default: null })
  result: Record<string, any> | null;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ default: 3 })
  maxRetries: number;

  /** Execution wall-clock time in milliseconds (set on COMPLETED) */
  @Prop({ type: Number, default: null })
  executionTimeMs: number | null;

  // ── Source & Trigger ────────────────────────────────────────────────────

  /**
   * Who or what triggered this command.
   * - 'ai'        : Autonomous AI decision engine
   * - 'manual'    : Operator via REST/Dashboard
   * - 'scheduler' : Scheduled maintenance blast
   * - 'simulation': Simulator
   */
  @Prop({
    required: true,
    enum: ['ai', 'manual', 'scheduler', 'simulation'],
    default: 'manual',
  })
  triggerSource: string;

  /** The operator who triggered (null for AI-autonomous commands) */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  triggeredBy: Types.ObjectId | null;

  // ── AI Decision Metadata ────────────────────────────────────────────────

  /** AI blockage probability at time of command creation (0–100) */
  @Prop({ type: Number, default: null })
  aiProbability: number | null;

  /** AI confidence score at time of command creation (0–100) */
  @Prop({ type: Number, default: null })
  aiConfidence: number | null;

  /** Severity level at time of command creation */
  @Prop({ type: String, default: null })
  aiSeverity: string | null;

  // ── Lifecycle Timestamps ────────────────────────────────────────────────

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ type: Date, default: null })
  receivedAt: Date | null;

  @Prop({ type: Date, default: null })
  executionStartedAt: Date | null;

  @Prop({ type: Date, default: null })
  executionEndedAt: Date | null;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Date, default: null })
  failedAt: Date | null;

  @Prop({ type: Date, default: null })
  timedOutAt: Date | null;

  /** Human-readable failure reason (set on FAILED or TIMEOUT) */
  @Prop({ type: String, default: null })
  failureReason: string | null;

  @Prop({ type: Boolean, default: false })
  isManualOverride: boolean;

  @Prop({ type: Date, default: null })
  completionTime: Date | null;

  @Prop({ type: Number, default: null })
  verificationScore: number | null;
}

export const CommandSchema = SchemaFactory.createForClass(Command);
CommandSchema.index({ chuteId: 1, createdAt: -1 });
CommandSchema.index({ status: 1 });
CommandSchema.index({ hubId: 1, status: 1 });
CommandSchema.index({ triggerSource: 1, createdAt: -1 });
