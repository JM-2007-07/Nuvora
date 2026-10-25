import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';

@Module({})
export class AppModule {
  /** The validated environment is passed in, so tests can supply their own. */
  static forRoot(env: AppEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env), HealthModule],
    };
  }
}
