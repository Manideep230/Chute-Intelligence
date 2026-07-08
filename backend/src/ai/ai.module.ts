import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiPredictionService } from './ai-prediction.service';
import { DecisionEngineService } from './decision-engine.service';
import { BlastService } from './blast.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AiService, AiPredictionService, DecisionEngineService, BlastService],
  controllers: [AiController],
  exports: [AiService, AiPredictionService, DecisionEngineService, BlastService],
})
export class AiModule {}
