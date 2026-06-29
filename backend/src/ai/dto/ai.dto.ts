import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryItemDto {
  @ApiProperty({
    description: 'The role of the messenger (user or model)',
    example: 'user',
    enum: ['user', 'model'],
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'The message text content',
    example: 'What is the health score of the air blasters?',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AiChatDto {
  @ApiProperty({
    description: 'Chute ID associated with the live telemetry context',
    example: '6a38c55a7fcfb7085c8786fd',
  })
  @IsString()
  @IsNotEmpty()
  chuteId: string;

  @ApiProperty({
    description: 'The message sent by the user to the AI Copilot',
    example: 'Is there any blockage buildup risk?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Conversation history of previous messages',
    type: [ChatHistoryItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  @IsOptional()
  history?: ChatHistoryItemDto[];
}
