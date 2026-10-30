import { Prisma } from '@prisma/client';

/** Round a KES or USD amount to two decimal places for storage. */
export const money = (n: number) => new Prisma.Decimal(n).toDecimalPlaces(2);
