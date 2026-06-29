import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GpsCoordinatesDto {
  @ApiProperty({ description: 'Latitude coordinate value', example: 17.6868 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude coordinate value', example: 83.2185 })
  @IsNumber()
  lng: number;
}

export class CreatePlantDto {
  @ApiProperty({
    description: 'Name of the plant',
    example: 'Vizag Steel Plant',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique plant code', example: 'PL-VIZ-001' })
  @IsString()
  @IsNotEmpty()
  plantCode: string;

  @ApiProperty({
    description: 'Prefix code for building serial/IDs',
    example: 'VSP',
  })
  @IsString()
  @IsNotEmpty()
  ngPrefix: string;

  @ApiPropertyOptional({
    description: 'Physical location of the plant',
    example: 'Visakhapatnam, Andhra Pradesh',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates of the plant',
    type: GpsCoordinatesDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsOptional()
  gpsCoordinates?: GpsCoordinatesDto;

  @ApiPropertyOptional({
    description: 'Brief description of the plant',
    example: 'Primary production line and material chutes',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Region ObjectId referencing a Region document',
    example: '6a38c55a7fcfb7085c8786fc',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ObjectId referencing an Organization document',
    example: '6a38c55a7fcfb7085c8786fa',
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Type of industry',
    example: 'Mining',
    default: 'Mining',
  })
  @IsString()
  @IsOptional()
  industryType?: string;

  @ApiPropertyOptional({
    description: 'Name of the plant owner',
    example: 'VSP Corporate',
  })
  @IsString()
  @IsOptional()
  ownerName?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the plant office',
    example: '+918912518200',
  })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiPropertyOptional({
    description: 'Contact email of the plant office',
    example: 'contact@vizagsteel.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Postal address of the plant',
    example: 'Visakhapatnam Steel Project, Visakhapatnam, 530031',
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdatePlantDto {
  @ApiPropertyOptional({
    description: 'Name of the plant',
    example: 'Vizag Steel Plant',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Unique plant code',
    example: 'PL-VIZ-001',
  })
  @IsString()
  @IsOptional()
  plantCode?: string;

  @ApiPropertyOptional({
    description: 'Prefix code for building serial/IDs',
    example: 'VSP',
  })
  @IsString()
  @IsOptional()
  ngPrefix?: string;

  @ApiPropertyOptional({
    description: 'Physical location of the plant',
    example: 'Visakhapatnam, Andhra Pradesh',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates of the plant',
    type: GpsCoordinatesDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsOptional()
  gpsCoordinates?: GpsCoordinatesDto;

  @ApiPropertyOptional({
    description: 'Brief description of the plant',
    example: 'Primary production line and material chutes',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Region ObjectId referencing a Region document',
    example: '6a38c55a7fcfb7085c8786fc',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ObjectId referencing an Organization document',
    example: '6a38c55a7fcfb7085c8786fa',
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Type of industry', example: 'Mining' })
  @IsString()
  @IsOptional()
  industryType?: string;

  @ApiPropertyOptional({
    description: 'Name of the plant owner',
    example: 'VSP Corporate',
  })
  @IsString()
  @IsOptional()
  ownerName?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the plant office',
    example: '+918912518200',
  })
  @IsString()
  @IsOptional()
  contactNumber?: string;

  @ApiPropertyOptional({
    description: 'Contact email of the plant office',
    example: 'contact@vizagsteel.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Postal address of the plant',
    example: 'Visakhapatnam Steel Project, Visakhapatnam, 530031',
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class CreateChuteDto {
  @ApiProperty({
    description: 'Name of the chute',
    example: 'Chute #4 Raw Ore Feed',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Plant ID that this chute belongs to',
    example: '6a38c55a7fcfb7085c8786fc',
  })
  @IsString()
  @IsNotEmpty()
  plantId: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates of the chute',
    type: GpsCoordinatesDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsOptional()
  gpsCoordinates?: GpsCoordinatesDto;

  @ApiPropertyOptional({
    description:
      'Type of material handled in the chute, controlling AI thresholds',
    example: 'iron_ore',
    enum: ['coal', 'iron_ore', 'limestone', 'grain', 'generic'],
    default: 'generic',
  })
  @IsString()
  @IsOptional()
  materialType?: string;

  @ApiPropertyOptional({
    description: 'Unique Chute Code identifier',
    example: 'CHUTE-VSP-004',
  })
  @IsString()
  @IsOptional()
  chuteCode?: string;

  @ApiPropertyOptional({
    description: 'Active default material path inside chute',
    example: 'LEFT_SLANT',
    enum: ['LEFT_SLANT', 'RIGHT_SLANT'],
    default: 'LEFT_SLANT',
  })
  @IsString()
  @IsOptional()
  activePath?: string;
}

export class UpdateChuteDto {
  @ApiPropertyOptional({
    description: 'Name of the chute',
    example: 'Chute #4 Raw Ore Feed',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates of the chute',
    type: GpsCoordinatesDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => GpsCoordinatesDto)
  @IsOptional()
  gpsCoordinates?: GpsCoordinatesDto;

  @ApiPropertyOptional({
    description: 'Operational status of the chute',
    example: 'Normal',
    enum: ['Normal', 'Buildup', 'Blocked', 'Blasting'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Type of material handled in the chute, controlling AI thresholds',
    example: 'iron_ore',
    enum: ['coal', 'iron_ore', 'limestone', 'grain', 'generic'],
  })
  @IsString()
  @IsOptional()
  materialType?: string;

  @ApiPropertyOptional({
    description: 'Active material path inside chute',
    example: 'LEFT_SLANT',
    enum: ['LEFT_SLANT', 'RIGHT_SLANT'],
  })
  @IsString()
  @IsOptional()
  activePath?: string;

  @ApiPropertyOptional({
    description: 'AI or physics detected blockage position description',
    example: 'Zone 2 Bottom Right',
  })
  @IsString()
  @IsOptional()
  blockagePosition?: string;

  @ApiPropertyOptional({
    description: 'Distance to the blockage in meters',
    example: 2.8,
  })
  @IsNumber()
  @IsOptional()
  blockageDistance?: number;

  @ApiPropertyOptional({
    description: 'Solenoid group closest to the blockage position',
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  nearestSolenoidGroup?: number;
}

export class TriggerManualBlastDto {
  @ApiPropertyOptional({
    description: 'Number of the air blaster to activate (1-4)',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  blasterNumber?: number;

  @ApiPropertyOptional({
    description: 'Number of the solenoid valve to activate (1-8)',
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  valveNumber?: number;
}

export class SetSimulationModeDto {
  @ApiProperty({
    description: 'Enable or disable simulation mode',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Simulate active material flow path',
    example: 'RIGHT_SLANT',
    enum: ['LEFT_SLANT', 'RIGHT_SLANT'],
  })
  @IsString()
  @IsOptional()
  activePath?: 'LEFT_SLANT' | 'RIGHT_SLANT';

  @ApiPropertyOptional({
    description: 'Simulate blockage position',
    example: 'Zone 1 Left',
  })
  @IsString()
  @IsOptional()
  blockagePosition?: string;

  @ApiPropertyOptional({
    description: 'Simulate blockage distance in meters',
    example: 1.5,
  })
  @IsNumber()
  @IsOptional()
  blockageDistance?: number;

  @ApiPropertyOptional({
    description: 'Simulate closest solenoid group',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  nearestSolenoidGroup?: number;

  @ApiPropertyOptional({
    description: 'Inject high sensor reading to specific radar zone',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  injectRadarZone?: number;
}

export class CreateMaintenanceTicketDto {
  @ApiProperty({
    description: 'Chute ObjectId referencing the target chute',
    example: '6a38c55a7fcfb7085c8786fd',
  })
  @IsString()
  @IsNotEmpty()
  chuteId: string;

  @ApiProperty({
    description: 'Type of asset needing service',
    example: 'AirBlaster',
    enum: ['AirBlaster', 'Solenoid', 'Compressor', 'Sensor'],
  })
  @IsString()
  @IsNotEmpty()
  assetType: string;

  @ApiProperty({
    description:
      'ObjectId of the specific hardware component (AirBlaster/Solenoid/etc.)',
    example: '6a38c55a7fcfb7085c8786fe',
  })
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description:
      'Detailed description of the maintenance issue or work required',
    example: 'Solenoid valve 3 leaks air during recharge cycle.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'User ObjectId of the assigned Worker',
    example: '6a38c55a7fcfb7085c8786fb',
  })
  @IsString()
  @IsOptional()
  assignedTo?: string;
}

export class AddServiceHistoryDto {
  @ApiProperty({
    description: 'Action performed on the asset',
    example: 'Replaced solenoid valve gasket seal',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({
    description: 'Detailed technician service notes',
    example: 'O-ring was deteriorated. Replaced and tested leak-free.',
  })
  @IsString()
  @IsNotEmpty()
  notes: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({
    description: 'Updated status of the ticket',
    example: 'Resolved',
    enum: ['Open', 'In Progress', 'Resolved'],
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Target URL to receive POST event webhooks',
    example: 'https://api.enterprise.com/hooks/nigha',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'List of events to subscribe to',
    example: ['ALERT_CRITICAL', 'BLAST_FAILED'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({
    description: 'Signing secret key to verify webhook signature header',
    example: 'whsec_secret123',
  })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiPropertyOptional({
    description: 'Webhook active status',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SaveOpcUaConfigDto {
  @ApiProperty({
    description: 'OPC-UA server TCP endpoint URL',
    example: 'opc.tcp://10.0.1.50:4840',
  })
  @IsString()
  @IsNotEmpty()
  endpointUrl: string;

  @ApiPropertyOptional({
    description: 'OPC-UA security mode',
    example: 'SignAndEncrypt',
    default: 'None',
  })
  @IsString()
  @IsOptional()
  securityMode?: string;

  @ApiPropertyOptional({
    description: 'OPC-UA security policy',
    example: 'Basic256Sha256',
    default: 'None',
  })
  @IsString()
  @IsOptional()
  securityPolicy?: string;

  @ApiPropertyOptional({
    description: 'Username for basic authentication',
    example: 'plc_operator',
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    description: 'Password for basic authentication',
    example: 'secure_plc_pass',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    description:
      'Dynamic node mappings between PLC registers and hardware entities',
    example: {
      solenoids: {
        valve1: 'ns=2;s=Solenoid1_Active',
        valve2: 'ns=2;s=Solenoid2_Active',
      },
      compressor: { pressure: 'ns=2;s=Compressor_PSI' },
    },
  })
  @IsObject()
  @IsNotEmpty()
  nodeMappings: any;
}

export class CreateAssignmentDto {
  @ApiProperty({
    description: 'User ID of the technician/manager being assigned',
    example: '6a38c55a7fcfb7085c8786fb',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Plant ID assigned to the user',
    example: '6a38c55a7fcfb7085c8786fc',
  })
  @IsString()
  @IsOptional()
  plantId?: string;

  @ApiPropertyOptional({
    description: 'Chute ID assigned to the user',
    example: '6a38c55a7fcfb7085c8786fd',
  })
  @IsString()
  @IsOptional()
  chuteId?: string;
}

export class SaveCalibrationDto {
  @ApiProperty({
    description: 'Radar zone number being calibrated (1-4)',
    example: 1,
  })
  @IsNumber()
  zone: number;

  @ApiProperty({
    description: 'Baseline clean distance in meters',
    example: 3.5,
  })
  @IsNumber()
  baselineDistance: number;

  @ApiProperty({
    description: 'Currently measured distance in meters',
    example: 3.48,
  })
  @IsNumber()
  measuredDistance: number;

  @ApiProperty({
    description: 'Calibration method',
    example: 'Manual',
    enum: ['Auto', 'Manual'],
  })
  @IsString()
  @IsEnum(['Auto', 'Manual'])
  calibrationMode: 'Auto' | 'Manual';

  @ApiPropertyOptional({
    description: 'Operator notes regarding calibration conditions',
    example: 'Calibrated after manually cleaning buildup in Zone 1.',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClaimDeviceDto {
  @ApiProperty({
    description:
      'Physical hardware device ID/serial code scanned from QR label',
    example: 'HW-HUB-99120A',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
