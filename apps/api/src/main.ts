import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadDotEnvFile, loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  loadDotEnvFile();
  const env = loadEnv();
  const app = await NestFactory.create(AppModule.forRoot(env));
  configureApp(app, env);
  await app.listen(env.API_PORT);
  Logger.log(`API listening on http://localhost:${env.API_PORT}`, 'Bootstrap');
}

await bootstrap();
