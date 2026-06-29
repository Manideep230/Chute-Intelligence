import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './src/app.module';

const server = express();

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();
  return server;
};

const bootstrapPromise = bootstrap();

export default async (req: any, res: any) => {
  const appServer = await bootstrapPromise;
  return appServer(req, res);
};
