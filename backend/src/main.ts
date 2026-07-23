import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Try loading from current directory first, then parent directory (root of workspace)
const localEnvPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '../.env');
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : parentEnvPath;
dotenv.config({ path: envPath });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SanitizationInterceptor } from './common/interceptors/sanitization.interceptor';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parsing
  app.use(cookieParser());

  // Rewrite /_/backend prefix so direct requests to NestJS server match controllers
  app.use((req: any, _res: any, next: any) => {
    if (req.url && req.url.startsWith('/_/backend')) {
      req.url = req.url.replace(/^\/_\/backend/, '') || '/';
    }
    next();
  });

  // Register global input sanitization interceptor
  app.useGlobalInterceptors(new SanitizationInterceptor());

  // Enable CORS with environment-based whitelist
  const corsWhitelist = process.env.CORS_WHITELIST
    ? process.env.CORS_WHITELIST.split(',')
    : [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:5000',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5000',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        process.env.NODE_ENV !== 'production' ||
        corsWhitelist.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger Documentation (controlled by ENABLE_SWAGGER env var)
  setupSwagger(app);

  const port = process.env.PORT || 5000; // backend runs on 5000
  await app.listen(port);
  console.log(`Backend server successfully running on port ${port}`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}
bootstrap();

