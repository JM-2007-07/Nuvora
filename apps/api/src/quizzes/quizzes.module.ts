import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AttemptsController, MyAttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [QuizzesController, AttemptsController, MyAttemptsController],
  providers: [QuizzesService, AttemptsService],
})
export class QuizzesModule {}
