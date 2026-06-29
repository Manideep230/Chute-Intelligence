import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { MqttService } from './mqtt/mqtt.service';
import { MqttWebhookDto } from './dto/app.dto';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mqttService: MqttService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Default root hello endpoint' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('mqtt-webhook')
  @ApiOperation({
    summary:
      'Handle incoming MQTT telemetry/events from EMQX webhook integration',
  })
  @ApiHeader({
    name: 'x-webhook-secret',
    required: false,
    description: 'Security secret to validate the webhook sender',
  })
  @ApiResponse({ status: 200, description: 'Message handled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook secret' })
  @ApiResponse({ status: 400, description: 'Missing topic or payload' })
  async handleMqttWebhook(
    @Body() body: MqttWebhookDto,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    const webhookSecret = process.env.MQTT_WEBHOOK_SECRET;
    if (webhookSecret && secretHeader !== webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const { topic, payload } = body;
    if (!topic || payload === undefined) {
      throw new BadRequestException('Missing topic or payload');
    }

    // In EMQX Webhook, the payload might be pre-parsed into an object, or be a raw JSON string
    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    await this.mqttService.handleIncomingMessage(topic, payloadStr);

    return { success: true };
  }
}
