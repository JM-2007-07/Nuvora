import type { PrismaClient } from '../generated/prisma/client.js';

export type BootstrapMode = 'grant' | 'replace' | 'revoke';
export type BootstrapResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'no-account' | 'another-admin'; message: string };

/**
 * Grants or removes Super Admin for an existing account. Used only by the server-side
 * `pnpm admin:bootstrap` command; no HTTP route calls it. One Super Admin at a time
 * (the platform owner) unless `replace` moves the role. Every change is audited.
 */
export async function bootstrapSuperAdmin(prisma: PrismaClient, email: string, mode: BootstrapMode): Promise<BootstrapResult> {
  const account = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true, totpEnabledAt: true } });
  if (!account) return { ok: false, reason: 'no-account', message: 'No account with that email. Register it first, then run this again.' };
  if (mode === 'revoke') {
    await prisma.$transaction([
      prisma.account.update({ where: { id: account.id }, data: { platformRole: null } }),
      prisma.auditEvent.create({ data: { actorKey: 'cli:admin-bootstrap', action: 'admin.bootstrap.revoke', targetType: 'account', targetId: account.id } }),
    ]);
    return { ok: true, message: `Super Admin removed from ${account.name}.` };
  }
  const others = await prisma.account.findMany({ where: { platformRole: 'SUPER_ADMIN', id: { not: account.id } }, select: { id: true } });
  if (others.length && mode !== 'replace') return { ok: false, reason: 'another-admin', message: 'Another account already has Super Admin. Run with --replace to move it to this account.' };
  await prisma.$transaction([
    prisma.account.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { platformRole: null } }),
    prisma.account.update({ where: { id: account.id }, data: { platformRole: 'SUPER_ADMIN' } }),
    prisma.auditEvent.create({ data: { actorKey: 'cli:admin-bootstrap', action: 'admin.bootstrap.grant', targetType: 'account', targetId: account.id, meta: { replaced: others.length } } }),
  ]);
  return { ok: true, message: `Super Admin granted to ${account.name}.${account.totpEnabledAt ? '' : ' Turn on two-factor sign-in in Settings → Security.'}` };
}
