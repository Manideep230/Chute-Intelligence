import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
  ArrayNotEmpty,
} from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// Blast DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class ManualBlastDto {
  @ApiProperty({ description: 'Chute ObjectId', example: '6650a1b2c3d4e5f6a7b8c9d0' })
  @IsString()
  chuteId: string;

  @ApiProperty({ description: 'SAB blaster number (1–4)', example: 1 })
  @IsNumber()
  @Min(1)
  @Max(4)
  sabNumber: number;

  @ApiProperty({
    description: 'Solenoid valve numbers to fire',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  solenoidNumbers: number[];

  @ApiPropertyOptional({
    description: 'Blast duration in milliseconds (0 = dynamic)',
    example: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  blastDurationMs?: number;
}

export class SolenoidControlDto {
  @ApiProperty({ description: 'Chute ObjectId' })
  @IsString()
  chuteId: string;

  @ApiProperty({ description: 'Solenoid valve number', example: 1 })
  @IsNumber()
  @Min(1)
  @Max(8)
  valveNumber: number;
}

export class SimulationDto {
  @ApiProperty({ description: 'Chute ObjectId' })
  @IsString()
  chuteId: string;
}

export class RegisterDeviceDto {
  @ApiProperty({ description: '16-digit hub hardware ID', example: 'NGCH000000000001' })
  @IsString()
  hubId: string;

  @ApiProperty({ description: 'Chute ObjectId' })
  @IsString()
  chuteId: string;

  @ApiProperty({ description: 'MQTT pass name for authentication', example: 'operator01' })
  @IsString()
  passName: string;

  @ApiProperty({ description: 'MQTT pass key for authentication', example: 'secureKey01' })
  @IsString()
  passKey: string;

  @ApiPropertyOptional({ description: 'SIM number (cellular hubs)', example: '9391888104' })
  @IsOptional()
  @IsString()
  simNumber?: string;

  @ApiPropertyOptional({ description: 'Firmware version', example: '1.0.0' })
  @IsOptional()
  @IsString()
  firmware?: string;

  @ApiPropertyOptional({ description: 'Hardware version', example: '1.0' })
  @IsOptional()
  @IsString()
  hardwareVersion?: string;

  @ApiPropertyOptional({ description: 'Device MAC address' })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional({ description: 'Device serial number' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Device model name' })
  @IsOptional()
  @IsString()
  deviceModel?: string;
}

export class RetryCommandDto {
  @ApiProperty({ description: 'The command UUID to retry' })
  @IsString()
  commandId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateConfigDto {
  @ApiProperty({ description: 'Chute ObjectId (null for global defaults)' })
  @IsOptional()
  @IsString()
  chuteId?: string;

  @ApiPropertyOptional({ description: 'Enable fully autonomous blast mode' })
  @IsOptional()
  autoBlastEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Minimum blockage probability (0–100) to consider blast' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  blockageProbabilityThreshold?: number;

  @ApiPropertyOptional({ description: 'Minimum AI confidence (0–100) to auto-execute blast' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidenceThreshold?: number;

  @ApiPropertyOptional({ description: 'Cooldown period in seconds after blast' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cooldownPeriodSeconds?: number;

  @ApiPropertyOptional({ description: 'Maximum retry attempts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Fixed blast duration in ms (0 = dynamic)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedBlastDurationMs?: number;

  @ApiPropertyOptional({ description: 'Minimum compressor pressure in PSI' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPressurePsi?: number;
}
