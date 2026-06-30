import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  UseGuards,
  Req,
  Res,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard, Roles } from './roles.guard';
import {
  RequestOtpDto,
  VerifyOtpDto,
  RefreshDto,
  LogoutDto,
  RegisterDto,
  RequestPhoneChangeDto,
  VerifyPhoneChangeDto,
  UpdateProfileDto,
  UpdateUserRoleDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @Throttle({ otp: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request OTP code for passwordless login / registration',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP code generated and logged to console.',
  })
  async requestOtp(@Body() body: RequestOtpDto) {
    console.log(`[REQUEST_RECEIVED] [AuthController.requestOtp] Phone: ${body.phone}`);
    console.log(`[ENTER] [AuthController.requestOtp] Delegating to AuthService.`);
    try {
      const result = await this.authService.requestOtp(body.phone);
      console.log(`[EXIT] [AuthController.requestOtp] Successfully requested OTP.`);
      return result;
    } catch (err: any) {
      console.error(`[ERROR] [AuthController.requestOtp] Error:`, err);
      throw err;
    }
  }

  @Post('verify-otp')
  @Throttle({ otp: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP and obtain JWT access token' })
  @ApiResponse({ status: 200, description: 'Successfully logged in.' })
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await this.authService.verifyOtp(
      body.phone,
      body.otp,
      userAgent,
      ipAddress,
    );

    // Set refresh token in HttpOnly, Secure (in production), SameSite=Lax cookie
    res.cookie('ng_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 20 * 365 * 24 * 60 * 60 * 1000, // 20 years
      path: '/',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiBody({ type: RefreshDto, required: false })
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() body?: RefreshDto,
  ) {
    const refreshToken = req.cookies?.['ng_refresh'] || body?.refreshToken;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await this.authService.refreshSession(
      refreshToken,
      userAgent,
      ipAddress,
    );

    res.cookie('ng_refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 20 * 365 * 24 * 60 * 60 * 1000, // 20 years
      path: '/',
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke active refresh session' })
  @ApiBody({ type: LogoutDto, required: false })
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() body?: LogoutDto,
  ) {
    const refreshToken = req.cookies?.['ng_refresh'] || body?.refreshToken;
    await this.authService.logout(refreshToken);

    res.clearCookie('ng_refresh', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all active sessions' })
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.authService.logoutAll(req.user._id);

    res.clearCookie('ng_refresh', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out from all sessions successfully' };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new enterprise user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  async register(@Body() body: RegisterDto) {
    const plants =
      body.assignedPlantIds || (body.plantId ? [body.plantId] : undefined);
    return this.authService.register(body.name, body.phone, body.role, plants);
  }

  @Post('request-phone-change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request phone number change (Dual OTP generation)',
  })
  async requestPhoneChange(
    @Req() req: any,
    @Body() body: RequestPhoneChangeDto,
  ) {
    return this.authService.requestPhoneChange(req.user._id, body.newPhone);
  }

  @Post('verify-phone-change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify phone number change with old and new OTPs' })
  async verifyPhoneChange(@Req() req: any, @Body() body: VerifyPhoneChangeDto) {
    return this.authService.verifyPhoneChange(
      req.user._id,
      body.oldPhoneOtp,
      body.newPhoneOtp,
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve authenticated user profile' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user._id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile details (name, profile picture)' })
  async updateProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user._id, body);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (Super Admin or Admin)' })
  async getAllUsers(@Req() req: any) {
    return this.authService.getAllUsers(req.user);
  }

  @Put('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.authService.updateUserRole(id, body.role, req.user);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a new user (Super Admin/Admin creates any role; Manager can create Worker only)',
  })
  async registerUserByAdmin(@Req() req: any, @Body() body: RegisterDto) {
    // Managers can only create Workers
    if (req.user.role === 'Manager' && body.role !== 'Worker') {
      throw new BadRequestException('Managers can only create Worker accounts');
    }
    const plants =
      body.assignedPlantIds || (body.plantId ? [body.plantId] : undefined);
    return this.authService.register(
      body.name,
      body.phone,
      body.role,
      plants,
      req.user,
    );
  }

  @Post('users/:id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle user active status' })
  async toggleUserActive(@Req() req: any, @Param('id') id: string) {
    return this.authService.toggleUserActive(id, req.user);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.authService.deleteUser(id, req.user);
  }

  @Post('migrate-ng-ids')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Migrate legacy users without NG IDs (idempotent, Super Admin only)',
  })
  async migrateNgIds(@Req() req: any) {
    return this.authService.migrateNgIds(req.user);
  }
}
