import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffController } from './staff.controller.js';

/** Staff sessions (demo staff and staff accounts). IdentityService (global) provides the signing key. */
@Module({ imports: [PrismaModule], controllers: [StaffController] })
export class StaffModule {}
