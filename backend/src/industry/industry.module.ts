import { Module } from '@nestjs/common';
import { IndustryService } from './industry.service';
import { IndustryController } from './industry.controller';
import { DatabaseModule } from '../database/database.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { AlertEscalationService } from '../alerts/alert-escalation.service';
import { CacheService } from '../common/services/cache.service';

@Module({
  imports: [DatabaseModule, MqttModule],
  providers: [IndustryService, AlertEscalationService, CacheService],
  controllers: [IndustryController],
  exports: [IndustryService, AlertEscalationService, CacheService],
})
export class IndustryModule {}
