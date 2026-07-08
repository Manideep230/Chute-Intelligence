import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MultiTenantGuard } from '../auth/multi-tenant.guard';
import { HardwareService } from './hardware.service';
import {
  ManualBlastDto,
  SolenoidControlDto,
  SimulationDto,
  RegisterDeviceDto,
  RetryCommandDto,
  UpdateConfigDto,
} from './dto/hardware.dto';

@ApiTags('Hardware Control')
@Controller('hardware')
@UseGuards(JwtAuthGuard, MultiTenantGuard)
@ApiBearerAuth()
export class HardwareController {
  constructor(private readonly hardwareService: HardwareService) {}

  // ── Blast Operations ────────────────────────────────────────────────────

  @Post('blast')
  @Throttle({ blast: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Trigger a manual air blast on a specific SAB and solenoid(s)',
  })
  @ApiResponse({ status: 201, description: 'Blast command created and published to MQTT' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async triggerBlast(@Body() dto: ManualBlastDto, @Req() req: any) {
    const userId = req.user?._id || null;
    return this.hardwareService.triggerManualBlast(
      dto.chuteId,
      dto.sabNumber,
      dto.solenoidNumbers,
      dto.blastDurationMs || 0,
      userId,
    );
  }

  // ── Solenoid Control ────────────────────────────────────────────────────

  @Post('open-solenoid')
  @ApiOperation({ summary: 'Open a specific solenoid valve' })
  @ApiResponse({ status: 201, description: 'Solenoid open command sent' })
  async openSolenoid(@Body() dto: SolenoidControlDto) {
    return this.hardwareService.openSolenoid(dto.chuteId, dto.valveNumber);
  }

  @Post('close-solenoid')
  @ApiOperation({ summary: 'Close a specific solenoid valve' })
  @ApiResponse({ status: 201, description: 'Solenoid close command sent' })
  async closeSolenoid(@Body() dto: SolenoidControlDto) {
    return this.hardwareService.closeSolenoid(dto.chuteId, dto.valveNumber);
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  @Post('start-simulation')
  @ApiOperation({ summary: 'Enable simulation mode for a chute' })
  @ApiResponse({ status: 201, description: 'Simulation mode activated' })
  async startSimulation(@Body() dto: SimulationDto) {
    return this.hardwareService.startSimulation(dto.chuteId);
  }

  @Post('stop-simulation')
  @ApiOperation({ summary: 'Disable simulation mode for a chute' })
  @ApiResponse({ status: 201, description: 'Simulation mode deactivated' })
  async stopSimulation(@Body() dto: SimulationDto) {
    return this.hardwareService.stopSimulation(dto.chuteId);
  }

  // ── Device Registration ─────────────────────────────────────────────────

  @Post('register-device')
  @ApiOperation({ summary: 'Register a new Nigha Hub device' })
  @ApiResponse({ status: 201, description: 'Device registered and linked to chute' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.hardwareService.registerDevice(dto);
  }

  // ── Command Operations ──────────────────────────────────────────────────

  @Post('retry-command')
  @ApiOperation({ summary: 'Retry a failed or timed-out command' })
  @ApiResponse({ status: 201, description: 'Command retried and re-published' })
  @ApiResponse({ status: 404, description: 'Command not found' })
  async retryCommand(@Body() dto: RetryCommandDto) {
    return this.hardwareService.retryCommand(dto.commandId);
  }

  // ── Status & Health Queries ─────────────────────────────────────────────

  @Get('status/:hubId')
  @ApiOperation({ summary: 'Get current status of a specific hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Hub status retrieved' })
  @ApiResponse({ status: 404, description: 'Hub not found' })
  async getHubStatus(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubStatus(hubId);
  }

  @Get('health/:hubId')
  @ApiOperation({ summary: 'Get health report for a specific hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Hub health retrieved' })
  async getHubHealth(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubHealth(hubId);
  }

  @Get('telemetry/:hubId')
  @ApiOperation({ summary: 'Get recent telemetry for a hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Telemetry data retrieved' })
  async getHubTelemetry(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubTelemetry(hubId);
  }

  @Get('commands/:chuteId')
  @ApiOperation({ summary: 'Get command history for a chute' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Command history retrieved' })
  async getCommandHistory(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getCommandHistory(chuteId);
  }

  @Get('topology/:chuteId')
  @ApiOperation({ summary: 'Get full hardware topology for a chute' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Full topology (cells, hubs, radars, SABs, solenoids, compressor)' })
  async getTopology(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getTopology(chuteId);
  }

  // ── Configuration ───────────────────────────────────────────────────────

  @Get('config/:chuteId')
  @ApiOperation({ summary: 'Get SAB configuration for a chute (or global defaults)' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId (or "global" for defaults)' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  async getConfig(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getConfig(
      chuteId === 'global' ? undefined : chuteId,
    );
  }

  @Post('config')
  @ApiOperation({ summary: 'Update SAB autonomous configuration' })
  @ApiResponse({ status: 201, description: 'Configuration updated' })
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return this.hardwareService.updateConfig(dto);
  }
}
