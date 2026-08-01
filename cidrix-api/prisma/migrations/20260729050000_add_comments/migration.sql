-- =============================================================================
-- BE-07 — Módulo de Comentarios
-- =============================================================================
-- Escrita a mano por Claude: `npx prisma migrate dev` no pudo ejecutarse en
-- este sandbox (sin acceso de red a binaries.prisma.sh — ver reporte). A
-- diferencia del intento anterior (basado en un commit desactualizado), esta
-- versión asume correctamente que "tickets", "users", "ticket_history" y sus
-- enums YA EXISTEN (migraciones 20260724035744_add_tickets y
-- 20260726063406_update_ticket_history_index, ambas ya aplicadas en
-- origin/main @ b92e9eb).
--
-- Antes de aplicar en un entorno real:
--   1) npx prisma format
--   2) npx prisma validate
--   3) npx prisma migrate dev   (dejar que Prisma regenere/confirme este diff;
--      en particular, verificar el nombre real que asigne a los dos índices
--      únicos de abajo — ver nota sobre @@unique/name vs map más abajo)
-- =============================================================================

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- AlterEnum
-- Postgres no permite usar el nuevo valor de un enum en la misma transacción
-- en que se agrega — debe ejecutarse antes de cualquier INSERT que use
-- 'FIRST_RESPONSE'.
ALTER TYPE "TicketHistoryAction" ADD VALUE 'FIRST_RESPONSE';

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (integridad tenant-first — requerida por las FK compuestas de abajo)
-- NOTA: en schema.prisma estos @@unique llevan `name: "uq_tickets_org_id"` /
-- `name: "uq_users_org_id"`, pero ese argumento solo nombra el compound-unique
-- en Prisma Client — NO el constraint de Postgres. Confirmado empíricamente
-- contra la migración real add_tickets: `name: "uq_tickets_org_number"` en el
-- schema resultó en `tickets_organization_id_number_key` en el SQL generado,
-- no en "uq_tickets_org_number". Por eso aquí se usa el nombre default real
-- de Prisma (<tabla>_<col1>_<col2>_key), no el mnemónico del schema.
CREATE UNIQUE INDEX "tickets_organization_id_id_key" ON "tickets"("organization_id", "id");
CREATE UNIQUE INDEX "users_organization_id_id_key" ON "users"("organization_id", "id");

-- CreateIndex
CREATE INDEX "idx_comments_org_ticket_created" ON "comments"("organization_id", "ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "idx_comments_org_ticket_visibility_created" ON "comments"("organization_id", "ticket_id", "visibility", "created_at", "id");

-- AddForeignKey (tenant-first compuesta — Ticket)
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_ticket_id_fkey" FOREIGN KEY ("organization_id", "ticket_id") REFERENCES "tickets"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (tenant-first compuesta — User/author)
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_author_id_fkey" FOREIGN KEY ("organization_id", "author_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Organization)
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
