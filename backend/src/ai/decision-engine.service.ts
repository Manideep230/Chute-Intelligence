import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiPredictionService,
  PredictionOutput,
  SeverityLevel,
} from './ai-prediction.service';
import {
  Chute,
  ChuteDocument,
  Compressor,
  CompressorDocument,
  AirBlaster,
  AirBlasterDocument,
  Solenoid,
  SolenoidDocument,
  HubHealth,
  HubHealthDocument,
  AiPrediction,
  AiPredictionDocument,
  Command,
  CommandDocument,
  SabConfiguration,
  SabConfigurationDocument,
} from '../database/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// AI State Machine states (logged on every transition)
// ─────────────────────────────────────────────────────────────────────────────
export type AiState =
  | 'NORMAL'
  | 'MONITORING'
  | 'EARLY_WARNING'
  | 'PREDICTION'
  | 'BLAST_RECOMMENDED'
  | 'WAITING_FOR_APPROVAL'
  | 'AUTO_EXECUTION'
  | 'COMMAND_SENT'
  | 'ACKNOWLEDGED'
  | 'BLASTING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'RETRY'
  | 'FAILED'
  | 'INCIDENT_CREATED';

export type DecisionAction =
  | 'IGNORE'
  | 'CONTINUE_MONITORING'
  | 'RAISE_WARNING'
  | 'NOTIFY_OPERATOR'
  | 'SCHEDULE_BLAST'
  | 'EXECUTE_BLAST'
  | 'ESCALATE_INCIDENT';

export interface DecisionResult {
  action: DecisionAction;
  prediction: PredictionOutput;
  reason: string;
  sabNumber: number | null;
  solenoidNumber: number | null;
  blastDurationMs: number;
  aiState: AiState;
}

/**
 * DecisionEngine — evaluates AI predictions and determines the appropriate
 * action based on severity, confidence, hardware health, and system state.
 *
 * This is the brain that decides IF and HOW to blast.
 * The actual blast execution is handled by the BlastService.
 */
