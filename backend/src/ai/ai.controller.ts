import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MultiTenantGuard } from '../auth/multi-tenant.guard';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai.dto';

@ApiTags('AI Chute Intelligence')
@Controller('ai')
@UseGuards(JwtAuthGuard, MultiTenantGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Throttle({ aiChat: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Submit a message to the AI Copilot with live telemetry context (streams response)',
  })
  @ApiResponse({
    status: 200,
    description: 'Message accepted, returns a text/event-stream SSE connection of chat response tokens.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request — Invalid payload or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized — Missing or invalid access token' })
  async chat(@Body() body: AiChatDto, @Res() res: Response) {
    const history = body.history || [];

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for proxy environments

    try {
      await this.aiService.generateChatResponseStream(
        body.chuteId,
        body.message,
        history,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
        },
      );
    } catch (err: any) {
      res.write(
        `data: ${JSON.stringify({ error: err.message || 'Error occurred during generation' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('predictions/:chuteId')
  @ApiOperation({
    summary:
      'Retrieve component Remaining Useful Lives (RUL) and health risk analysis',
  })
  @ApiResponse({
    status: 200,
    description: 'Calculated remaining useful lives and risk analytics retrieved.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Chute not found' })
  async getPredictions(@Param('chuteId') chuteId: string) {
    return this.aiService.getComponentPredictions(chuteId);
  }
}
