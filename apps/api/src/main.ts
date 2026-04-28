import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );

  const port = parseInt(process.env.PORT ?? '3000');
  await app.listen(port, '0.0.0.0');

  await runMigrations();
}

bootstrap();
