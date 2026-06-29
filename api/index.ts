import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../backend/src/app.module';

let cachedServer: any;

const bootstrap = async () => {
  if (!cachedServer) {
    const server = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
    );
    app.enableCors();
    await app.init();
    cachedServer = server;
  }
  return cachedServer;
};

export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};
