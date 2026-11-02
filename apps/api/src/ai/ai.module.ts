import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { ExamModule } from '../exam/exam.gateway.js';
import { IdentityModule } from '../identity/identity.module.js';
import { LessonsModule } from '../lessons/lessons.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { AiJobsService } from './ai-jobs.service.js';
import { AiModel, GeminiModel, MockAiModel } from './ai-model.js';
import { LearnerAiController, TeacherAiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { TeacherLessonsService } from './teacher-lessons.service.js';

/** The AI assistant (D-32). */
@Module({
  imports: [PrismaModule, IdentityModule, AssessmentsModule, ExamModule, LessonsModule, QuizzesModule],
  controllers: [LearnerAiController, TeacherAiController],
  providers: [
    AiService,
    AiJobsService,
    TeacherLessonsService,
    StaffGuard,
    { provide: AiModel, inject: [APP_ENV], useFactory: (env: AppEnv) => (env.AI_PROVIDER === 'mock' ? new MockAiModel() : new GeminiModel(env.GEMINI_API_KEY)) },
  ],
})
export class AiModule {}
