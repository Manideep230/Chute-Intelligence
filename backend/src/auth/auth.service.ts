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
  private async sendSmsOtp(phone: string, otp: string): Promise<boolean> {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(-10);
    }
    if (cleanPhone.length < 10) {
      console.warn(`[SMS-API] Invalid phone number length: ${phone}`);
      return false;
    }

    const secret = process.env.SMS_API_SECRET || 'xledocqmXkNPrTesuqWr';
    const sender = process.env.SMS_API_SENDER || 'NIGHAI';
    const tempid = process.env.SMS_API_TEMPLATE_ID || '1207174264191607433';
    const route = process.env.SMS_API_ROUTE || 'TA';
    const msgtype = process.env.SMS_API_MSG_TYPE || '1';
    const sms = `Welcome to Chute Intelligence\nYour OTP for Authentication is ${otp}\nDon't share with anybody\nThank You, Team NighaTech Global Pvt. Ltd.`;

    const url = `https://43.252.88.250/index.php/smsapi/httpapi/?secret=${secret}&sender=${sender}&tempid=${tempid}&receiver=${cleanPhone}&route=${route}&msgtype=${msgtype}&sms=${encodeURIComponent(sms)}`;

    return new Promise((resolve) => {
      const req = https.get(
        url,
        { rejectUnauthorized: false, timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            console.log(
              `[SMS-API-RESPONSE] status=${res.statusCode} response=${data}`,
            );
            resolve(true);
          });
        },
      );

      req.on('timeout', () => {
        console.warn('[SMS-API-TIMEOUT] SMS gateway request timed out after 5000ms');
        req.destroy();
        resolve(false);
      });

      req.on('error', (err) => {
        console.error('[SMS-API-ERROR]', err);
        resolve(false);
      });
    });
  }

  // Request OTP for Login
  async requestOtp(phone: string): Promise<{ message: string; otp?: string }> {
    let user: any = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      user = await this.register('New User', phone, 'Worker');
    }

    // Generate 6 digit OTP to match DLT registered template ID
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry

    user.otp = otp;
    user.otpExpires = expires;
    await user.save();

    // Log to console
    console.log(`[SMS-MOCK] OTP for login of ${phone} is: ${otp}`);

    // Trigger SMS sending
    await this.sendSmsOtp(phone, otp);

    return {
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'production' ? undefined : otp,
    };
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

    const demoOtp =
      process.env.DEMO_OTP ||
      (process.env.NODE_ENV === 'test' ? '123456' : '778899');
    const isTestOtp = otp === demoOtp;
    if (
      !isTestOtp &&
      (!user.otp ||
        user.otp !== otp ||
        !user.otpExpires ||
        new Date() > user.otpExpires)
    ) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Check if account is suspended
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    // Clear OTP
    user.otp = null;
    user.otpExpires = null;
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
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.userModel.findOne({ phone: newPhone }).exec();
    if (existing) {
      throw new BadRequestException('New phone number is already in use');
    }

    // Generate two OTPs (6 digits to match SMS template)
    const oldPhoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newPhoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = oldPhoneOtp; // OTP for old phone
    user.otpExpires = expires;

    user.tempNewPhone = newPhone;
    user.tempPhoneOtp = newPhoneOtp; // OTP for new phone
    user.tempPhoneOtpExpires = expires;

    await user.save();

    console.log(
      `[SMS-MOCK] OTP for OLD phone (${user.phone}) change verification: ${oldPhoneOtp}`,
    );
    console.log(
      `[SMS-MOCK] OTP for NEW phone (${newPhone}) change verification: ${newPhoneOtp}`,
    );

    // Trigger SMS sending to both old and new phone numbers
    await this.sendSmsOtp(user.phone, oldPhoneOtp);
    await this.sendSmsOtp(newPhone, newPhoneOtp);

    return {
      message: 'Verification OTPs sent to both old and new numbers',
      oldPhoneOtp:
        process.env.NODE_ENV === 'production' ? undefined : oldPhoneOtp,
      newPhoneOtp:
        process.env.NODE_ENV === 'production' ? undefined : newPhoneOtp,
    } as any;
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
      user.otp !== oldPhoneOtp ||
      !user.otpExpires ||
      now > user.otpExpires
    ) {
      throw new UnauthorizedException(
        'Invalid or expired OTP for old phone number',
      );
    }

    if (
      !user.tempPhoneOtp ||
      user.tempPhoneOtp !== newPhoneOtp ||
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
