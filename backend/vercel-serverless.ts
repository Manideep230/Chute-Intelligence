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

let appServer: any = null;
let bootstrapError: any = null;

const getAppServer = async () => {
  if (appServer) return appServer;
  if (bootstrapError) throw bootstrapError;

  try {
    appServer = await bootstrap();
    return appServer;
  } catch (err) {
    bootstrapError = err;
    throw err;
  }
};

export default async (req: any, res: any) => {
  try {
    const serverInstance = await getAppServer();
    return serverInstance(req, res);
  } catch (err: any) {
    console.error('NestJS Bootstrap Error:', err);
    res.status(500).json({
      error: 'NestJS Bootstrap Error',
      message: err.message,
      stack: err.stack,
    });
  }
};
