import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    description: 'Phone number in E.164 format or standard string format',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number of the user verifying the OTP',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: '6-digit OTP code received', example: '123456' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token if not provided via HTTP-only cookie',
    example: 'some-refresh-token',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token to revoke if not provided via HTTP-only cookie',
    example: 'some-refresh-token',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'Rajesh Kumar',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Phone number in standard format',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Role assigned to the user',
    example: 'Worker',
    enum: ['Super Admin', 'Admin', 'Manager', 'Worker'],
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({
    description: 'Primary plant ID assignment (deprecated/legacy)',
    example: '6a38c55a7fcfb7085c8786fc',
  })
  @IsString()
  @IsOptional()
  plantId?: string;

  @ApiPropertyOptional({
    description: 'List of plant IDs assigned to the user',
    example: ['6a38c55a7fcfb7085c8786fc'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedPlantIds?: string[];
}

export class RequestPhoneChangeDto {
  @ApiProperty({
    description: 'The new phone number to register',
    example: '+918765432109',
  })
  @IsString()
  @IsNotEmpty()
  newPhone: string;
}

export class VerifyPhoneChangeDto {
  @ApiProperty({
    description: 'OTP code sent to the old phone number',
    example: '111111',
  })
  @IsString()
  @IsNotEmpty()
  oldPhoneOtp: string;

  @ApiProperty({
    description: 'OTP code sent to the new phone number',
    example: '222222',
  })
  @IsString()
  @IsNotEmpty()
  newPhoneOtp: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Updated full name',
    example: 'Rajesh K.',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional profile picture URL or base64 string',
    example: 'https://example.com/pic.jpg',
  })
  @IsString()
  @IsOptional()
  profilePic?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'The new role to assign to the user',
    example: 'Manager',
    enum: ['Super Admin', 'Admin', 'Manager', 'Worker'],
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
