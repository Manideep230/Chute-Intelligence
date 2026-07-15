import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Shared Swagger/OpenAPI configuration used by both the local dev
 * entrypoint (main.ts) and the Vercel serverless entrypoint
 * (vercel-serverless.ts).
 *
 * Controlled by the `ENABLE_SWAGGER` environment variable:
 *   - 'true'  → Swagger UI is mounted (default in development)
 *   - 'false' → Swagger routes are not registered
 *
 * Endpoints exposed:
 *   - GET /api/docs       → Swagger UI
 *   - GET /api/docs-json  → Raw OpenAPI JSON spec
 */
export function setupSwagger(app: INestApplication): void {
  const enableSwagger = process.env.ENABLE_SWAGGER ?? 'true';

  if (enableSwagger !== 'true') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Nigha Radar Industrial AI API')
    .setDescription(
      'Enterprise Chute Blockage Detection & Predictive Maintenance Platform.\n\n' +
        '## Overview\n' +
        'This API powers the Nigha Radar industrial IoT platform for real-time chute monitoring, ' +
        'AI-driven predictive maintenance, and automated Smart Air Blaster (SAB) control.\n\n' +
        '## Authentication\n' +
        'All protected endpoints require a JWT Bearer token. Use the **Authorize** button above ' +
        'to enter your token obtained from `POST /auth/verify-otp`.\n\n' +
        '## MQTT Integration\n' +
        'Real-time telemetry (radar, temperature, humidity, compressor, alerts) flows through ' +
        'EMQX Cloud MQTT broker. This REST API handles configuration, RBAC, and historical data.',
    )
    .setVersion('1.0.0')
    .setContact(
      'NighaTech Engineering',
      'https://chute-intelligence.vercel.app',
      'support@nighatech.com',
    )
    .addServer('/_/backend', 'Production Vercel Serverless')
    .addServer('/', 'Local Development / Dev Proxy')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Enter the JWT token returned by POST /auth/verify-otp (WITHOUT the "Bearer " prefix).',
      },
      'JWT',
    )
    .addTag('Authentication', 'User registration, OTP login, session management, and role assignment')
    .addTag('Industrial Operations', 'Plants, chutes, radars, blasters, solenoids, compressors, telemetry, and fleet management')
    .addTag('Super Admin Operations', 'System-wide administration: user management, data reset, and diagnostics')
    .addTag('Incidents', 'Incident reporting, escalation, and resolution workflows')
    .addTag('Reports', 'PDF/CSV report generation for chute analytics')
    .addTag('AI Chute Intelligence', 'AI copilot chat and predictive analytics endpoints')
    .addTag('Hardware Control', 'Smart Air Blaster (SAB) commands, solenoid control, device registration, and autonomous configuration')
    .addTag('System', 'Health checks, MQTT webhook ingestion, and WebSocket connectivity')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Nigha Radar API Documentation',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
    ],
  });
}
