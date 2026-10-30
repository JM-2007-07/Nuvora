import { Inject, Module } from '@nestjs/common';
import { ConnectedSocket, MessageBody, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { EXAM_NAMESPACE } from '@nuvora/shared';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { IdentityService, type LearnerRecord } from '../identity/identity.service.js';
import { readCookie, SESSION_COOKIE } from '../identity/session-cookie.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { STAFF_COOKIE, staffFromCookie } from '../staff/staff.guard.js';
import { attemptRoom, ExamHub, watchRoom } from './exam-hub.js';
import { LearnerExamController, TeacherExamController } from './exam.controller.js';
import { ExamService } from './exam.service.js';

interface SocketData {
  learner?: LearnerRecord;
  staff?: DemoStaff;
  attempts: string[];
}
type ExamSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;
type Ack = { ok: boolean; error?: string };

const Join = z.strictObject({ attemptId: z.string().min(8).max(40) });
const Watch = z.strictObject({ assessmentId: z.string().min(8).max(40) });

/**
 * Socket.IO namespace /exam (same /realtime path as chat). Learners join their own attempt
 * (presence: connected / disconnected events for the teacher); teachers watch their own
 * assessments. Authentication: the session cookie (web) or `auth.token` (mobile).
 */
@WebSocketGateway({ namespace: EXAM_NAMESPACE })
export class ExamGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExamService) private readonly exams: ExamService,
    @Inject(ExamHub) private readonly hub: ExamHub,
  ) {}

  afterInit(namespace: Namespace): void {
    this.hub.attach(namespace);
  }

  private async identify(socket: ExamSocket): Promise<void> {
    if (socket.data.learner || socket.data.staff) return;
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
    const cookie = socket.handshake.headers.cookie;
    socket.data.attempts ??= [];
    socket.data.staff = (await staffFromCookie(this.identity, this.prisma, token ?? readCookie(cookie, STAFF_COOKIE))) ?? undefined;
    if (!socket.data.staff) socket.data.learner = (await this.identity.learnerFromCookie(token ?? readCookie(cookie, SESSION_COOKIE))) ?? undefined;
  }

  @SubscribeMessage('exam:join')
  async join(@ConnectedSocket() socket: ExamSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = Join.safeParse(body);
    if (!input.success) return { ok: false, error: 'BAD_REQUEST' };
    await this.identify(socket);
    const learner = socket.data.learner;
    if (!learner || !(await this.exams.ownsAttempt(learner, input.data.attemptId))) return { ok: false, error: 'NOT_FOUND' };
    if (socket.data.attempts.includes(input.data.attemptId)) return { ok: true };
    socket.data.attempts.push(input.data.attemptId);
    await socket.join(attemptRoom(input.data.attemptId));
    if (this.hub.connected(input.data.attemptId)) await this.exams.connection(input.data.attemptId, true);
    return { ok: true };
  }

  @SubscribeMessage('exam:watch')
  async watch(@ConnectedSocket() socket: ExamSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = Watch.safeParse(body);
    if (!input.success) return { ok: false, error: 'BAD_REQUEST' };
    await this.identify(socket);
    const staff = socket.data.staff;
    if (!staff || staff.role !== 'TEACHER' || !(await this.exams.canWatch(staff, input.data.assessmentId))) return { ok: false, error: 'NOT_FOUND' };
    await socket.join(watchRoom(input.data.assessmentId));
    return { ok: true };
  }

  async handleDisconnect(socket: ExamSocket): Promise<void> {
    for (const attemptId of socket.data.attempts ?? []) if (this.hub.disconnected(attemptId)) await this.exams.connection(attemptId, false);
  }
}

/** Exam mode: learners take teacher assessments; teachers watch and act live. */
@Module({
  imports: [PrismaModule],
  controllers: [LearnerExamController, TeacherExamController],
  providers: [ExamService, ExamHub, ExamGateway],
})
export class ExamModule {}
