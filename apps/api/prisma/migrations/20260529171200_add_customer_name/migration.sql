-- AlterTable: store the buyer's full name captured at checkout.
-- IF NOT EXISTS keeps this safe on databases that already have the column.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
