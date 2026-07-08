import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Telemetry,
  TelemetryDocument,
  Radar,
  RadarDocument,
  SabConfiguration,
  SabConfigurationDocument,
} from '../database/schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Severity enum aligned with the specification
// ─────────────────────────────────────────────────────────────────────────────
export type SeverityLevel =
  | 'NORMAL'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL'
  | 'EMERGENCY';

export interface TrendResult {
  growthRate: number;       // m/min average across zones
  trend: 'increasing' | 'stable' | 'decreasing';
  isOscillating: boolean;
  isSuddenSpike: boolean;
}

export interface PredictionOutput {
  blockageProbability: number;   // 0–100
  severity: SeverityLevel;
  confidence: number;            // 0–100
  estimatedBlockageLocation: string | null;
  estimatedGrowthRate: number;
  recommendedAction: string;
  recommendedSabNumber: number | null;
  recommendedSolenoidNumber: number | null;
  estimatedBlastDurationMs: number;
  estimatedPressurePsi: number;
  trend: TrendResult;
}

/**
 * AiPredictionService — the autonomous prediction engine.
 *
 * Analyses radar telemetry using rolling windows, computes trend rates,
 * severity, confidence, and outputs a full PredictionOutput structure
 * used by the DecisionEngine to decide whether to blast.
 *
 * This service is STATELESS — all state comes from the database.
 * It extends (not replaces) the existing runAiPrediction logic in MqttService.
 */
@Injectable()
export class AiPredictionService {
  private readonly logger = new Logger(AiPredictionService.name);

  constructor(
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    @InjectModel(Radar.name)
    private radarModel: Model<RadarDocument>,
    @InjectModel(SabConfiguration.name)
    private configModel: Model<SabConfigurationDocument>,
  ) {}

  /**
   * Load configuration for a chute, falling back to global defaults.
   */
  async getConfig(chuteId: Types.ObjectId): Promise<SabConfigurationDocument> {
    const chuteConfig = await this.configModel
      .findOne({ chuteId })
      .lean()
      .exec();
    if (chuteConfig) return chuteConfig as SabConfigurationDocument;

    const globalConfig = await this.configModel
      .findOne({ chuteId: null })
      .lean()
      .exec();
    if (globalConfig) return globalConfig as SabConfigurationDocument;

    // Return sensible in-memory defaults if no config document exists
    return {
      autoBlastEnabled: false,
      blockageProbabilityThreshold: 70,
      confidenceThreshold: 85,
      severityLowThreshold: 20,
      severityModerateThreshold: 40,
      severityHighThreshold: 60,
      severityCriticalThreshold: 80,
      severityEmergencyThreshold: 95,
      minBlastDurationMs: 500,
      maxBlastDurationMs: 5000,
      fixedBlastDurationMs: 0,
      minPressurePsi: 80,
      maxRetries: 3,
      retryIntervalSeconds: 30,
      cooldownPeriodSeconds: 60,
      minSignalQuality: 30,
      maxTimestampDriftSeconds: 5,
      verificationDelayMs: 30000,
      minEffectivenessScore: 50,
      heartbeatIntervalSeconds: 30,
      heartbeatMissedThreshold: 3,
      learningWindowSize: 50,
    } as any;
  }

