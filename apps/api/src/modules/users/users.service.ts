import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface UpdateProfile {
  name?: string;
  locale?: string;
}

export type AdminRole = 'CUSTOMER' | 'PARTNER' | 'ADMIN';
export type AdminStatus = 'ACTIVE' | 'BLOCKED';

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: user.locale,
    };
  }

  async updateProfile(userId: string, data: UpdateProfile) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
      },
    });
    return this.getProfile(user.id);
  }

  // --- admin-facing user management ---------------------------------------

  /** List / search users (by email, name or phone) for the admin panel. */
  async listForAdmin(search?: string, take = 50) {
    const q = search?.trim();
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
          ],
        }
      : {};
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        ...ADMIN_SELECT,
        _count: { select: { orders: true, esims: true } },
      },
    });
    return rows.map(({ _count, ...u }) => ({
      ...u,
      orders: _count.orders,
      esims: _count.esims,
    }));
  }

  /** Admin-create a customer or another admin, keyed by email. */
  async adminCreate(input: {
    email: string;
    name?: string;
    phone?: string;
    role?: AdminRole;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new BadRequestException('A user with that email already exists.');
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          phone: input.phone?.trim() || null,
          role: input.role ?? 'CUSTOMER',
        },
        select: ADMIN_SELECT,
      });
      return user;
    } catch {
      throw new BadRequestException(
        'Could not create user (email or phone may be in use).',
      );
    }
  }

  /** Admin-update a user's role and/or account status. */
  async adminUpdate(
    id: string,
    data: { role?: AdminRole; status?: AdminStatus },
  ) {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found.');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
      select: ADMIN_SELECT,
    });
  }
}
