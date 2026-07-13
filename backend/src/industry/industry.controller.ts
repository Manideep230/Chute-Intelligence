import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { IndustryService } from './industry.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { MultiTenantGuard } from '../auth/multi-tenant.guard';
import {
  CreatePlantDto,
  UpdatePlantDto,
  CreateChuteDto,
  UpdateChuteDto,
  TriggerManualBlastDto,
  SetSimulationModeDto,
  CreateMaintenanceTicketDto,
  AddServiceHistoryDto,
  UpdateTicketStatusDto,
  CreateWebhookDto,
  SaveOpcUaConfigDto,
  CreateAssignmentDto,
  SaveCalibrationDto,
  ClaimDeviceDto,
} from './dto/industry.dto';

@ApiTags('Industrial Operations')
@Controller('industry')
@UseGuards(JwtAuthGuard, MultiTenantGuard)
@ApiBearerAuth()
export class IndustryController {
  constructor(private readonly industryService: IndustryService) {}

  @Get('plants')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({ summary: 'Get all plants' })
  @ApiResponse({ status: 200, description: 'Plants retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — Missing or invalid token' })
  async getPlants(@Req() req: any) {
    return this.industryService.getPlants(req.user);
  }

  @Post('plants')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Create a new plant' })
  @ApiResponse({ status: 201, description: 'Plant created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  async createPlant(@Req() req: any, @Body() body: CreatePlantDto) {
    return this.industryService.createPlant({
      ...body,
      createdBy: req.user._id,
    } as any);
  }

  @Patch('plants/:id')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Update plant details (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Plant details updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Super Admin only' })
  @ApiResponse({ status: 404, description: 'Plant not found' })
  async updatePlant(
    @Param('id') id: string,
    @Body() body: UpdatePlantDto,
    @Req() req: any,
  ) {
    return this.industryService.updatePlant(id, body as any, req.user);
  }

  @Post('plants/:id/disable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Disable a plant (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Plant disabled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Plant not found' })
  async disablePlant(@Param('id') id: string, @Req() req: any) {
    return this.industryService.disablePlant(id, req.user);
  }

  @Post('plants/:id/enable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Re-enable a disabled plant (Super Admin)' })
  @ApiResponse({ status: 200, description: 'Plant re-enabled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Plant not found' })
  async enablePlant(@Param('id') id: string, @Req() req: any) {
    return this.industryService.enablePlant(id, req.user);
  }

