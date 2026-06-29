import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telemetry, Alert, Incident, BlastOutcome } from '../schemas';

async function migrate() {
  console.log('--- Starting MongoDB Index Synchronization ---');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const telemetryModel = app.get<Model<any>>(getModelToken(Telemetry.name));
    const alertModel = app.get<Model<any>>(getModelToken(Alert.name));
    const incidentModel = app.get<Model<any>>(getModelToken(Incident.name));
    const blastOutcomeModel = app.get<Model<any>>(
      getModelToken(BlastOutcome.name),
    );

    console.log('Syncing Telemetry indexes...');
    await telemetryModel.syncIndexes();
    console.log('Telemetry indexes synchronized.');

    console.log('Syncing Alert indexes...');
    await alertModel.syncIndexes();
    console.log('Alert indexes synchronized.');

    console.log('Syncing Incident indexes...');
    await incidentModel.syncIndexes();
    console.log('Incident indexes synchronized.');

    console.log('Syncing BlastOutcome indexes...');
    await blastOutcomeModel.syncIndexes();
    console.log('BlastOutcome indexes synchronized.');

    console.log(
      '✓ All database compound indexes successfully verified and built.',
    );
  } catch (error) {
    console.error('✗ Database index migration failed:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

migrate();
