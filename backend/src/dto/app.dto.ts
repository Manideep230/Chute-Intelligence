import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDefined } from 'class-validator';

export class MqttWebhookDto {
  @ApiProperty({
    description: 'The MQTT topic the message was published to',
    example: 'nigha/chute/6a38c55a7fcfb7085c8786fc/telemetry',
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
    description: 'The raw or parsed payload of the MQTT message',
    example: { sensor: 'radar', zone: 1, distance: 3.2 },
  })
  @IsDefined()
  payload: any;
}