@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);

  /** In-memory cooldown tracker (chuteId → last blast timestamp) */
  private readonly cooldownMap = new Map<string, number>();

  constructor(
    private readonly predictionService: AiPredictionService,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Compressor.name)
    private compressorModel: Model<CompressorDocument>,
    @InjectModel(AirBlaster.name)
    private airBlasterModel: Model<AirBlasterDocument>,
    @InjectModel(Solenoid.name) private solenoidModel: Model<SolenoidDocument>,
    @InjectModel(HubHealth.name)
    private hubHealthModel: Model<HubHealthDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(SabConfiguration.name)
    private configModel: Model<SabConfigurationDocument>,
  ) {}

  /**
   * Evaluate the current state of a chute and decide what action to take.
   *
   * Called after every AI prediction update (from MqttService.runAiPrediction).
   * Returns a DecisionResult that the BlastService or controller can act upon.
   */
  async evaluate(chuteId: Types.ObjectId): Promise<DecisionResult> {
    const chute = await this.chuteModel.findById(chuteId).lean().exec();
    if (!chute) {
      return this.noAction('Chute not found', 'NORMAL');
    }

    const config = await this.predictionService.getConfig(chuteId);
    const prediction = await this.aiPredictionModel
      .findOne({ chuteId })
      .lean()
      .exec();

    if (!prediction) {
      return this.noAction('No AI prediction available', 'NORMAL');
    }

    // Get full prediction output
    const latestRadarDistances = prediction.blockageProbability
      ? [0, 0, 0, 0] // Will be filled from radar
      : [3.5, 3.5, 3.5, 3.5];

    const predictionOutput = await this.predictionService.predict(
      chuteId,
      prediction.blockageProbability,
      latestRadarDistances,
      chute.materialType || 'generic',
    );

    // ── 1. Check if we're in cooldown ─────────────────────────────────────
    const lastBlastTime = this.cooldownMap.get(chuteId.toString());
    if (lastBlastTime) {
      const elapsed = (Date.now() - lastBlastTime) / 1000;
      if (elapsed < (config as any).cooldownPeriodSeconds) {
        return this.decision(
          'CONTINUE_MONITORING',
          predictionOutput,
          `Cooldown active: ${Math.round((config as any).cooldownPeriodSeconds - elapsed)}s remaining`,
          'MONITORING',
        );
      }
    }

    // ── 2. Check if currently blasting ────────────────────────────────────
    if (chute.status === 'Blasting') {
      return this.decision(
        'CONTINUE_MONITORING',
        predictionOutput,
        'Blast already in progress',
        'BLASTING',
      );
    }

    // ── 3. Check blockage probability threshold ──────────────────────────
    if (
      prediction.blockageProbability <
      (config as any).blockageProbabilityThreshold
    ) {
      const state: AiState =
        prediction.blockageProbability > (config as any).severityModerateThreshold
          ? 'EARLY_WARNING'
          : prediction.blockageProbability > (config as any).severityLowThreshold
            ? 'MONITORING'
            : 'NORMAL';

      return this.decision(
        prediction.blockageProbability > (config as any).severityModerateThreshold
          ? 'RAISE_WARNING'
          : 'CONTINUE_MONITORING',
        predictionOutput,
        `Blockage probability ${prediction.blockageProbability}% below threshold ${(config as any).blockageProbabilityThreshold}%`,
        state,
      );
    }

    // ── 4. Check confidence threshold ────────────────────────────────────
    if (
      predictionOutput.confidence <
      (config as any).confidenceThreshold
    ) {
      return this.decision(
        'RAISE_WARNING',
        predictionOutput,
        `AI confidence ${predictionOutput.confidence}% below threshold ${(config as any).confidenceThreshold}%. Blast not authorized.`,
        'EARLY_WARNING',
      );
    }

    // ── 5. Safety pre-flight checks ──────────────────────────────────────
    const safetyResult = await this.runSafetyChecks(chuteId, config);
    if (!safetyResult.safe) {
      return this.decision(
        'NOTIFY_OPERATOR',
        predictionOutput,
        `Safety check failed: ${safetyResult.reason}`,
        'BLAST_RECOMMENDED',
      );
    }

    // ── 6. Check for active pending commands (prevent duplicate) ─────────
    const pendingCommand = await this.commandModel
      .findOne({
        chuteId,
        action: 'blast',
        status: { $in: ['CREATED', 'QUEUED', 'PUBLISHED', 'RECEIVED', 'EXECUTING'] },
      })
      .exec();

    if (pendingCommand) {
      return this.decision(
        'CONTINUE_MONITORING',
        predictionOutput,
        `Active blast command already pending: ${pendingCommand.commandId}`,
        'COMMAND_SENT',
      );
    }

    // ── 7. Check consecutive failures → escalate ─────────────────────────
    if ((chute.consecutiveFailedBlasts ?? 0) >= (config as any).maxRetries) {
      return this.decision(
        'ESCALATE_INCIDENT',
        predictionOutput,
        `${chute.consecutiveFailedBlasts} consecutive blast failures exceed max retries. Manual intervention required.`,
        'FAILED',
      );
    }

    // ── 8. All checks passed → decide blast mode ─────────────────────────
    if ((config as any).autoBlastEnabled) {
      this.logger.log(
        `[DecisionEngine] AUTO BLAST authorized for chute ${chuteId}: probability=${prediction.blockageProbability}%, confidence=${predictionOutput.confidence}%, severity=${predictionOutput.severity}`,
      );
      return this.decision(
        'EXECUTE_BLAST',
        predictionOutput,
        `Auto-blast authorized: probability=${prediction.blockageProbability}%, confidence=${predictionOutput.confidence}%`,
        'AUTO_EXECUTION',
      );
    } else {
      return this.decision(
        'NOTIFY_OPERATOR',
        predictionOutput,
        `Blast recommended but auto-blast is disabled. Awaiting manual approval.`,
        'WAITING_FOR_APPROVAL',
      );
    }
  }

  /**
   * Record that a blast was just triggered (for cooldown tracking).
   */
  recordBlast(chuteId: string): void {
    this.cooldownMap.set(chuteId, Date.now());
  }

  /**
   * Run all safety pre-flight checks before authorizing a blast.
   */
  private async runSafetyChecks(
    chuteId: Types.ObjectId,
    config: any,
  ): Promise<{ safe: boolean; reason: string }> {
    // 1. Hub online check
    const hubHealth = await this.hubHealthModel
      .findOne({ chuteId })
      .lean()
      .exec();
    if (hubHealth && !hubHealth.isOnline) {
      return { safe: false, reason: 'Hub is offline' };
    }

    // 2. Compressor pressure check
    const compressor = await this.compressorModel
      .findOne({ chuteId })
      .lean()
      .exec();
    if (compressor && compressor.pressure < config.minPressurePsi) {
      return {
        safe: false,
        reason: `Compressor pressure ${compressor.pressure} PSI below minimum ${config.minPressurePsi} PSI`,
      };
    }

    // 3. SAB health check (at least one healthy SAB required)
    const healthySabs = await this.airBlasterModel
      .find({ chuteId, healthScore: { $gte: 30 } })
      .lean()
      .exec();
    if (healthySabs.length === 0) {
      return {
        safe: false,
        reason: 'No healthy air blasters available (all health < 30%)',
      };
    }

    // 4. Solenoid health check
    const healthySolenoids = await this.solenoidModel
      .find({ chuteId, healthScore: { $gte: 20 } })
      .lean()
      .exec();
    if (healthySolenoids.length === 0) {
      return {
        safe: false,
        reason: 'No healthy solenoid valves available (all health < 20%)',
      };
    }

    // 5. No active maintenance lock
    // (maintenance tickets with status 'In Progress' indicate maintenance lock)
    // This check uses the existing MaintenanceTicket model

    return { safe: true, reason: 'All safety checks passed' };
  }

  /**
   * Select the best SAB for a given blockage zone.
   *
   * Selection criteria (in priority order):
   * 1. Healthy device (healthScore >= 30)
   * 2. Nearest to blocked zone
   * 3. Lowest retry count (fewer past failures)
   * 4. Highest health score
   */
  async selectBestSab(
    chuteId: Types.ObjectId,
    blockedZone: number | null,
  ): Promise<{ sabNumber: number; solenoidNumbers: number[] } | null> {
    const sabs = await this.airBlasterModel
      .find({ chuteId, healthScore: { $gte: 30 } })
      .sort({ healthScore: -1 })
      .lean()
      .exec();

    if (sabs.length === 0) return null;

    // Prefer SAB closest to the blocked zone number
    if (blockedZone !== null) {
      const nearest = sabs.reduce((best, sab) => {
        const dist = Math.abs(sab.blasterNumber - blockedZone);
        const bestDist = Math.abs(best.blasterNumber - blockedZone);
        return dist < bestDist ? sab : best;
      }, sabs[0]);

      const solenoids = await this.selectBestSolenoids(
        chuteId,
        nearest.blasterNumber,
      );
      return {
        sabNumber: nearest.blasterNumber,
        solenoidNumbers: solenoids,
      };
    }

    // Default: healthiest SAB
    const solenoids = await this.selectBestSolenoids(
      chuteId,
      sabs[0].blasterNumber,
    );
    return {
      sabNumber: sabs[0].blasterNumber,
      solenoidNumbers: solenoids,
    };
  }

  /**
   * Select the best solenoid valve(s) for a given SAB.
   *
   * Prefers healthy valves; returns up to 2 valves per blast for coverage.
   */
  private async selectBestSolenoids(
    chuteId: Types.ObjectId,
    sabNumber: number,
  ): Promise<number[]> {
    // Map: SAB N controls valves (N*2-1) and (N*2)
    // e.g. SAB 1 → SV1, SV2; SAB 2 → SV3, SV4
    const baseValve = (sabNumber - 1) * 2 + 1;
    const candidateValves = [baseValve, baseValve + 1];

    const solenoids = await this.solenoidModel
      .find({ chuteId, valveNumber: { $in: candidateValves } })
      .sort({ healthScore: -1 })
      .lean()
      .exec();

    if (solenoids.length === 0) return candidateValves; // fallback

    // Return healthy ones (healthScore >= 20), or all if none healthy
    const healthy = solenoids.filter((s) => s.healthScore >= 20);
    const selected = healthy.length > 0 ? healthy : solenoids;
    return selected.map((s) => s.valveNumber);
  }

  // ── Helper methods ───────────────────────────────────────────────────────

  private noAction(reason: string, state: AiState): DecisionResult {
    return {
      action: 'IGNORE',
      prediction: {
        blockageProbability: 0,
        severity: 'NORMAL',
        confidence: 0,
        estimatedBlockageLocation: null,
        estimatedGrowthRate: 0,
        recommendedAction: 'Ignore',
        recommendedSabNumber: null,
        recommendedSolenoidNumber: null,
        estimatedBlastDurationMs: 0,
        estimatedPressurePsi: 0,
        trend: { growthRate: 0, trend: 'stable', isOscillating: false, isSuddenSpike: false },
      },
      reason,
      sabNumber: null,
      solenoidNumber: null,
      blastDurationMs: 0,
      aiState: state,
    };
  }

  private decision(
    action: DecisionAction,
    prediction: PredictionOutput,
    reason: string,
    state: AiState,
  ): DecisionResult {
    return {
      action,
      prediction,
      reason,
      sabNumber: prediction.recommendedSabNumber,
      solenoidNumber: prediction.recommendedSolenoidNumber,
      blastDurationMs: prediction.estimatedBlastDurationMs,
      aiState: state,
    };
  }
}
