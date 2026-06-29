import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
