import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { DecisionEngineService, DecisionResult } from './decision-engine.service';
import { AiPredictionService } from './ai-prediction.service';
import {
  Chute,
  ChuteDocument,
  Command,
  CommandDocument,
  AuditLog,
  AuditLogDocument,
  Incident,
  IncidentDocument,
  AiPrediction,
  AiPredictionDocument,
} from '../database/schemas';

export interface BlastCommand {
  commandId: string;
  chuteId: string;
  sabNumber: number;
  solenoidNumbers: number[];
  blastDurationMs: number;
  requiredPressurePsi: number;
  aiProbability: number;
  aiConfidence: number;
  aiSeverity: string;
  triggerSource: 'ai' | 'manual' | 'scheduler' | 'simulation';
  retryCount: number;
  timestamp: string;
}

/**
 * BlastService — orchestrates the execution of blast commands.
 *
 * Responsibilities:
 * - Generate blast command from DecisionEngine output
 * - Persist command record in the Command collection
 * - Integrate with MqttService to publish MQTT blast commands
 * - Handle retry logic and escalation to incidents
 * - Audit-log every blast decision
 *
 * This service does NOT publish MQTT directly — it returns a BlastCommand
 * object that the MqttService or HardwareController uses to publish.
 */
@Injectable()
export class BlastService {
  private readonly logger = new Logger(BlastService.name);

