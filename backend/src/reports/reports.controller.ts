import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MultiTenantGuard } from '../auth/multi-tenant.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, MultiTenantGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':chuteId')
  @ApiOperation({
    summary: 'Generate and download operational report for a chute',
  })
  @ApiQuery({ name: 'format', enum: ['json', 'csv'], required: false })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO date string for period start',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO date string for period end',
  })
  async getReport(
    @Param('chuteId') chuteId: string,
    @Query('format') format: string = 'json',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: any,
  ) {
    if (!res) return;
    const data = await this.reportsService.getReportData(chuteId, from, to);
    const chuteName = (data.chute as any)?.name || 'chute';
    const safeChuteName = chuteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = this.reportsService.generateCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="nigha_report_${safeChuteName}_${dateStr}.csv"`,
      );
      return res.send(csv);
    }

    // Default: JSON (frontend handles PDF/Excel rendering)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nigha_report_${safeChuteName}_${dateStr}.json"`,
    );
    return res.json(data);
  }
}
