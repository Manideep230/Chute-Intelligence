import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({
    description: 'Chute ObjectId associated with this incident',
    example: '6a38c55a7fcfb7085c8786fd',
  })
  @IsString()
  @IsNotEmpty()
  chuteId: string;

  @ApiProperty({
    description: 'Short summary or title of the incident',
    example: 'Radar zone 2 cleanup required',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed explanation of the issue observed',
    example:
      'Continuous buildup detected by sensor in zone 2. Auto-blast failed to clear.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Severity category of the incident',
    example: 'Medium',
    enum: ['Low', 'Medium', 'High', 'Critical'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Low', 'Medium', 'High', 'Critical'])
  severity: string;

  @ApiProperty({
    description: 'Type/category of hardware or process impacted',
    example: 'Radar',
    enum: ['Radar', 'Compressor', 'Solenoid', 'Structural', 'Process', 'Other'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['Radar', 'Compressor', 'Solenoid', 'Structural', 'Process', 'Other'])
  incidentType: string;

  @ApiPropertyOptional({
    description: 'The zone number (1-4) impacted by this incident',
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  affectedZone?: number;

  @ApiPropertyOptional({
    description: 'User ObjectId of the assigned responder',
    example: '6a38c55a7fcfb7085c8786fb',
  })
  @IsString()
  @IsOptional()
  assignedTo?: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({
    description: 'Incident status',
    example: 'Investigating',
    enum: ['Open', 'Investigating', 'Escalated', 'Resolved'],
  })
  @IsString()
  @IsOptional()
  @IsEnum(['Open', 'Investigating', 'Escalated', 'Resolved'])
  status?: string;

  @ApiPropertyOptional({
    description: 'User ObjectId of the assigned responder',
    example: '6a38c55a7fcfb7085c8786fb',
  })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'The root cause identified for this incident',
    example: 'Wet clay blockage causing sensor signal reflection',
  })
  @IsString()
  @IsOptional()
  rootCause?: string;

  @ApiPropertyOptional({
    description: 'Corrective action taken to fix the issue',
    example: 'Solenoid 3 manually fired, physical cleaning performed',
  })
  @IsString()
  @IsOptional()
  correctionAction?: string;

  @ApiPropertyOptional({
    description: 'Technician note added to the history timeline',
    example: 'Started looking into the radar telemetry logs.',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class EscalateIncidentDto {
  @ApiPropertyOptional({
    description: 'Escalation note explanation',
    example: 'Blockage is severe, requiring structural team assistance.',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class CloseIncidentDto {
  @ApiProperty({
    description: 'Root cause explanation of why it happened',
    example: 'Moisture level in limestone exceeded limits',
  })
  @IsString()
  @IsNotEmpty()
  rootCause: string;

  @ApiProperty({
    description: 'Action taken to clear the incident and prevent recurrence',
    example: 'Cleaned chute manually and adjusted dryer temperature',
  })
  @IsString()
  @IsNotEmpty()
  correctionAction: string;

  @ApiPropertyOptional({
    description: 'Closure note explanation',
    example: 'Chute successfully cleared and back online.',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
