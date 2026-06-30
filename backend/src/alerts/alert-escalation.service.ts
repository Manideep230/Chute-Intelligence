import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Alert,
  AlertDocument,
  Notification,
  NotificationDocument,
  User,
  UserDocument,
  Chute,
  ChuteDocument,
} from '../database/schemas';

@Injectable()
export class AlertEscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEscalationService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
  ) {
    console.log(`[ENTER] [AlertEscalationService] Constructor started.`);
  }

  onModuleInit() {
    console.log(`[ENTER] [AlertEscalationService.onModuleInit] Initializing AlertEscalationService...`);
    try {
      if (process.env.VERCEL || process.env.DISABLE_ALERT_ESCALATION === 'true') {
        this.logger.log('Running in serverless/Vercel context. Skipping background Alert Escalation engine.');
        console.log(`[EXIT] [AlertEscalationService.onModuleInit] Bypassed on Vercel.`);
        return;
      }
      this.logger.log('Initializing Alert Escalation engine...');
      // Run the scan every 30 seconds
      this.checkInterval = setInterval(() => this.scanAndEscalateAlerts(), 30000);
      console.log(`[EXIT] [AlertEscalationService.onModuleInit] AlertEscalationService successfully initialized.`);
    } catch (err: any) {
      console.error(`[ERROR] [AlertEscalationService.onModuleInit] Failure during onModuleInit:`, err);
      throw err;
    }
  }

  onModuleDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.logger.log('Alert Escalation engine stopped.');
    }
  }

  /**
   * Scans all active, unresolved alerts and escalates them based on open duration.
   */
  async scanAndEscalateAlerts() {
    try {
      const activeAlerts = await this.alertModel
        .find({ isResolved: false })
        .populate('chuteId', 'name')
        .exec();

      if (activeAlerts.length === 0) return;

      const now = new Date();

      for (const alert of activeAlerts) {
        const openedTime = new Date(
          (alert as any).createdAt || alert.resolvedAt || now,
        );
        const openDurationSeconds = Math.floor(
          (now.getTime() - openedTime.getTime()) / 1000,
        );
        const chuteName = (alert.chuteId as any)?.name || 'Unknown Chute';

        // ── Level 2: Escalation to Plant Head / Admins (> 2 hours) ──
        if (openDurationSeconds >= 7200) {
          await this.escalateToLevel2(alert, chuteName);
        }
        // ── Level 1: Escalation to Managers (> 30 minutes) ──
        else if (openDurationSeconds >= 1800) {
          await this.escalateToLevel1(alert, chuteName);
        }
      }
    } catch (err) {
      this.logger.error('Error scanning alerts for escalation:', err);
    }
  }

  /**
   * Escalates an alert to Level 1 (Managers + Admins) after 30 minutes.
   */
  private async escalateToLevel1(alert: AlertDocument, chuteName: string) {
    const alertId = alert._id;
    const title = `⚠️ Manager Escalation: ${alert.severity}`;

    // Check if we already escalated this alert to Level 1
    const alreadyEscalated = await this.notificationModel
      .findOne({
        alertId,
        title,
      })
      .exec();

    if (alreadyEscalated) return;

    this.logger.warn(
      `Escalating alert ${alertId} (${alert.source}) to Manager level - open for >30m.`,
    );

    // Find all Managers, Admins, and Super Admins
    const managers = await this.userModel
      .find({
        role: { $in: ['Manager', 'Admin', 'Super Admin'] },
        isActive: true,
      })
      .exec();

    const notifBody = `[LEVEL 1 ESCALATION] Alert on ${chuteName} (${alert.source}) has been unresolved for over 30 minutes. Description: "${alert.message}"`;

    for (const user of managers) {
      const notif = new this.notificationModel({
        userId: user._id,
        alertId,
        title,
        body: notifBody,
        channels: ['in-app', 'browser'],
        status: 'sent',
      });
      await notif.save();
    }
  }

  /**
   * Escalates an alert to Level 2 (Admins + Super Admins) after 2 hours.
   */
  private async escalateToLevel2(alert: AlertDocument, chuteName: string) {
    const alertId = alert._id;
    const title = `🚨 Critical Escalation: ${alert.severity}`;

    // Check if we already escalated this alert to Level 2
    const alreadyEscalated = await this.notificationModel
      .findOne({
        alertId,
        title,
      })
      .exec();

    if (alreadyEscalated) return;

    this.logger.error(
      `CRITICAL: Escalating alert ${alertId} (${alert.source}) to Plant Head/Admin level - open for >2h.`,
    );

    // Find all Admins and Super Admins
    const admins = await this.userModel
      .find({
        role: { $in: ['Admin', 'Super Admin'] },
        isActive: true,
      })
      .exec();

    const notifBody = `[CRITICAL LEVEL 2 ESCALATION] Alert on ${chuteName} (${alert.source}) has been unresolved for over 2 hours. Immediate plant intervention required. Description: "${alert.message}"`;

    for (const user of admins) {
      const notif = new this.notificationModel({
        userId: user._id,
        alertId,
        title,
        body: notifBody,
        channels: ['in-app', 'browser', 'sms'],
        status: 'sent',
      });
      await notif.save();
    }
  }
}
