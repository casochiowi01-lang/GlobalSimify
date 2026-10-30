-- Supplier migration: eSIM Go -> Celitech.
-- Renames preserve existing data; destinationIso is added with a backfill.

-- orders: rename provider package ref, add destination ISO
ALTER TABLE "orders" RENAME COLUMN "esimgoBundle" TO "providerPackageId";
ALTER TABLE "orders" ADD COLUMN "destinationIso" TEXT;
UPDATE "orders"
  SET "destinationIso" = split_part(
    "providerPackageId", '_',
    GREATEST(array_length(string_to_array("providerPackageId", '_'), 1) - 1, 1)
  )
  WHERE "destinationIso" IS NULL;
UPDATE "orders" SET "destinationIso" = 'XX'
  WHERE "destinationIso" IS NULL OR "destinationIso" = '';
ALTER TABLE "orders" ALTER COLUMN "destinationIso" SET NOT NULL;

-- esims: rename provider purchase ref (used for consumption polling)
ALTER TABLE "esims" RENAME COLUMN "esimgoOrderRef" TO "providerPurchaseId";
