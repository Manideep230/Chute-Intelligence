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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async getById(@Param('id') id: string) {
    return this.incidentsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new incident report' })
  async create(@Body() body: CreateIncidentDto, @Req() req: any) {
    return this.incidentsService.create(body, req.user._id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update incident status, assignment, or root cause',
  })
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
  async close(
    @Param('id') id: string,
    @Body() body: CloseIncidentDto,
    @Req() req: any,
  ) {
    return this.incidentsService.close(id, req.user._id, body);
  }
}
