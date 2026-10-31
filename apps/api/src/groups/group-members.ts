import type { PrismaService } from '../prisma/prisma.service.js';
import { findGroup } from '../staff/demo-org.js';

/**
 * Learners of a group: key (demo slug or user id), user id (empty if a demo learner has no row)
 * and name. Code-defined demo groups use their roster; groups made in the app use their members.
 */
export async function groupMembers(prisma: PrismaService, groupCode: string): Promise<{ key: string; userId: string; name: string }[]> {
  const demo = findGroup(groupCode);
  if (demo) {
    const slugs = demo.roster ?? [];
    const users = await prisma.user.findMany({ where: { kind: 'DEMO', demoSlug: { in: slugs } }, select: { id: true, demoSlug: true, displayName: true } });
    const bySlug = new Map(users.map((u) => [u.demoSlug!, u]));
    return slugs.map((slug) => ({ key: slug, userId: bySlug.get(slug)?.id ?? '', name: bySlug.get(slug)?.displayName ?? slug }));
  }
  const group = await prisma.studyGroup.findUnique({ where: { joinCode: groupCode }, select: { members: { orderBy: { joinedAt: 'asc' }, select: { userId: true, user: { select: { displayName: true } } } } } });
  return (group?.members ?? []).map((m) => ({ key: m.userId, userId: m.userId, name: m.user.displayName }));
}