  @Get('chutes')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({ summary: 'Get all chutes (optional plantId filter)' })
  @ApiQuery({ name: 'plantId', required: false, description: 'Filter by plant ObjectId' })
  @ApiResponse({ status: 200, description: 'List of chutes retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChutes(@Req() req: any, @Query('plantId') plantId?: string) {
    return this.industryService.getChutes(plantId, req.user);
  }

  @Post('chutes')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({
    summary: 'Create a new chute and initialize default components',
  })
  @ApiResponse({ status: 201, description: 'Chute created successfully and hardware components initialized.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createChute(@Body() body: CreateChuteDto, @Req() req: any) {
    return this.industryService.createChute(body as any, req.user);
  }

  @Patch('chutes/:id')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager', 'Worker')
  @ApiOperation({ summary: 'Update chute details (Admin+)' })
  @ApiResponse({ status: 200, description: 'Chute details updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async updateChute(
    @Param('id') id: string,
    @Body() body: UpdateChuteDto,
    @Req() req: any,
  ) {
    return this.industryService.updateChute(id, body, req.user);
  }

  @Post('chutes/:id/disable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Disable a chute (Admin+)' })
  @ApiResponse({ status: 200, description: 'Chute disabled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async disableChute(@Param('id') id: string, @Req() req: any) {
    return this.industryService.disableChute(id, req.user);
  }

  @Post('chutes/:id/enable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({ summary: 'Re-enable a disabled chute (Admin+)' })
  @ApiResponse({ status: 200, description: 'Chute re-enabled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async enableChute(@Param('id') id: string, @Req() req: any) {
    return this.industryService.enableChute(id, req.user);
  }

  @Get('chutes/:id/detail')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({
    summary:
      'Get detailed chute operational telemetry, health, and configuration',
  })
  @ApiResponse({ status: 200, description: 'Full chute detail including radar, compressor, blasters, solenoids, and AI prediction.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getChuteDetail(@Param('id') id: string) {
    return this.industryService.getChuteDetail(id);
  }

  @Post('chutes/:id/blast')
  @Throttle({ blast: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Trigger a manual air blast sequence for a specific blaster or solenoid valve',
  })
  @ApiResponse({ status: 200, description: 'Blast command published to MQTT successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Invalid blaster/valve number' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async triggerManualBlast(
    @Param('id') id: string,
    @Body() body: TriggerManualBlastDto,
    @Req() req: any,
  ) {
    return this.industryService.triggerManualBlast(
      id,
      body.blasterNumber,
      body.valveNumber,
      req.user._id,
    );
  }

  @Post('chutes/:id/simulation-mode')
  @Throttle({ blast: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Enable or disable Simulation (Manual) Mode for blockage testing',
  })
  @ApiResponse({ status: 200, description: 'Simulation mode toggled and MQTT commands published.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async setSimulationMode(
    @Param('id') id: string,
    @Body() body: SetSimulationModeDto,
    @Req() req: any,
  ) {
    return this.industryService.setSimulationMode(
      id,
      body.enabled,
      {
        activePath: body.activePath,
        blockagePosition: body.blockagePosition,
        blockageDistance: body.blockageDistance,
        nearestSolenoidGroup: body.nearestSolenoidGroup,
        injectRadarZone: body.injectRadarZone,
      },
      req.user._id,
    );
  }

  @Get('alerts')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({ summary: 'Get active alerts feed' })
  @ApiQuery({ name: 'chuteId', required: false, description: 'Filter alerts by chute ObjectId' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAlerts(@Req() req: any, @Query('chuteId') chuteId?: string) {
    return this.industryService.getAlerts(chuteId, req.user);
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve an active hardware alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolveAlert(@Param('id') id: string, @Req() req: any) {
    return this.industryService.resolveAlert(id, req.user._id);
  }

  @Post('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an active alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async acknowledgeAlert(@Param('id') id: string, @Req() req: any) {
    return this.industryService.acknowledgeAlert(id, req.user._id);
  }

  @Post('alerts/:id/silence')
  @ApiOperation({ summary: 'Silence an active alert' })
  @ApiResponse({ status: 200, description: 'Alert silenced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async silenceAlert(@Param('id') id: string, @Req() req: any) {
    return this.industryService.silenceAlert(id, req.user._id);
  }

  @Post('alerts/:id/escalate')
  @ApiOperation({ summary: 'Escalate an active alert severity' })
  @ApiResponse({ status: 200, description: 'Alert escalated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async escalateAlert(@Param('id') id: string, @Req() req: any) {
    return this.industryService.escalateAlert(id, req.user._id);
  }

  @Get('mqtt/monitoring-stats')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({ summary: 'Get live MQTT monitoring statistics' })
  @ApiResponse({ status: 200, description: 'MQTT statistics retrieved successfully.' })
  async getMqttStats() {
    return this.industryService.getMqttStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Retrieve permanent, immutable system audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuditLogs(@Req() req: any) {
    return this.industryService.getAuditLogs(req.user);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get user notification feed' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(@Req() req: any) {
    return this.industryService.getNotifications(req.user._id);
  }

  @Get('maintenance')
  @ApiOperation({
    summary: 'List all maintenance tickets and worker assignments',
  })
  @ApiResponse({ status: 200, description: 'Maintenance tickets retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMaintenanceTickets(@Req() req: any) {
    return this.industryService.getMaintenanceTickets(req.user);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Create a maintenance work order ticket' })
  @ApiResponse({ status: 201, description: 'Maintenance ticket created.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createMaintenanceTicket(@Body() body: CreateMaintenanceTicketDto) {
    return this.industryService.createMaintenanceTicket(body);
  }

  @Post('maintenance/:id/history')
  @ApiOperation({ summary: 'Log a service action to a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Service action logged successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Maintenance ticket not found' })
  async addServiceHistory(
    @Param('id') id: string,
    @Body() body: AddServiceHistoryDto,
    @Req() req: any,
  ) {
    return this.industryService.addServiceHistory(
      id,
      body.action,
      body.notes,
      req.user._id,
    );
  }

  @Post('maintenance/:id/status')
  @ApiOperation({
    summary:
      'Update status of a maintenance ticket (resolving resets health scores)',
  })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Maintenance ticket not found' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() body: UpdateTicketStatusDto,
    @Req() req: any,
  ) {
    return this.industryService.updateTicketStatus(
      id,
      body.status,
      req.user._id,
    );
  }

  @Get('analytics/trends/:chuteId')
  @ApiOperation({
    summary: 'Fetch historical telemetry trends for trend line charts',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max data points to return (default 50)' })
  @ApiResponse({ status: 200, description: 'Telemetry trend data retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getTelemetryTrends(
    @Param('chuteId') chuteId: string,
    @Query('limit') limit?: number,
  ) {
    return this.industryService.getTelemetryTrends(
      chuteId,
      limit ? Number(limit) : 50,
    );
  }

  // --- WEBHOOKS ---
  @Get('webhooks')
  @ApiOperation({ summary: 'Get all active webhooks for organization' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWebhooks(@Req() req: any) {
    const orgId = req.user.organizationId || '6a38c55a7fcfb7085c8786fc';
    return this.industryService.getWebhooks(orgId);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Register a new outbound webhook' })
  @ApiResponse({ status: 201, description: 'Webhook registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWebhook(@Req() req: any, @Body() body: CreateWebhookDto) {
    const orgId = req.user.organizationId || '6a38c55a7fcfb7085c8786fc';
    return this.industryService.createWebhook(orgId, body);
  }

  @Post('webhooks/:id/delete')
  @ApiOperation({ summary: 'Delete a registered webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async deleteWebhook(@Param('id') id: string) {
    return this.industryService.deleteWebhook(id);
  }

  // --- OPC-UA PLC REGISTER MAPPINGS ---
  @Get('opc-ua/:plantId')
  @ApiOperation({ summary: 'Get OPC-UA node mapping config for a plant' })
  @ApiResponse({ status: 200, description: 'OPC-UA configuration retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plant not found' })
  async getOpcUaConfig(@Param('plantId') plantId: string) {
    return this.industryService.getOpcUaConfig(plantId);
  }

  @Post('opc-ua/:plantId')
  @ApiOperation({ summary: 'Save/update OPC-UA node mapping configs' })
  @ApiResponse({ status: 200, description: 'OPC-UA configuration saved.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async saveOpcUaConfig(
    @Param('plantId') plantId: string,
    @Body() body: SaveOpcUaConfigDto,
  ) {
    return this.industryService.saveOpcUaConfig(plantId, body);
  }

  // ── CHUTE INTELLIGENCE ENDPOINTS ──────────────────────────────────────────

  @Get('chutes/:id/blast-history')
  @ApiOperation({
    summary: 'Get blast outcome history with effectiveness scores for a chute',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max records to return (default 20)' })
  @ApiResponse({ status: 200, description: 'Blast history retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getBlastHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.industryService.getBlastHistory(id, limit ? Number(limit) : 20);
  }

  @Get('chutes/:id/kpis')
  @SkipThrottle({ default: true, otp: true, aiChat: true, blast: true })
  @ApiOperation({
    summary:
      'Get full chute intelligence KPI set: uptime, blockage minutes, blast effectiveness, air consumption',
  })
  @ApiResponse({ status: 200, description: 'Chute KPIs computed and returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getChuteKpis(@Param('id') id: string) {
    return this.industryService.getChuteKpis(id);
  }

  @Get('fleet/kpis')
  @ApiOperation({
    summary:
      'Get fleet-wide chute KPI summary for Operations Room header panel',
  })
  @ApiQuery({ name: 'plantId', required: false, description: 'Filter fleet KPIs by plant' })
  @ApiResponse({ status: 200, description: 'Fleet-wide KPI summary retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFleetKpis(@Req() req: any, @Query('plantId') plantId?: string) {
    return this.industryService.getFleetKpis(plantId, req.user);
  }

  @Get('assignments')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get all assignments' })
  @ApiResponse({ status: 200, description: 'Assignments retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Manager+ required' })
  async getAssignments(@Req() req: any) {
    return this.industryService.getAssignments(req.user);
  }

  @Post('assignments')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create an assignment' })
  @ApiResponse({ status: 201, description: 'Assignment created.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createAssignment(@Req() req: any, @Body() body: CreateAssignmentDto) {
    return this.industryService.createAssignment(
      body.userId,
      body.plantId,
      body.chuteId,
      req.user,
    );
  }

  @Post('assignments/:id/delete')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Delete an assignment' })
  @ApiResponse({ status: 200, description: 'Assignment deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async deleteAssignment(@Req() req: any, @Param('id') id: string) {
    return this.industryService.deleteAssignment(id, req.user);
  }

  // ── CALIBRATION ENDPOINTS ───────────────────────────────────────────────────

  @Post('chutes/:id/calibrate')
  @ApiOperation({
    summary: 'Save radar zone calibration result and update baseline distance',
  })
  @ApiResponse({ status: 201, description: 'Calibration saved and baseline updated.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async saveCalibration(
    @Param('id') chuteId: string,
    @Body() body: SaveCalibrationDto,
    @Req() req: any,
  ) {
    return this.industryService.saveCalibration(
      chuteId,
      body.zone,
      body.baselineDistance,
      body.measuredDistance,
      body.calibrationMode,
      body.notes || '',
      req.user._id,
    );
  }

  @Get('chutes/:id/calibration-history')
  @ApiOperation({ summary: 'Get radar calibration history for a chute' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max records to return (default 20)' })
  @ApiResponse({ status: 200, description: 'Calibration history retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getCalibrationHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.industryService.getCalibrationHistory(
      id,
      limit ? Number(limit) : 20,
    );
  }

  // ── QR DEVICE ONBOARDING ──────────────────────────────────────────────────

  @Get('chutes/:id/qr-token')
  @ApiOperation({
    summary: 'Generate QR code payload for physical hardware hub onboarding',
  })
  @ApiResponse({ status: 200, description: 'QR token payload generated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getQrToken(@Param('id') id: string) {
    return this.industryService.generateQrToken(id);
  }

  @Post('chutes/:id/claim-device')
  @ApiOperation({ summary: 'Claim/link a hardware hub device' })
  @ApiResponse({ status: 200, description: 'Device claimed and linked to chute.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Device already linked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async claimDevice(
    @Param('id') id: string,
    @Body() body: ClaimDeviceDto,
    @Req() req: any,
  ) {
    return this.industryService.claimDevice(id, body.deviceId, req.user._id);
  }

  @Post('chutes/:id/unlink-device')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiTags('Super Admin Operations')
  @ApiOperation({
    summary: 'Unlink a hardware device from this chute (Admin+)',
  })
  @ApiResponse({ status: 200, description: 'Device unlinked from chute.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin+ required' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async unlinkDevice(@Param('id') id: string, @Req() req: any) {
    return this.industryService.unlinkDevice(id, req.user._id);
  }
}
