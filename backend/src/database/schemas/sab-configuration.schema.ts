import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SabConfigurationDocument = SabConfiguration & Document;

/**
 * SabConfiguration — runtime configuration for the autonomous blast system.
 *
 * One document per chute (or a global default with chuteId = null).
 * Changes take effect immediately without restarting the backend.
 *
 * The Decision Engine reads these values on every prediction cycle,
 * so operators can tune thresholds live from the dashboard.
 */
@Schema({ timestamps: true })
export class SabConfiguration {
  /**
   * Scoped to a specific chute.
   * Null means this is the global/default configuration.
   */
  @Prop({ type: Types.ObjectId, ref: 'Chute', default: null })
  chuteId: Types.ObjectId | null;

  // ── Autonomous Mode ─────────────────────────────────────────────────────

  /** Master switch for fully autonomous blast execution */
  @Prop({ type: Boolean, default: false })
  autoBlastEnabled: boolean;

  // ── Prediction Thresholds ───────────────────────────────────────────────

  /**
   * Minimum blockage probability (0–100) required before the
   * Decision Engine considers scheduling a blast.
   */
  @Prop({ type: Number, default: 70 })
  blockageProbabilityThreshold: number;

  /**
   * Minimum AI confidence (0–100) required to auto-execute a blast.
   * Below this, the system raises a warning but does not fire.
   */
  @Prop({ type: Number, default: 85 })
  confidenceThreshold: number;

  // ── Severity Thresholds ─────────────────────────────────────────────────

  /** Blockage probability boundary: NORMAL → LOW */
  @Prop({ type: Number, default: 20 })
  severityLowThreshold: number;

  /** Blockage probability boundary: LOW → MODERATE */
  @Prop({ type: Number, default: 40 })
  severityModerateThreshold: number;

  /** Blockage probability boundary: MODERATE → HIGH */
  @Prop({ type: Number, default: 60 })
  severityHighThreshold: number;

  /** Blockage probability boundary: HIGH → CRITICAL */
  @Prop({ type: Number, default: 80 })
  severityCriticalThreshold: number;

  /** Blockage probability boundary: CRITICAL → EMERGENCY */
  @Prop({ type: Number, default: 95 })
  severityEmergencyThreshold: number;

  // ── Blast Parameters ────────────────────────────────────────────────────

  /** Minimum blast duration in milliseconds */
  @Prop({ type: Number, default: 500 })
  minBlastDurationMs: number;

  /** Maximum blast duration in milliseconds */
  @Prop({ type: Number, default: 5000 })
  maxBlastDurationMs: number;

  /**
   * Fixed blast duration in milliseconds.
   * When > 0, the dynamic calculator is overridden.
   */
  @Prop({ type: Number, default: 0 })
  fixedBlastDurationMs: number;

  /** Minimum compressor pressure (PSI) required to execute a blast */
  @Prop({ type: Number, default: 80 })
  minPressurePsi: number;

  // ── Retry & Cooldown ────────────────────────────────────────────────────

  /** Maximum number of retry attempts before creating an incident */
  @Prop({ type: Number, default: 3 })
  maxRetries: number;

  /**
   * Minimum interval (seconds) between retry attempts.
   * Overridden per material type when the learning engine has data.
   */
  @Prop({ type: Number, default: 30 })
  retryIntervalSeconds: number;

  /**
   * Cooldown period (seconds) after a successful blast.
   * Prevents immediate re-triggering while material settles.
   */
  @Prop({ type: Number, default: 60 })
  cooldownPeriodSeconds: number;

  // ── Telemetry Validation ────────────────────────────────────────────────

  /** Minimum radar signal quality (0–100) to accept telemetry */
  @Prop({ type: Number, default: 30 })
  minSignalQuality: number;

  /** Maximum allowable timestamp drift (seconds) for replay protection */
  @Prop({ type: Number, default: 5 })
  maxTimestampDriftSeconds: number;

  // ── Verification ────────────────────────────────────────────────────────

  /** Delay (ms) after blast to sample post-blast radar readings */
  @Prop({ type: Number, default: 30000 })
  verificationDelayMs: number;

  /** Minimum effectiveness score (0–100) to consider a blast successful */
  @Prop({ type: Number, default: 50 })
  minEffectivenessScore: number;

  // ── Heartbeat ───────────────────────────────────────────────────────────

  /** Expected heartbeat interval from hubs (seconds) */
  @Prop({ type: Number, default: 30 })
  heartbeatIntervalSeconds: number;

  /** After this many missed heartbeats, mark hub offline */
  @Prop({ type: Number, default: 3 })
  heartbeatMissedThreshold: number;

  // ── Learning Window ─────────────────────────────────────────────────────

  /** Number of past blast outcomes to consider for learning-based tuning */
  @Prop({ type: Number, default: 50 })
  learningWindowSize: number;
}

export const SabConfigurationSchema =
  SchemaFactory.createForClass(SabConfiguration);

// At most one config per chute (null = global default)
SabConfigurationSchema.index({ chuteId: 1 }, { unique: true, sparse: true });
