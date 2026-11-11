-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CUSTOMER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "type" "AccountType" NOT NULL DEFAULT 'CUSTOMER',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Account_type_status_idx" ON "Account"("type", "status");
