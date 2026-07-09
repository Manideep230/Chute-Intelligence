import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
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
  SetRadarTelemetryDto,
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
  @SkipThrottle()
  @ApiOperation({ summary: 'Get current status of a specific hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Hub status retrieved' })
  @ApiResponse({ status: 404, description: 'Hub not found' })
  async getHubStatus(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubStatus(hubId);
  }

  @Get('health/:hubId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get health report for a specific hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Hub health retrieved' })
  async getHubHealth(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubHealth(hubId);
  }

  @Get('telemetry/:hubId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get recent telemetry for a hub' })
  @ApiParam({ name: 'hubId', description: '16-digit hub hardware ID' })
  @ApiResponse({ status: 200, description: 'Telemetry data retrieved' })
  async getHubTelemetry(@Param('hubId') hubId: string) {
    return this.hardwareService.getHubTelemetry(hubId);
  }

  @Get('commands/:chuteId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get command history for a chute' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Command history retrieved' })
  async getCommandHistory(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getCommandHistory(chuteId);
  }

  @Get('topology/:chuteId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get full hardware topology for a chute' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Full topology (cells, hubs, radars, SABs, solenoids, compressor)' })
  async getTopology(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getTopology(chuteId);
  }

  // ── Configuration ───────────────────────────────────────────────────────

  @Get('config/:chuteId')
  @SkipThrottle()
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

  @Post('telemetry/radar')
  @ApiOperation({ summary: 'Manually set radar sensor readings for a chute (simulates blockages)' })
  @ApiResponse({ status: 201, description: 'Radar values updated, autonomous decision engine triggered' })
  async setRadarTelemetry(@Body() dto: SetRadarTelemetryDto) {
    return this.hardwareService.setRadarTelemetry(dto.chuteId, dto.radarValues);
  }

  @Get('inventory')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get complete device inventory' })
  @ApiResponse({ status: 200, description: 'Device inventory retrieved' })
  async getInventory() {
    return this.hardwareService.getInventory();
  }

  @Get('predictive-maintenance/:chuteId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get predictive maintenance report for all component types on a chute' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Predictive health report retrieved' })
  async getPredictiveMaintenance(@Param('chuteId') chuteId: string) {
    return this.hardwareService.getPredictiveMaintenance(chuteId);
  }

  @Get('replay/:chuteId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get historical timeline events for playback replay' })
  @ApiParam({ name: 'chuteId', description: 'Chute ObjectId' })
  @ApiQuery({ name: 'start', description: 'Start Date ISO string' })
  @ApiQuery({ name: 'end', description: 'End Date ISO string' })
  @ApiResponse({ status: 200, description: 'Replay timeline data retrieved' })
  async getReplayTimeline(
    @Param('chuteId') chuteId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.hardwareService.getReplayTimeline(chuteId, start, end);
  }

  @Post('commands/:commandId/replay')
  @ApiOperation({ summary: 'Re-dispatches a command as a new command execution' })
  @ApiParam({ name: 'commandId', description: 'The old command ID' })
  @ApiResponse({ status: 201, description: 'Command replayed successfully' })
  async replayCommand(@Param('commandId') commandId: string, @Req() req: any) {
    return this.hardwareService.replayCommand(commandId, req.user?._id?.toString());
  }

  @Post('commands/:commandId/cancel')
  @ApiOperation({ summary: 'Cancel a command queue entry' })
  @ApiParam({ name: 'commandId', description: 'The command ID to cancel' })
  @ApiResponse({ status: 200, description: 'Command cancelled' })
  async cancelCommand(@Param('commandId') commandId: string) {
    return this.hardwareService.cancelCommand(commandId);
  }

  @Post('commands/execute')
  @ApiOperation({ summary: 'Manually execute an arbitrary command' })
  @ApiResponse({ status: 201, description: 'Command published' })
  async manualExecute(
    @Body() body: { chuteId: string; action: string; payload: any },
    @Req() req: any,
  ) {
    return this.hardwareService.manualExecute(
      body.chuteId,
      body.action,
      body.payload,
      req.user?._id?.toString(),
    );
  }
}
