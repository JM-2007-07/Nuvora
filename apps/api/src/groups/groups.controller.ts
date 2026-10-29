import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { type CreateGroupRequest, CreateGroupRequestSchema, JoinGroupRequestSchema, type Locale, type StudyGroupDetail, type StudyGroupView } from '@nuvora/shared';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { GroupsService } from './groups.service.js';

const IdSchema = z.string().regex(/^[a-z0-9]{10,40}$/, 'Not a group id');

/** Teacher accounts: their own groups, member by member. */
@Controller('teach/my-groups')
@UseGuards(StaffGuard)
@Roles('TEACHER')
@UseInterceptors(ContentLanguageInterceptor)
export class TeacherGroupsController {
  constructor(@Inject(GroupsService) private readonly groups: GroupsService) {}

  @Get()
  async list(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<{ items: StudyGroupView[] }> {
    return { items: await this.groups.teacherGroups(staff, locale) };
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateGroupRequestSchema)) body: CreateGroupRequest, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<StudyGroupView> {
    return this.groups.createForTeacher(staff, body, locale);
  }

  @Get(':id')
  detail(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<StudyGroupDetail> {
    return this.groups.teacherGroupDetail(staff, id, locale);
  }
}

/** Center admin accounts: the organization's groups as totals. */
@Controller('center/my-groups')
@UseGuards(StaffGuard)
@Roles('ADMIN')
@UseInterceptors(ContentLanguageInterceptor)
export class CenterGroupsController {
  constructor(@Inject(GroupsService) private readonly groups: GroupsService) {}

  @Get()
  async list(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<{ items: StudyGroupView[] }> {
    return { items: await this.groups.centerGroups(staff, locale) };
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateGroupRequestSchema)) body: CreateGroupRequest, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<StudyGroupView> {
    return this.groups.createForCenter(staff, body, locale);
  }
}

/** Learners: join a group with its code; list own memberships. */
@Controller('me/groups')
@UseGuards(LearnerGuard)
export class MyGroupsController {
  constructor(@Inject(GroupsService) private readonly groups: GroupsService) {}

  @Get()
  async list(@CurrentLearner() learner: LearnerRecord) {
    return { items: await this.groups.myGroups(learner) };
  }

  @Post('join')
  @HttpCode(200)
  async join(@Body(new ZodValidationPipe(JoinGroupRequestSchema)) body: { code: string }, @CurrentLearner() learner: LearnerRecord): Promise<{ joined: true }> {
    await this.groups.join(learner, body.code);
    return { joined: true };
  }
}
