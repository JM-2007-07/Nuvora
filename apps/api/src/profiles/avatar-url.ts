import { API_PREFIX } from '@nuvora/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Photo URL with a version (?v=updatedAt), so browsers cache it until the photo changes. */
export const avatarUrl = (key: string, updatedAt: Date) => `/${API_PREFIX}/profiles/avatar/${encodeURIComponent(key)}?v=${updatedAt.getTime()}`.replace('//', '/');

/** Photo URLs for many people at once (no Nest wiring, so the comms module can use it too). People without a photo are absent. */
export async function avatarUrls(prisma: PrismaService, keys: string[]): Promise<Map<string, string>> {
  if (!keys.length) return new Map();
  const rows = await prisma.profileAvatar.findMany({ where: { participantKey: { in: [...new Set(keys)] } }, select: { participantKey: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.participantKey, avatarUrl(r.participantKey, r.updatedAt)]));
}
