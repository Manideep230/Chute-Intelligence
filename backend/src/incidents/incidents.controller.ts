import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MultiTenantGuard } from '../auth/multi-tenant.guard';
import { IncidentsService } from './incidents.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  EscalateIncidentDto,
  CloseIncidentDto,
} from './dto/incident.dto';

@ApiTags('Incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard, MultiTenantGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all incidents with optional filters' })
  @ApiQuery({ name: 'chuteId', required: false, description: 'Filter incidents by chute ObjectId' })
  @ApiQuery({ name: 'severity', required: false, enum: ['Low', 'Medium', 'High', 'Critical'], description: 'Filter by incident severity' })
  @ApiQuery({ name: 'status', required: false, enum: ['Open', 'Investigating', 'Escalated', 'Resolved'], description: 'Filter by incident status' })
  @ApiResponse({ status: 200, description: 'Incidents listed successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — Missing or invalid access token' })
  async getAll(
    @Req() req: any,
    @Query('chuteId') chuteId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    return this.incidentsService.getAll(
      { chuteId, severity, status },
      req.user,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident detail with full timeline' })
  @ApiResponse({ status: 200, description: 'Incident detail retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async getById(@Param('id') id: string) {
    return this.incidentsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new incident report' })
  @ApiResponse({ status: 201, description: 'Incident created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() body: CreateIncidentDto, @Req() req: any) {
    return this.incidentsService.create(body, req.user._id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update incident status, assignment, or root cause',
  })
  @ApiResponse({ status: 200, description: 'Incident updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateIncidentDto,
    @Req() req: any,
  ) {
    return this.incidentsService.update(id, body, req.user._id);
  }

  @Post(':id/escalate')
  @ApiOperation({
    summary:
      'Escalate incident to next level (Open → Investigating → Escalated)',
  })
  @ApiResponse({ status: 200, description: 'Incident escalated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async escalate(
    @Param('id') id: string,
    @Body() body: EscalateIncidentDto,
    @Req() req: any,
  ) {
    return this.incidentsService.escalate(id, req.user._id, body.note);
  }

  @Post(':id/close')
  @ApiOperation({
    summary: 'Close incident with root cause and corrective action',
  })
  @ApiResponse({ status: 200, description: 'Incident closed successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request — Missing closure requirements' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async close(
    @Param('id') id: string,
    @Body() body: CloseIncidentDto,
    @Req() req: any,
  ) {
    return this.incidentsService.close(id, req.user._id, body);
  }
}
