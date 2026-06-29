import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ResetDatabaseDto {
  @ApiPropertyOptional({
    description: 'Flag confirming the destructive database wipe',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  confirm?: boolean;

  @ApiProperty({
    description: 'Specific phrase required to confirm database reset',
    example: 'RESET',
  })
  @IsString()
  @IsNotEmpty()
  confirmPhrase: string;
}
