-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "comment_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "visibility" "CommentVisibility" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "idx_attachments_org_ticket_created" ON "attachments"("organization_id", "ticket_id", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "idx_attachments_org_ticket_visibility_created" ON "attachments"("organization_id", "ticket_id", "visibility", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "idx_attachments_org_comment_created" ON "attachments"("organization_id", "comment_id", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "comments_organization_id_ticket_id_id_key" ON "comments"("organization_id", "ticket_id", "id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_ticket_id_fkey" FOREIGN KEY ("organization_id", "ticket_id") REFERENCES "tickets"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_ticket_id_comment_id_fkey" FOREIGN KEY ("organization_id", "ticket_id", "comment_id") REFERENCES "comments"("organization_id", "ticket_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_uploaded_by_id_fkey" FOREIGN KEY ("organization_id", "uploaded_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_deleted_by_id_fkey" FOREIGN KEY ("organization_id", "deleted_by_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
