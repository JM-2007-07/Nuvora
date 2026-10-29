import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type CenterPermissions, DEFAULT_CENTER_PERMISSIONS } from '@nuvora/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { orgKeyOf } from './invitation-rules.js';

/**
 * Center permissions set by the admin (handoff §7), stored per center. No row means the
 * handoff defaults. Every center handler reads them here, so a change takes effect on
 * the next request: the server, not the UI, decides what a coordinator may open.
 */
@Injectable()
export class PermissionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(orgKey: string | null): Promise<{ permissions: CenterPermissions; updatedAt: Date | null }> {
    const row = orgKey ? await this.prisma.centerPermissions.findUnique({ where: { orgKey } }) : null;
    if (!row) return { permissions: { ...DEFAULT_CENTER_PERMISSIONS }, updatedAt: null };
    return {
      permissions: { coordGroups: row.coordGroups, coordStaff: row.coordStaff, teachCreate: row.teachCreate, teachShare: row.teachShare },
      updatedAt: row.updatedAt,
    };
  }

  async set(staff: DemoStaff, permissions: CenterPermissions): Promise<{ permissions: CenterPermissions; updatedAt: Date }> {
    const orgKey = orgKeyOf(staff);
    if (staff.role !== 'ADMIN' || !orgKey) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the center admin can change permissions' });
    const row = await this.prisma.centerPermissions.upsert({
      where: { orgKey },
      create: { orgKey, ...permissions, updatedByKey: staff.slug },
      update: { ...permissions, updatedByKey: staff.slug },
    });
    return { permissions, updatedAt: row.updatedAt };
  }

  /** Admins may do everything; a coordinator only what the admin allowed. */
  async require(staff: DemoStaff, permission: 'coordGroups' | 'coordStaff'): Promise<void> {
    if (staff.role !== 'COORDINATOR') return;
    const { permissions } = await this.get(orgKeyOf(staff));
    if (!permissions[permission]) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The center admin has not given coordinators this permission' });
    }
  }
}
