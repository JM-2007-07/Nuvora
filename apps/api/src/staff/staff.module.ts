import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller.js';

/** Demo staff sessions (teacher, coordinator, admin). IdentityService (global) provides the signing key. */
@Module({ controllers: [StaffController] })
export class StaffModule {}
