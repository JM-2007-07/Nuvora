import { type DynamicModule, Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module.js';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';

@Module({})
export class AppModule {
  /** The validated environment is passed in, so tests can supply their own. */
  static forRoot(env: AppEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env), HealthModule, IdentityModule, CatalogModule, LessonsModule, QuizzesModule, ProgressModule],
    };
  }
}
