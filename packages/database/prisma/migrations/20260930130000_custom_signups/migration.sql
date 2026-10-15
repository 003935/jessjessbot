CREATE TABLE "custom_signups" (
  "id" SERIAL NOT NULL,
  "eventId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_signups_eventId_userId_key" ON "custom_signups"("eventId", "userId");
CREATE INDEX "custom_signups_eventId_status_idx" ON "custom_signups"("eventId", "status");
ALTER TABLE "custom_signups" ADD CONSTRAINT "custom_signups_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "customs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
