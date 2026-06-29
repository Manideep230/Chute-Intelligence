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
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
  @ApiOperation({ summary: 'Get all plants' })
  async getPlants(@Req() req: any) {
    return this.industryService.getPlants(req.user);
  }

  @Post('plants')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Create a new plant' })
  async createPlant(@Req() req: any, @Body() body: CreatePlantDto) {
    return this.industryService.createPlant({
      ...body,
      createdBy: req.user._id,
    } as any);
  }

  @Patch('plants/:id')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Update plant details (Super Admin)' })
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
  @ApiOperation({ summary: 'Disable a plant (Super Admin)' })
  async disablePlant(@Param('id') id: string, @Req() req: any) {
    return this.industryService.disablePlant(id, req.user);
  }

  @Post('plants/:id/enable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Re-enable a disabled plant (Super Admin)' })
  async enablePlant(@Param('id') id: string, @Req() req: any) {
    return this.industryService.enablePlant(id, req.user);
  }

  @Get('chutes')
  @ApiOperation({ summary: 'Get all chutes (optional plantId filter)' })
  async getChutes(@Req() req: any, @Query('plantId') plantId?: string) {
    return this.industryService.getChutes(plantId, req.user);
  }

  @Post('chutes')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiOperation({
    summary: 'Create a new chute and initialize default components',
  })
  async createChute(@Body() body: CreateChuteDto, @Req() req: any) {
    return this.industryService.createChute(body as any, req.user);
  }

  @Patch('chutes/:id')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager', 'Worker')
  @ApiOperation({ summary: 'Update chute details (Admin+)' })
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
  @ApiOperation({ summary: 'Disable a chute (Admin+)' })
  async disableChute(@Param('id') id: string, @Req() req: any) {
    return this.industryService.disableChute(id, req.user);
  }

  @Post('chutes/:id/enable')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin')
  @ApiOperation({ summary: 'Re-enable a disabled chute (Admin+)' })
  async enableChute(@Param('id') id: string, @Req() req: any) {
    return this.industryService.enableChute(id, req.user);
  }

  @Get('chutes/:id/detail')
  @ApiOperation({
    summary:
      'Get detailed chute operational telemetry, health, and configuration',
  })
  async getChuteDetail(@Param('id') id: string) {
    return this.industryService.getChuteDetail(id);
  }

  @Post('chutes/:id/blast')
  @Throttle({ blast: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Trigger a manual air blast sequence for a specific blaster or solenoid valve',
  })
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
  @ApiOperation({ summary: 'Get active alerts feed' })
  async getAlerts(@Req() req: any, @Query('chuteId') chuteId?: string) {
    return this.industryService.getAlerts(chuteId, req.user);
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve an active hardware alert' })
  async resolveAlert(@Param('id') id: string, @Req() req: any) {
    return this.industryService.resolveAlert(id, req.user._id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Retrieve permanent, immutable system audit logs' })
  async getAuditLogs(@Req() req: any) {
    return this.industryService.getAuditLogs(req.user);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get user notification feed' })
  async getNotifications(@Req() req: any) {
    return this.industryService.getNotifications(req.user._id);
  }

  @Get('maintenance')
  @ApiOperation({
    summary: 'List all maintenance tickets and worker assignments',
  })
  async getMaintenanceTickets(@Req() req: any) {
    return this.industryService.getMaintenanceTickets(req.user);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Create a maintenance work order ticket' })
  async createMaintenanceTicket(@Body() body: CreateMaintenanceTicketDto) {
    return this.industryService.createMaintenanceTicket(body);
  }

  @Post('maintenance/:id/history')
  @ApiOperation({ summary: 'Log a service action to a maintenance ticket' })
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
  async getWebhooks(@Req() req: any) {
    const orgId = req.user.organizationId || '6a38c55a7fcfb7085c8786fc';
    return this.industryService.getWebhooks(orgId);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Register a new outbound webhook' })
  async createWebhook(@Req() req: any, @Body() body: CreateWebhookDto) {
    const orgId = req.user.organizationId || '6a38c55a7fcfb7085c8786fc';
    return this.industryService.createWebhook(orgId, body);
  }

  @Post('webhooks/:id/delete')
  @ApiOperation({ summary: 'Delete a registered webhook' })
  async deleteWebhook(@Param('id') id: string) {
    return this.industryService.deleteWebhook(id);
  }

  // --- OPC-UA PLC REGISTER MAPPINGS ---
  @Get('opc-ua/:plantId')
  @ApiOperation({ summary: 'Get OPC-UA node mapping config for a plant' })
  async getOpcUaConfig(@Param('plantId') plantId: string) {
    return this.industryService.getOpcUaConfig(plantId);
  }

  @Post('opc-ua/:plantId')
  @ApiOperation({ summary: 'Save/update OPC-UA node mapping configs' })
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
  async getBlastHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.industryService.getBlastHistory(id, limit ? Number(limit) : 20);
  }

  @Get('chutes/:id/kpis')
  @ApiOperation({
    summary:
      'Get full chute intelligence KPI set: uptime, blockage minutes, blast effectiveness, air consumption',
  })
  async getChuteKpis(@Param('id') id: string) {
    return this.industryService.getChuteKpis(id);
  }

  @Get('fleet/kpis')
  @ApiOperation({
    summary:
      'Get fleet-wide chute KPI summary for Operations Room header panel',
  })
  async getFleetKpis(@Req() req: any, @Query('plantId') plantId?: string) {
    return this.industryService.getFleetKpis(plantId, req.user);
  }

  @Get('assignments')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get all assignments' })
  async getAssignments(@Req() req: any) {
    return this.industryService.getAssignments(req.user);
  }

  @Post('assignments')
  @UseGuards(RolesGuard)
  @Roles('Super Admin', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create an assignment' })
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
  async deleteAssignment(@Req() req: any, @Param('id') id: string) {
    return this.industryService.deleteAssignment(id, req.user);
  }

  // ── CALIBRATION ENDPOINTS ───────────────────────────────────────────────────

  @Post('chutes/:id/calibrate')
  @ApiOperation({
    summary: 'Save radar zone calibration result and update baseline distance',
  })
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
  async getQrToken(@Param('id') id: string) {
    return this.industryService.generateQrToken(id);
  }

  @Post('chutes/:id/claim-device')
  @ApiOperation({ summary: 'Claim/link a hardware hub device' })
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
  @ApiOperation({
    summary: 'Unlink a hardware device from this chute (Admin+)',
  })
  async unlinkDevice(@Param('id') id: string, @Req() req: any) {
    return this.industryService.unlinkDevice(id, req.user._id);
  }
}
