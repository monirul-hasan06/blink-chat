-- Add reply references for direct and group messages.
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "GroupMessage" ADD COLUMN "replyToId" TEXT;

CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
CREATE INDEX "GroupMessage_replyToId_idx" ON "GroupMessage"("replyToId");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_replyToId_fkey"
FOREIGN KEY ("replyToId") REFERENCES "Message"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GroupMessage"
ADD CONSTRAINT "GroupMessage_replyToId_fkey"
FOREIGN KEY ("replyToId") REFERENCES "GroupMessage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