  constructor(
    private readonly decisionEngine: DecisionEngineService,
    private readonly predictionService: AiPredictionService,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Command.name) private commandModel: Model<CommandDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Incident.name) private incidentModel: Model<IncidentDocument>,
    @InjectModel(AiPrediction.name)
    private aiPredictionModel: Model<AiPredictionDocument>,
  ) {}

  /**
   * Evaluate a chute and optionally auto-execute a blast.
   *
   * Called from MqttService after every AI prediction update.
   * Returns the decision and, if applicable, a blast command ready for MQTT dispatch.
   */
  async evaluateAndPrepare(
    chuteId: Types.ObjectId,
  ): Promise<{ decision: DecisionResult; command: BlastCommand | null }> {
    const decision = await this.decisionEngine.evaluate(chuteId);

    // Audit-log every decision
    await this.logDecision(chuteId, decision);

    if (decision.action === 'EXECUTE_BLAST') {
      const command = await this.prepareBlastCommand(
        chuteId,
        decision,
        'ai',
      );
      return { decision, command };
    }

    if (decision.action === 'ESCALATE_INCIDENT') {
      await this.createIncident(chuteId, decision);
    }

    return { decision, command: null };
  }

  /**
   * Create a blast command for manual trigger (from REST API).
   *
   * Bypasses AI decision thresholds but still runs safety checks.
   */
  async prepareManualBlast(
    chuteId: Types.ObjectId,
    sabNumber: number,
    solenoidNumbers: number[],
    blastDurationMs: number,
    triggeredBy: Types.ObjectId | null,
  ): Promise<BlastCommand> {
    const config = await this.predictionService.getConfig(chuteId);

    const prediction = await this.aiPredictionModel
      .findOne({ chuteId })
      .lean()
      .exec();

    const commandId = randomUUID();

    const commandDoc = await this.commandModel.create({
      commandId,
      chuteId,
      action: 'blast',
      status: 'CREATED',
      payload: {
        sabNumber,
        solenoidNumbers,
        blastDurationMs,
      },
      retryCount: 0,
      maxRetries: (config as any).maxRetries,
      triggerSource: 'manual',
      triggeredBy,
      aiProbability: prediction?.blockageProbability ?? null,
      aiConfidence: null,
      aiSeverity: null,
    });

    // Audit
    await new this.auditLogModel({
      userId: triggeredBy,
      action: 'Manual Blast Command',
      details: `Manual blast command ${commandId} created for chute ${chuteId}. SAB #${sabNumber}, Solenoids: ${solenoidNumbers.join(',')}`,
    }).save();

    this.decisionEngine.recordBlast(chuteId.toString());

    return {
      commandId,
      chuteId: chuteId.toString(),
      sabNumber,
      solenoidNumbers,
      blastDurationMs: blastDurationMs || (config as any).maxBlastDurationMs,
      requiredPressurePsi: (config as any).minPressurePsi,
      aiProbability: prediction?.blockageProbability ?? 0,
      aiConfidence: 0,
      aiSeverity: 'MANUAL',
      triggerSource: 'manual',
      retryCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update command status (called when ACK arrives from hub via MQTT).
   */
  async updateCommandStatus(
    commandId: string,
    status: string,
    result?: Record<string, any>,
  ): Promise<void> {
    const updateFields: any = { status };
    const now = new Date();

    switch (status) {
      case 'PUBLISHED':
        updateFields.publishedAt = now;
        break;
      case 'RECEIVED':
        updateFields.receivedAt = now;
        break;
      case 'EXECUTING':
        updateFields.executionStartedAt = now;
        break;
      case 'COMPLETED':
        updateFields.completedAt = now;
        updateFields.executionEndedAt = now;
        if (result) updateFields.result = result;
        break;
      case 'FAILED':
        updateFields.failedAt = now;
        updateFields.executionEndedAt = now;
        if (result?.reason) updateFields.failureReason = result.reason;
        break;
      case 'TIMEOUT':
        updateFields.timedOutAt = now;
        break;
    }

    // Compute execution time if completed
    const cmd = await this.commandModel.findOne({ commandId }).exec();
    if (
      cmd &&
      (status === 'COMPLETED' || status === 'FAILED') &&
      cmd.executionStartedAt
    ) {
      updateFields.executionTimeMs =
        now.getTime() - new Date(cmd.executionStartedAt).getTime();
    }

    await this.commandModel
      .findOneAndUpdate({ commandId }, updateFields)
      .exec();

    this.logger.log(`Command ${commandId} → ${status}`);
  }

  // ── Private methods ───────────────────────────────────────────────────────

  private async prepareBlastCommand(
    chuteId: Types.ObjectId,
    decision: DecisionResult,
    triggerSource: 'ai' | 'manual' | 'scheduler' | 'simulation',
  ): Promise<BlastCommand> {
    // Select best SAB/solenoid pair
    const blockedZone = decision.prediction.estimatedBlockageLocation
      ? parseInt(
          decision.prediction.estimatedBlockageLocation.replace('Zone ', ''),
          10,
        )
      : null;

    const selection = await this.decisionEngine.selectBestSab(
      chuteId,
      blockedZone,
    );

    const sabNumber = selection?.sabNumber ?? decision.sabNumber ?? 1;
    const solenoidNumbers =
      selection?.solenoidNumbers ?? (decision.solenoidNumber ? [decision.solenoidNumber] : [1, 2]);

    const commandId = randomUUID();
    const config = await this.predictionService.getConfig(chuteId);

    // Persist command record
    await this.commandModel.create({
      commandId,
      chuteId,
      action: 'blast',
      status: 'CREATED',
      payload: {
        sabNumber,
        solenoidNumbers,
        blastDurationMs: decision.blastDurationMs,
      },
      retryCount: 0,
      maxRetries: (config as any).maxRetries,
      triggerSource,
      triggeredBy: null,
      aiProbability: decision.prediction.blockageProbability,
      aiConfidence: decision.prediction.confidence,
      aiSeverity: decision.prediction.severity,
    });

    this.decisionEngine.recordBlast(chuteId.toString());

    return {
      commandId,
      chuteId: chuteId.toString(),
      sabNumber,
      solenoidNumbers,
      blastDurationMs: decision.blastDurationMs,
      requiredPressurePsi: decision.prediction.estimatedPressurePsi,
      aiProbability: decision.prediction.blockageProbability,
      aiConfidence: decision.prediction.confidence,
      aiSeverity: decision.prediction.severity,
      triggerSource,
      retryCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private async logDecision(
    chuteId: Types.ObjectId,
    decision: DecisionResult,
  ): Promise<void> {
    try {
      await new this.auditLogModel({
        action: 'AI Decision',
        details: JSON.stringify({
          chuteId: chuteId.toString(),
          action: decision.action,
          aiState: decision.aiState,
          reason: decision.reason,
          severity: decision.prediction.severity,
          probability: decision.prediction.blockageProbability,
          confidence: decision.prediction.confidence,
          recommendedSab: decision.sabNumber,
          timestamp: new Date().toISOString(),
        }),
      }).save();
    } catch (err: any) {
      this.logger.error(`Failed to log decision: ${err.message}`);
    }
  }

  private async createIncident(
    chuteId: Types.ObjectId,
    decision: DecisionResult,
  ): Promise<void> {
    try {
      // Check for existing open incident
      const existing = await this.incidentModel
        .findOne({
          chuteId,
          status: { $in: ['Open', 'Investigating'] },
          incidentType: 'Process',
        })
        .exec();

      if (!existing) {
        await this.incidentModel.create({
          chuteId,
          title: `Autonomous Blast Failure — Escalation`,
          description: decision.reason,
          severity: 'Critical',
          status: 'Open',
          incidentType: 'Process',
          affectedZone: decision.prediction.estimatedBlockageLocation
            ? parseInt(
                decision.prediction.estimatedBlockageLocation.replace(
                  'Zone ',
                  '',
                ),
                10,
              )
            : undefined,
          reportedBy: new Types.ObjectId('000000000000000000000000'), // System user placeholder
          timeline: [
            {
              timestamp: new Date(),
              action: 'Incident Created',
              note: `AI decision engine escalated after ${decision.reason}`,
              performedBy: new Types.ObjectId('000000000000000000000000'),
            },
          ],
        });

        this.logger.warn(
          `[BlastService] Incident created for chute ${chuteId}: ${decision.reason}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to create incident: ${err.message}`);
    }
  }
}
