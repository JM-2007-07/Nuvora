import { type DynamicModule, Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from './env.js';

/** Makes the validated environment injectable everywhere via APP_ENV. */
@Module({})
export class ConfigModule {
  static forRoot(env: AppEnv): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: APP_ENV, useValue: env }],
      exports: [APP_ENV],
    };
  }
}
