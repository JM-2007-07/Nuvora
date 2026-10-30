import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Invitation, InvitationLink, InviteRequest, PublicInvitation } from '@nuvora/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { expiryFrom, hashToken, invitationStatus, newToken, orgKeyOf, orgNameOf } from './invitation-rules.js';

const withAccepter = { acceptedAccount: { select: { name: true } } } as const;
type Row = {
  id: string;
  orgKey: string;
  orgName: string;
  name: string;
  email: string;
  subject: string;
  locale: 'tg' | 'ru' | 'en';
  invitedByName: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  revokedAt: Date | null;
  acceptedAccount?: { name: string } | null;
};

/**
 * Staff invitations. The center side (list, create, revoke, resend) is scoped to the
 * admin's own center; someone else's invitation id answers 404. The invitee side works
 * with the link token only, which is looked up by its SHA-256.
 */
@Injectable()
export class InvitationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Overridable in tests. */
  now = () => new Date();

  async list(staff: DemoStaff): Promise<Invitation[]> {
    const orgKey = orgKeyOf(staff);
    if (!orgKey) return [];
    const rows = await this.prisma.staffInvitation.findMany({ where: { orgKey }, include: withAccepter, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.view(r));
  }

  async create(staff: DemoStaff, request: { name: string; email: string; subject: string; locale: InviteRequest['locale'] }): Promise<InvitationLink> {
    const orgKey = this.adminCenter(staff);
    const open = await this.prisma.staffInvitation.findFirst({
      where: { orgKey, email: request.email, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: this.now() } },
      select: { id: true },
    });
    if (open) throw new ConflictException({ code: 'INVITATION_EXISTS', message: 'This email already has an open invitation. Resend it instead.' });
    const { token, tokenHash } = newToken();
    const row = await this.prisma.staffInvitation.create({
      data: {
        orgKey,
        orgName: orgNameOf(staff),
        tokenHash,
        name: request.name,
        email: request.email,
        role: 'TEACHER',
        subject: request.subject,
        locale: request.locale,
        invitedByKey: staff.slug,
        invitedByName: staff.name,
        expiresAt: expiryFrom(this.now()),
      },
      include: withAccepter,
    });
    return { invitation: this.view(row), token };
  }

  async revoke(staff: DemoStaff, id: string): Promise<Invitation> {
    const row = await this.own(staff, id);
    const status = invitationStatus(row, this.now());
    if (status !== 'pending' && status !== 'expired') throw new ConflictException({ code: `INVITATION_${status.toUpperCase()}`, message: `A ${status} invitation cannot be revoked` });
    return this.view(await this.prisma.staffInvitation.update({ where: { id }, data: { revokedAt: this.now() }, include: withAccepter }));
  }

  /** A new link (the old one stops working) and a fresh expiry. */
  async resend(staff: DemoStaff, id: string): Promise<InvitationLink> {
    const row = await this.own(staff, id);
    const status = invitationStatus(row, this.now());
    if (status === 'accepted' || status === 'revoked') throw new ConflictException({ code: `INVITATION_${status.toUpperCase()}`, message: `A ${status} invitation cannot be resent` });
    const { token, tokenHash } = newToken();
    const updated = await this.prisma.staffInvitation.update({
      where: { id },
      data: { tokenHash, expiresAt: expiryFrom(this.now()), declinedAt: null },
      include: withAccepter,
    });
    return { invitation: this.view(updated), token };
  }

  // ---------- invitee (link token) ----------

  async publicView(token: string): Promise<PublicInvitation> {
    const row = await this.byToken(token);
    return {
      organization: row.orgName,
      name: row.name,
      role: 'TEACHER',
      subject: row.subject,
      locale: row.locale,
      invitedByName: row.invitedByName,
      expiresAt: row.expiresAt.toISOString(),
      status: invitationStatus(row, this.now()),
    };
  }

  async decline(token: string): Promise<PublicInvitation> {
    const row = await this.byToken(token);
    this.requirePending(row);
    const done = await this.prisma.staffInvitation.updateMany({
      where: { id: row.id, acceptedAt: null, declinedAt: null, revokedAt: null },
      data: { declinedAt: this.now() },
    });
    if (!done.count) throw new ConflictException({ code: 'INVITATION_CHANGED', message: 'The invitation changed meanwhile. Reload the page.' });
    return this.publicView(token);
  }

  /** A signed-in teacher account whose email matches accepts it. */
  async accept(staff: DemoStaff, token: string): Promise<PublicInvitation> {
    const row = await this.byToken(token);
    this.requirePending(row);
    if (!staff.accountId) throw new ForbiddenException({ code: 'ACCOUNT_REQUIRED', message: 'Sign in with a teacher account to accept' });
    const account = await this.prisma.account.findUnique({ where: { id: staff.accountId }, select: { email: true, role: true } });
    if (!account || account.role !== 'TEACHER') throw new ForbiddenException({ code: 'ACCOUNT_REQUIRED', message: 'Sign in with a teacher account to accept' });
    if (account.email !== row.email) throw new ForbiddenException({ code: 'EMAIL_MISMATCH', message: 'This invitation is for another email address' });
    // Conditional update: a concurrent revoke, decline or second accept leaves nothing to update.
    const done = await this.prisma.staffInvitation.updateMany({
      where: { id: row.id, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: this.now() } },
      data: { acceptedAt: this.now(), acceptedAccountId: staff.accountId },
    });
    if (!done.count) throw new ConflictException({ code: 'INVITATION_CHANGED', message: 'The invitation changed meanwhile. Reload the page.' });
    return this.publicView(token);
  }

  // ---------- helpers ----------

  private adminCenter(staff: DemoStaff): string {
    const orgKey = orgKeyOf(staff);
    if (staff.role !== 'ADMIN' || !orgKey) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the center admin can manage invitations' });
    return orgKey;
  }

  private async own(staff: DemoStaff, id: string) {
    const orgKey = this.adminCenter(staff);
    const row = await this.prisma.staffInvitation.findUnique({ where: { id }, include: withAccepter });
    if (!row || row.orgKey !== orgKey) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
    return row;
  }

  private async byToken(token: string) {
    const row = await this.prisma.staffInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'This invitation link is not valid' });
    return row;
  }

  private requirePending(row: Row) {
    const status = invitationStatus(row, this.now());
    if (status !== 'pending') throw new ConflictException({ code: `INVITATION_${status.toUpperCase()}`, message: `This invitation is ${status}` });
  }

  private view(r: Row): Invitation {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: 'TEACHER',
      subject: r.subject,
      locale: r.locale,
      status: invitationStatus(r, this.now()),
      invitedByName: r.invitedByName,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
      acceptedBy: r.acceptedAccount?.name ?? null,
    };
  }
}
