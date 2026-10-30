import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

/** Password accounts, plans and the demo checkout (IdentityService is global). */
@Module({
  imports: [PrismaModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
