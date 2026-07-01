import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './src/app.module';
import { setupSwagger } from './src/swagger.config';

// Use require statement inside function context to bypass top-level ESM conflicts
const getExpressApp = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  return express();
};

const server = getExpressApp();

const bootstrap = async () => {
  console.log(`[BOOTSTRAP_START] [${new Date().toISOString()}] Starting NestJS Bootstrap...`);
  const startTime = Date.now();
  
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  console.log(`[NEST_FACTORY_CREATE_COMPLETED] [${new Date().toISOString()}] NestFactory created app in ${Date.now() - startTime}ms.`);
  
  app.enableCors();

  // Global Validation Pipe (match main.ts behaviour)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger Documentation (controlled by ENABLE_SWAGGER env var)
  setupSwagger(app);

  await app.init();
  console.log(`[BOOTSTRAP_SUCCESS] [${new Date().toISOString()}] NestJS successfully initialized in ${Date.now() - startTime}ms.`);
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
    console.error(`[BOOTSTRAP_FAILED] [${new Date().toISOString()}] NestJS Bootstrap failed:`, err);
    throw err;
  }
};

export default async (req: any, res: any) => {
  console.log(`[REQUEST_RECEIVED] [${new Date().toISOString()}] Invoking request-handler: Path=${req.url}`);
  try {
    const serverInstance = await getAppServer();
    return serverInstance(req, res);
  } catch (err: any) {
    console.error(`[HANDLER_CRASH] [${new Date().toISOString()}] NestJS handler crash:`, err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'NestJS Bootstrap Error',
      message: err.message,
      stack: err.stack,
    }));
  }
};
