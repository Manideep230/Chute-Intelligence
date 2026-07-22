import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as https from 'https';
import {
  User,
  UserDocument,
  AuditLog,
  AuditLogDocument,
  Assignment,
  AssignmentDocument,
  Session,
  SessionDocument,
} from '../database/schemas';

const keepAliveAgent = new https.Agent({
  keepAlive: process.env.NODE_ENV !== 'test',
  keepAliveMsecs: 10000,
  maxSockets: 25,
  maxFreeSockets: 10,
  rejectUnauthorized: false,
});

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
  ) {}

  // Helper to generate next NG ID for a specific plant
  async generateNextNgId(plantId: string): Promise<string> {
    const plant = await this.userModel.db
      .model('Plant')
      .findByIdAndUpdate(
        plantId,
        { $inc: { currentSequence: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!plant) {
      throw new NotFoundException('Plant not found');
    }

    return `${plant.ngPrefix}${String(plant.currentSequence).padStart(6, '0')}`;
  }

  // Register new user
  async register(
    name: string,
    phone: string,
    role: string,
    plantIdsInput?: string[] | string,
    creator?: any,
  ): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ phone }).exec();
    if (existing) {
      throw new BadRequestException('Phone number is already registered');
    }

    if (creator && creator.role === 'Admin') {
      if (role === 'Super Admin' || role === 'Admin') {
        throw new BadRequestException(
          'Admins can only create Manager or Worker accounts',
        );
      }
      const ids = Array.isArray(plantIdsInput)
        ? plantIdsInput
        : plantIdsInput
          ? [plantIdsInput]
          : [];
      if (ids.length === 0) {
        throw new BadRequestException(
          'At least one assigned plant is required',
        );
      }
      const creatorPlants = (creator.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const invalid = ids.some((id) => !creatorPlants.includes(id));
      if (invalid) {
        throw new BadRequestException(
          'Cannot assign user to an unassigned plant',
        );
      }
    }

    // Resolve assigned plant IDs
    let assignedPlantIds: Types.ObjectId[] = [];
    if (plantIdsInput) {
      const ids = Array.isArray(plantIdsInput)
        ? plantIdsInput
        : [plantIdsInput];
      assignedPlantIds = ids.map((id) => new Types.ObjectId(id));
    }

    let ngId = '';
    if (role === 'Super Admin') {
      const lastSA = await this.userModel
        .findOne({ ngId: /^NGSA\d{6}$/ })
        .sort({ ngId: -1 })
        .exec();
      let nextNum = 1;
      if (lastSA) {
        const match = lastSA.ngId.match(/\d+/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      ngId = `NGSA${String(nextNum).padStart(6, '0')}`;
    } else {
      let targetPlantId = assignedPlantIds[0];
      if (!targetPlantId) {
        const firstPlant = await this.userModel.db
          .model('Plant')
          .findOne()
          .exec();
        if (firstPlant) {
          targetPlantId = firstPlant._id;
          assignedPlantIds = [targetPlantId];
        } else {
          throw new BadRequestException(
            'No plants exist in the database. Cannot register user.',
          );
        }
      }

      ngId = await this.generateNextNgId(targetPlantId.toString());
    }

    const user = new this.userModel({
      ngId,
      name,
      phone,
      role,
      assignedPlantIds,
    });

    const savedUser = await user.save();

    // Log action to audit logs
    const log = new this.auditLogModel({
      action: 'User Creation',
      details: `Created user ${name} with ID ${ngId} and role ${role}`,
    });
    await log.save();

    return savedUser;
  }

  // Helper to send OTP via SMS API
  private async sendSmsOtp(phone: string, otp: string, apiResponseTime?: number): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      console.warn(`[SMS-API] Invalid phone number (no digits): ${phone}`);
      return false;
    }

    let receiver = cleanPhone;
    if (receiver.length === 10) {
      receiver = '91' + receiver;
    }

    const urlBase = process.env.SMS_API_URL || 'https://43.252.88.250/index.php/smsapi/httpapi/';
    const secret = process.env.SMS_SECRET || 'xledocqmXkNPrTesuqWr';
    const sender = process.env.SMS_SENDER || 'NIGHAI';
    const tempid = process.env.SMS_TEMPLATE_ID || '1207174264191607433';
    const route = process.env.SMS_ROUTE || 'TA';
    const msgtype = process.env.SMS_MSG_TYPE || '1';
    
    const sms = `Welcome to Chute Intelligence App\n\nYour OTP is ${otp}\n\nDon't share with anybody.\n\nTeam NighaTech Global Pvt. Ltd.`;

    let url = urlBase;
    if (!url.endsWith('/') && !url.includes('?')) {
      url += '/';
    }
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}secret=${secret}&sender=${sender}&tempid=${tempid}&receiver=${receiver}&route=${route}&msgtype=${msgtype}&sms=${encodeURIComponent(sms)}`;

    const smsStart = performance.now();

    return new Promise((resolve) => {
      const req = https.get(
        finalUrl,
        { agent: keepAliveAgent, timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            const smsLatency = performance.now() - smsStart;
            if (process.env.NODE_ENV !== 'test') {
              console.log(
                `[SMS-API-RESPONSE] status=${res.statusCode} response=${data.trim()} latency=${smsLatency.toFixed(2)}ms`,
              );
              if (apiResponseTime !== undefined) {
                const e2e = apiResponseTime + smsLatency;
                console.log(`[LATENCY-REPORT-E2E] End-to-End Latency: ${e2e.toFixed(2)}ms`);
              }
            }
            resolve(true);
          });
        },
      );

      req.on('timeout', () => {
        const smsLatency = performance.now() - smsStart;
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[SMS-API-TIMEOUT] SMS gateway request timed out after ${smsLatency.toFixed(2)}ms`);
        }
        req.destroy();
        resolve(false);
      });

      req.on('error', (err) => {
        const smsLatency = performance.now() - smsStart;
        if (process.env.NODE_ENV !== 'test') {
          console.error(`[SMS-API-ERROR] SMS gateway request failed after ${smsLatency.toFixed(2)}ms:`, err);
        }
        resolve(false);
      });
    });
  }

  private hashOtp(otp: string): string {
    const secret = process.env.OTP_SECRET || 'nigha-default-otp-secret';
    return crypto.createHmac('sha256', secret).update(otp).digest('hex');
  }

  async requestOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const apiStart = performance.now();
    console.log(`[AUTH_SERVICE_ENTER] [AuthService.requestOtp] Starting OTP flow for ${phone}`);
    try {
      const validationStart = performance.now();
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        throw new BadRequestException('Invalid phone number format');
      }
      const validationTime = performance.now() - validationStart;

      const dbLookupStart = performance.now();
      let user: any = await this.userModel.findOne({ phone }).exec();
      const dbLookupTime = performance.now() - dbLookupStart;

      const now = new Date();
      if (user && user.otpLastSent && process.env.NODE_ENV !== 'test') {
        const timeDiff = now.getTime() - new Date(user.otpLastSent).getTime();
        if (timeDiff < 60 * 1000) {
          throw new BadRequestException('Please wait 60 seconds before requesting another OTP');
        }
      }

      const genStart = performance.now();
      let otp: string;
      if (process.env.NODE_ENV === 'test') {
        otp = '939188';
      } else {
        otp = crypto.randomInt(100000, 1000000).toString();
      }
      const genTime = performance.now() - genStart;

      const hashStart = performance.now();
      const hashedOtp = this.hashOtp(otp);
      const hashTime = performance.now() - hashStart;

      const dbSaveStart = performance.now();
      if (!user) {
        user = await this.register('New User', phone, 'Worker');
      }
      
      user.otp = hashedOtp;
      user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
      user.otpAttempts = 0;
      user.otpLastSent = now;
      
      console.log(`[DATABASE_WRITE_START] [AuthService.requestOtp] Saving OTP to user...`);
      await user.save();
      console.log(`[DATABASE_WRITE_END] [AuthService.requestOtp] Saved OTP successfully.`);
      const dbSaveTime = performance.now() - dbSaveStart;
      const mongoLatency = dbLookupTime + dbSaveTime;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SMS-MOCK] OTP for login of ${phone} is: ${otp}`);
      } else {
        console.log(`[SMS-SENT] OTP sent successfully to registered mobile number.`);
      }

      const apiResponseTime = performance.now() - apiStart;
      console.log(`[LATENCY-REPORT]
        Phone Validation: ${validationTime.toFixed(2)}ms
        Mongo Lookup: ${dbLookupTime.toFixed(2)}ms
        Mongo Save: ${dbSaveTime.toFixed(2)}ms
        Mongo Latency: ${mongoLatency.toFixed(2)}ms
        OTP Gen: ${genTime.toFixed(2)}ms
        OTP Hash: ${hashTime.toFixed(2)}ms
        API Response Time (excluding SMS): ${apiResponseTime.toFixed(2)}ms
      `);

      console.log(`[SMS-REQUEST_START] [AuthService.requestOtp] Triggering SMS API request in background...`);
      this.sendSmsOtp(phone, otp, apiResponseTime).catch((err) => {
        console.error('[SMS-BG-ERROR]', err);
      });
      console.log(`[SMS-REQUEST_END] [AuthService.requestOtp] SMS API trigger completed (dispatched to background).`);

      console.log(`[RESPONSE_SENT] [AuthService.requestOtp] Returning response.`);
      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } catch (err: any) {
      console.error(`[ERROR] [AuthService.requestOtp] Error:`, err);
      throw err;
    }
  }

  // Verify OTP for Login
  async verifyOtp(
    phone: string,
    otp: string,
    userAgent: string,
    ipAddress: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserDocument;
  }> {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if ((user.otpAttempts || 0) >= 3) {
      throw new UnauthorizedException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (!user.otp || !user.otpExpires || new Date() > user.otpExpires) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const enteredHash = this.hashOtp(otp);
    if (user.otp !== enteredHash) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    // Clear OTP immediately to prevent reuse / replay attacks
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    await user.save();

    // Access token (unlimited/persistent: 20 years)
    const payload = {
      sub: user._id,
      phone: user.phone,
      role: user.role,
      ngId: user.ngId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '20y' });

    // Generate refresh token (unlimited/persistent: 20 years)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Persist session
    const session = new this.sessionModel({
      userId: user._id,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000), // 20 years
    });
    await session.save();

    // Audit log
    const log = new this.auditLogModel({
      userId: user._id,
      action: 'Login',
      details: `User ${user.name} logged in successfully`,
    });
    await log.save();

    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Refresh access token and rotate refresh token
  async refreshSession(
    refreshToken: string,
    userAgent: string,
    ipAddress: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    const hash = this.hashToken(refreshToken);
    const session = await this.sessionModel
      .findOne({ refreshTokenHash: hash, isRevoked: false })
      .exec();

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        session.isRevoked = true;
        await session.save();
      }
      throw new UnauthorizedException('Invalid or expired refresh session');
    }

    const user = await this.userModel.findById(session.userId).exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is suspended or disabled');
    }

    // Generate new refresh token
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHash = this.hashToken(newRefreshToken);

    // Rotate refresh token in the session
    session.refreshTokenHash = newHash;
    session.userAgent = userAgent;
    session.ipAddress = ipAddress;
    session.lastUsedAt = new Date();
    await session.save();

    // Issue new access token (unlimited/persistent: 20 years)
    const payload = {
      sub: user._id,
      phone: user.phone,
      role: user.role,
      ngId: user.ngId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '20y' });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // Revoke a single session (Logout)
  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const hash = this.hashToken(refreshToken);
    await this.sessionModel
      .findOneAndUpdate({ refreshTokenHash: hash }, { isRevoked: true })
      .exec();
  }

  // Revoke all sessions for a user (Logout All)
  async logoutAll(userId: string): Promise<void> {
    await this.sessionModel
      .updateMany({ userId: new Types.ObjectId(userId) }, { isRevoked: true })
      .exec();
  }

  // Request phone number change (Dual OTP verification)
  async requestPhoneChange(
    userId: string,
    newPhone: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.userModel.findOne({ phone: newPhone }).exec();
    if (existing) {
      throw new BadRequestException('New phone number is already in use');
    }

    // Generate two OTPs securely
    let oldPhoneOtp: string;
    let newPhoneOtp: string;
    if (process.env.NODE_ENV === 'test') {
      oldPhoneOtp = '939188';
      newPhoneOtp = '654321';
    } else {
      oldPhoneOtp = crypto.randomInt(100000, 1000000).toString();
      newPhoneOtp = crypto.randomInt(100000, 1000000).toString();
    }
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = this.hashOtp(oldPhoneOtp); // OTP for old phone
    user.otpExpires = expires;
    user.otpAttempts = 0;

    user.tempNewPhone = newPhone;
    user.tempPhoneOtp = this.hashOtp(newPhoneOtp); // OTP for new phone
    user.tempPhoneOtpExpires = expires;

    await user.save();

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[SMS-MOCK] OTP for OLD phone (${user.phone}) change verification: ${oldPhoneOtp}`,
      );
      console.log(
        `[SMS-MOCK] OTP for NEW phone (${newPhone}) change verification: ${newPhoneOtp}`,
      );
    }

    // Trigger SMS sending in background to both old and new phone numbers
    this.sendSmsOtp(user.phone, oldPhoneOtp).catch((err) => {
      console.error('[SMS-BG-ERROR-OLD]', err);
    });
    this.sendSmsOtp(newPhone, newPhoneOtp).catch((err) => {
      console.error('[SMS-BG-ERROR-NEW]', err);
    });

    return {
      success: true,
      message: 'Verification OTPs sent to both old and new numbers',
    };
  }

  // Verify phone change with dual OTPs
  async verifyPhoneChange(
    userId: string,
    oldPhoneOtp: string,
    newPhoneOtp: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.tempNewPhone) {
      throw new BadRequestException('No phone change request active');
    }

    const now = new Date();
    if (
      !user.otp ||
      user.otp !== this.hashOtp(oldPhoneOtp) ||
      !user.otpExpires ||
      now > user.otpExpires
    ) {
      throw new UnauthorizedException(
        'Invalid or expired OTP for old phone number',
      );
    }

    if (
      !user.tempPhoneOtp ||
      user.tempPhoneOtp !== this.hashOtp(newPhoneOtp) ||
      !user.tempPhoneOtpExpires ||
      now > user.tempPhoneOtpExpires
    ) {
      throw new UnauthorizedException(
        'Invalid or expired OTP for new phone number',
      );
    }

    const oldPhone = user.phone;
    const newPhone = user.tempNewPhone;

    user.phone = newPhone;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.tempNewPhone = null;
    user.tempPhoneOtp = null;
    user.tempPhoneOtpExpires = null;

    const saved = await user.save();

    // Audit log
    const log = new this.auditLogModel({
      userId: user._id,
      action: 'Phone Number Change',
      details: `User ${user.name} changed phone number from ${oldPhone} to ${newPhone}`,
    });
    await log.save();

    return saved;
  }

  // Get user profile
  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Update profile
  async updateProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<UserDocument> {
    // Prevent modification of critical fields directly
    delete updateData.ngId;
    delete updateData.role;
    delete updateData.phone;
    delete updateData.isActive;

    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { returnDocument: 'after' })
      .exec();
    if (!user) throw new NotFoundException('User not found');

    const log = new this.auditLogModel({
      userId: user._id,
      action: 'Profile Update',
      details: `User updated profile fields: ${Object.keys(updateData).join(', ')}`,
    });
    await log.save();

    return user;
  }

  async getAllUsers(caller?: any): Promise<UserDocument[]> {
    if (caller && caller.role === 'Admin') {
      const callerPlantIds = (caller.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      return this.userModel
        .find({
          assignedPlantIds: {
            $in: callerPlantIds.map((id: string) => new Types.ObjectId(id)),
          },
        })
        .exec();
    }
    return this.userModel.find().exec();
  }

  async updateUserRole(
    targetUserId: string,
    role: string,
    adminUser: any,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(targetUserId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (adminUser.role === 'Admin') {
      if (user.role === 'Super Admin' || user.role === 'Admin') {
        throw new BadRequestException(
          'Admins cannot modify Admin or Super Admin roles',
        );
      }
      const adminPlantIds = (adminUser.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const userPlantIds = (user.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const hasOverlap = userPlantIds.some((id: string) =>
        adminPlantIds.includes(id),
      );
      if (!hasOverlap) {
        throw new BadRequestException(
          'Cannot modify a user outside your assigned plant tenancy',
        );
      }
    }

    user.role = role;
    const saved = await user.save();

    const log = new this.auditLogModel({
      userId: adminUser._id,
      action: 'Role Update',
      details: `Updated role of user ${user.name} (${user.ngId}) to ${role}`,
    });
    await log.save();
    return saved;
  }

  async toggleUserActive(userId: string, caller?: any): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (caller && caller.role === 'Admin') {
      if (user.role === 'Super Admin' || user.role === 'Admin') {
        throw new BadRequestException(
          'Admins cannot toggle active status of other Admins or Super Admins',
        );
      }
      const adminPlantIds = (caller.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const userPlantIds = (user.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const hasOverlap = userPlantIds.some((id: string) =>
        adminPlantIds.includes(id),
      );
      if (!hasOverlap) {
        throw new BadRequestException(
          'Cannot modify a user outside your assigned plant tenancy',
        );
      }
    }

    user.isActive = !user.isActive;
    await user.save();

    const log = new this.auditLogModel({
      userId: caller?._id,
      action: 'User Status Toggle',
      details: `Toggled active state of user ${user.name} (${user.ngId}) to ${user.isActive}`,
    });
    await log.save();

    return user;
  }

  async deleteUser(userId: string, caller?: any): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (caller && caller.role === 'Admin') {
      if (user.role === 'Super Admin' || user.role === 'Admin') {
        throw new BadRequestException(
          'Admins cannot delete other Admins or Super Admins',
        );
      }
      const adminPlantIds = (caller.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const userPlantIds = (user.assignedPlantIds || []).map((id: any) =>
        id.toString(),
      );
      const hasOverlap = userPlantIds.some((id: string) =>
        adminPlantIds.includes(id),
      );
      if (!hasOverlap) {
        throw new BadRequestException(
          'Cannot delete a user outside your assigned plant tenancy',
        );
      }
    }

    await user.deleteOne();

    // Clean up their assignments
    await this.assignmentModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();

    const log = new this.auditLogModel({
      userId: caller?._id,
      action: 'User Deletion',
      details: `Deleted user ${user.name} (${user.ngId}) and removed all associated assignments`,
    });
    await log.save();

    return { message: 'User deleted successfully' };
  }

  // ── LEGACY NG ID MIGRATION ────────────────────────────────────────────────
  // Idempotent — safe to call multiple times. Only updates users that lack an ngId.
  async migrateNgIds(
    caller?: any,
  ): Promise<{ migrated: number; skipped: number; report: any[] }> {
    const users = await this.userModel
      .find({
        $or: [{ ngId: null }, { ngId: '' }, { ngId: { $exists: false } }],
      })
      .exec();

    let migrated = 0;
    let skipped = 0;
    const report: any[] = [];

    for (const user of users) {
      try {
        let ngId: string;

        if (user.role === 'Super Admin') {
          const lastSA = await this.userModel
            .findOne({ ngId: /^NGSA\d{6}$/ })
            .sort({ ngId: -1 })
            .exec();
          let nextNum = 1;
          if (lastSA) {
            const match = lastSA.ngId.match(/\d+/);
            if (match) nextNum = parseInt(match[0], 10) + 1;
          }
          ngId = `NGSA${String(nextNum).padStart(6, '0')}`;
        } else {
          const plantId = (user.assignedPlantIds || [])[0];
          if (!plantId) {
            const firstPlant = await this.userModel.db
              .model('Plant')
              .findOne()
              .exec();
            if (!firstPlant) {
              report.push({
                userId: user._id,
                name: user.name,
                status: 'skipped',
                reason: 'no plant found',
              });
              skipped++;
              continue;
            }
            // Assign to first plant
            user.assignedPlantIds = [firstPlant._id];
            await user.save();
            ngId = await this.generateNextNgId(firstPlant._id.toString());
          } else {
            ngId = await this.generateNextNgId(plantId.toString());
          }
        }

        user.ngId = ngId;
        await user.save();
        report.push({
          userId: user._id,
          name: user.name,
          role: user.role,
          ngId,
          status: 'migrated',
        });
        migrated++;
      } catch (err: any) {
        report.push({
          userId: user._id,
          name: user.name,
          status: 'error',
          reason: err.message,
        });
        skipped++;
      }
    }

    if (migrated > 0) {
      const auditLog = new this.auditLogModel({
        userId: caller?._id,
        action: 'NG ID Migration',
        details: `Migrated ${migrated} users. Skipped ${skipped}.`,
      });
      await auditLog.save();
    }

    return { migrated, skipped, report };
  }
}
