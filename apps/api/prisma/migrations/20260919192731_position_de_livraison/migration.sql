-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryAccuracy" DOUBLE PRECISION,
ADD COLUMN     "deliveryLatitude" DOUBLE PRECISION,
ADD COLUMN     "deliveryLongitude" DOUBLE PRECISION;
