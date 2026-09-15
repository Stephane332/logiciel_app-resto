-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'DECLARED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "attestNote" TEXT,
ADD COLUMN     "attestedAt" TIMESTAMP(3),
ADD COLUMN     "attestedById" TEXT,
ADD COLUMN     "declaredAt" TIMESTAMP(3),
ADD COLUMN     "declaredReference" TEXT;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "moovMoneyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moovMoneyNumber" TEXT,
ADD COLUMN     "moovMoneyUssd" TEXT NOT NULL DEFAULT '*555*4*1*{NUM}*{MONTANT}#',
ADD COLUMN     "orangeMoneyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orangeMoneyNumber" TEXT,
ADD COLUMN     "orangeMoneyUssd" TEXT NOT NULL DEFAULT '*144*10*{NUM}*{MONTANT}#',
ADD COLUMN     "whatsappOrderNumber" TEXT;

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_attestedById_fkey" FOREIGN KEY ("attestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
