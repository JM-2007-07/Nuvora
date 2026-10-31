import type { PrismaService } from '../prisma/prisma.service.js';
import { groupMembers } from '../groups/group-members.js';
import { DEMO_CENTER_KEY } from '../invitations/invitation-rules.js';
import { DEMO_STAFF } from '../staff/demo-org.js';
import { staffAccountSubject, staffSubject } from '../staff/staff.guard.js';

/** Session subjects of a group's learners (demo learners without a database row are skipped). */
export async function groupLearnerSubjects(prisma: PrismaService, groupCode: string): Promise<string[]> {
  return (await groupMembers(prisma, groupCode)).map((m) => m.userId).filter(Boolean);
}

/** Session subject of the teacher who owns an assessment (ownerKey is the staff slug). */
export function ownerSubject(ownerKey: string): string {
  return staffSubject(ownerKey);
}

/** Session subjects of a center's admins: the demo center's admin and coordinator, or an organization's admin accounts. */
export async function centerAdminSubjects(prisma: PrismaService, orgKey: string): Promise<string[]> {
  if (orgKey === DEMO_CENTER_KEY) return DEMO_STAFF.filter((s) => s.role !== 'TEACHER').map((s) => staffSubject(s.slug));
  if (!orgKey.startsWith('org:')) return [];
  const admins = await prisma.account.findMany({ where: { organizationId: orgKey.slice(4), role: 'CENTER_ADMIN' }, select: { id: true } });
  return admins.map((a) => staffAccountSubject(a.id));
}
