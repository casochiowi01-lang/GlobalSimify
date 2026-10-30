import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/config.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap() {
  // rawBody: true exposes req.rawBody (a Buffer) so we can verify Paystack
  // webhook signatures over the exact bytes Paystack signed.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  // Cloud Run sits behind one Google front end: trust exactly one hop so
  // req.ip (and therefore rate limiting) reflects the real client.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // All routes live under /api/v1.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GlobalSimify eSIM API')
      .setDescription('Backend API for the GlobalSimify eSIM platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`API listening on ${config.get('API_BASE_URL')} (port ${port})`);
  logger.log(`Health:  GET /api/v1/health/ready`);
  if (!config.isProduction) logger.log(`Swagger: GET /docs`);
}

void bootstrap();
