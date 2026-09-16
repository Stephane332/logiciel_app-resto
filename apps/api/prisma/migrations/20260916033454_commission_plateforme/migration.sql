-- CreateEnum
CREATE TYPE "CommissionSettlementStatus" AS ENUM ('OPEN', 'CLOSED', 'DECLARED', 'PAID');

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "commissionChannels" TEXT[] DEFAULT ARRAY['APP', 'QR_TABLE']::TEXT[],
ADD COLUMN     "commissionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commissionPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "commissionRateBps" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "commission_entries" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "base" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversalNote" TEXT,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settlements" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CommissionSettlementStatus" NOT NULL DEFAULT 'OPEN',
    "declaredReference" TEXT,
    "declaredAt" TIMESTAMP(3),
    "attestedAt" TIMESTAMP(3),
    "attestNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commission_entries_orderId_key" ON "commission_entries"("orderId");

-- CreateIndex
CREATE INDEX "commission_entries_restaurantId_periodKey_idx" ON "commission_entries"("restaurantId", "periodKey");

-- CreateIndex
CREATE INDEX "commission_entries_restaurantId_settlementId_idx" ON "commission_entries"("restaurantId", "settlementId");

-- CreateIndex
CREATE INDEX "commission_settlements_restaurantId_status_idx" ON "commission_settlements"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "commission_settlements_restaurantId_periodKey_key" ON "commission_settlements"("restaurantId", "periodKey");

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "commission_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
