-- DropIndex
DROP INDEX "idx_ticket_history_ticket_id";

-- CreateIndex
CREATE INDEX "idx_ticket_history_org_ticket" ON "ticket_history"("organization_id", "ticket_id");
