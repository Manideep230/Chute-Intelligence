import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MqttModule } from './mqtt/mqtt.module';
import { IndustryModule } from './industry/industry.module';
import { DatabaseModule } from './database/database.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './ai/ai.module';

const mongoUri =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nigha-chute';

@Module({
  imports: [
    MongooseModule.forRoot(mongoUri),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'otp',
        ttl: 60000,
        limit: 5,
      },
      {
        name: 'aiChat',
        ttl: 60000,
        limit: 20,
      },
      {
        name: 'blast',
        ttl: 60000,
        limit: 10,
      },
    ]),
    DatabaseModule,
    AuthModule,
    MqttModule,
    IndustryModule,
    IncidentsModule,
    ReportsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