  /**
   * Compute rolling-window trend analysis from recent telemetry entries.
   */
  async computeTrend(chuteId: Types.ObjectId): Promise<TrendResult> {
    // Use last 30 telemetry entries for trend analysis
    const recentTelemetry = await this.telemetryModel
      .find({ chuteId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean()
      .exec();

    if (recentTelemetry.length < 3) {
      return { growthRate: 0, trend: 'stable', isOscillating: false, isSuddenSpike: false };
    }

    // Compute average radar distance per entry (across all 4 zones)
    const avgDistances = recentTelemetry
      .map((t) => {
        const vals = t.radarValues.filter((v: number) => v > 0);
        return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 3.5;
      })
      .reverse(); // chronological order

    // Growth rate: negative distance change = material accumulating
    const first5Avg =
      avgDistances.slice(0, Math.min(5, avgDistances.length)).reduce((a, b) => a + b, 0) /
      Math.min(5, avgDistances.length);
    const last5Avg =
      avgDistances.slice(-Math.min(5, avgDistances.length)).reduce((a, b) => a + b, 0) /
      Math.min(5, avgDistances.length);

    const growthRate = Math.round((first5Avg - last5Avg) * 1000) / 1000;

    // Oscillation detection: count direction changes
    let dirChanges = 0;
    for (let i = 2; i < avgDistances.length; i++) {
      const prev = avgDistances[i - 1] - avgDistances[i - 2];
      const curr = avgDistances[i] - avgDistances[i - 1];
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) dirChanges++;
    }
    const isOscillating = dirChanges > avgDistances.length * 0.4;

    // Sudden spike: if latest reading differs by > 1m from the 5-reading average
    const latestAvg = avgDistances[avgDistances.length - 1];
    const recentAvg =
      avgDistances.slice(-6, -1).reduce((a, b) => a + b, 0) /
      Math.min(5, avgDistances.length - 1 || 1);
    const isSuddenSpike = Math.abs(latestAvg - recentAvg) > 1.0;

    const trend: 'increasing' | 'stable' | 'decreasing' =
      growthRate > 0.05
        ? 'increasing' // distance increasing relative to earlier = buildup growing
        : growthRate < -0.05
          ? 'decreasing'
          : 'stable';

    return { growthRate, trend, isOscillating, isSuddenSpike };
  }

  /**
   * Map blockage probability to severity level using configuration thresholds.
   */
  computeSeverity(probability: number, config: any): SeverityLevel {
    if (probability >= config.severityEmergencyThreshold) return 'EMERGENCY';
    if (probability >= config.severityCriticalThreshold) return 'CRITICAL';
    if (probability >= config.severityHighThreshold) return 'HIGH';
    if (probability >= config.severityModerateThreshold) return 'MODERATE';
    if (probability >= config.severityLowThreshold) return 'LOW';
    return 'NORMAL';
  }

  /**
   * Compute confidence score based on data quality and consistency.
   *
   * Confidence penalized by:
   * - Few telemetry samples available
   * - Oscillating readings (sensor instability)
   * - Low radar count
   * - Sudden spikes (potential noise)
   */
  computeConfidence(
    sampleCount: number,
    trend: TrendResult,
    radarCount: number,
  ): number {
    let confidence = 60; // base

    // More telemetry samples = more confidence
    if (sampleCount >= 30) confidence += 20;
    else if (sampleCount >= 10) confidence += 10;
    else confidence -= 10;

    // Multiple radars = more data sources
    if (radarCount >= 4) confidence += 10;
    else if (radarCount >= 2) confidence += 5;

    // Penalize instability
    if (trend.isOscillating) confidence -= 15;
    if (trend.isSuddenSpike) confidence -= 10;

    // Consistent trend boosts confidence
    if (trend.trend !== 'stable') confidence += 5;

    return Math.max(10, Math.min(100, confidence));
  }

  /**
   * Full prediction cycle for a chute.
   *
   * This is called by the DecisionEngine after every AI prediction update.
   * It does NOT trigger blasts — that responsibility belongs to the DecisionEngine.
   */
  async predict(
    chuteId: Types.ObjectId,
    currentBlockageProbability: number,
    currentRadarDistances: number[],
    materialType: string,
  ): Promise<PredictionOutput> {
    const config = await this.getConfig(chuteId);
    const trend = await this.computeTrend(chuteId);

    // Count recent telemetry entries for confidence calculation
    const sampleCount = await this.telemetryModel
      .countDocuments({
        chuteId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      })
      .exec();

    const radars = await this.radarModel.find({ chuteId }).lean().exec();
    const radarCount = radars.length;

    const severity = this.computeSeverity(currentBlockageProbability, config);
    const confidence = this.computeConfidence(sampleCount, trend, radarCount);

    // Estimate blockage location from current radar distances
    let estimatedBlockageLocation: string | null = null;
    let lowestDistance = Infinity;
    for (let i = 0; i < currentRadarDistances.length; i++) {
      const d = currentRadarDistances[i];
      if (d < lowestDistance && d < 2.0) {
        lowestDistance = d;
        estimatedBlockageLocation = `Zone ${i + 1}`;
      }
    }

    // Determine recommended action
    let recommendedAction = 'Continue Monitoring';
    if (severity === 'EMERGENCY') recommendedAction = 'Execute Blast';
    else if (severity === 'CRITICAL') recommendedAction = 'Execute Blast';
    else if (severity === 'HIGH') recommendedAction = 'Schedule Blast';
    else if (severity === 'MODERATE') recommendedAction = 'Raise Warning';
    else if (severity === 'LOW') recommendedAction = 'Continue Monitoring';
    else recommendedAction = 'Ignore';

    // Recommended SAB selection: zone with lowest distance → nearest SAB number
    const zoneToSab: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };
    const blockedZone: number | null = estimatedBlockageLocation
      ? parseInt(estimatedBlockageLocation.replace('Zone ', ''), 10)
      : null;
    const recommendedSabNumber = blockedZone ? (zoneToSab[blockedZone] ?? 1) : null;
    const recommendedSolenoidNumber = blockedZone;

    // Dynamic blast duration
    const estimatedBlastDurationMs = this.computeBlastDuration(
      severity,
      materialType,
      config,
    );

    return {
      blockageProbability: currentBlockageProbability,
      severity,
      confidence,
      estimatedBlockageLocation,
      estimatedGrowthRate: trend.growthRate,
      recommendedAction,
      recommendedSabNumber,
      recommendedSolenoidNumber,
      estimatedBlastDurationMs,
      estimatedPressurePsi: config.minPressurePsi,
      trend,
    };
  }

  /**
   * Compute dynamic blast duration based on severity and material.
   */
  private computeBlastDuration(
    severity: SeverityLevel,
    materialType: string,
    config: any,
  ): number {
    if (config.fixedBlastDurationMs > 0) return config.fixedBlastDurationMs;

    const severityMultipliers: Record<SeverityLevel, number> = {
      NORMAL: 0.3,
      LOW: 0.5,
      MODERATE: 0.7,
      HIGH: 0.85,
      CRITICAL: 1.0,
      EMERGENCY: 1.0,
    };

    const materialMultipliers: Record<string, number> = {
      coal: 1.1,
      iron_ore: 1.3,
      limestone: 1.15,
      grain: 0.9,
      generic: 1.0,
    };

    const base = config.maxBlastDurationMs;
    const duration = Math.round(
      base *
        (severityMultipliers[severity] ?? 0.7) *
        (materialMultipliers[materialType] ?? 1.0),
    );

    return Math.max(config.minBlastDurationMs, Math.min(config.maxBlastDurationMs, duration));
  }
}
