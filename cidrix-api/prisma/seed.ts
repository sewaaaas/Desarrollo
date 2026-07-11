import { PrismaClient, UserRole, UserStatus, OrgPlan } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Seed de desarrollo — CIDRIX
 *
 * Crea datos mínimos para iniciar el desarrollo de los sprints siguientes:
 *   - 1 organización demo
 *   - 1 usuario ADMIN
 *   - 1 usuario TECHNICIAN
 *   - 1 usuario USER
 *
 * IMPORTANTE: Este seed es solo para desarrollo local.
 * Nunca ejecutar en producción.
 *
 * Uso: npm run seed
 *
 * Nota: Las contraseñas se hashean con SHA-256 como placeholder.
 * bcrypt se implementará en BE-06 (AuthModule).
 * Contraseña de todos los usuarios: cidrix123
 */

const prisma = new PrismaClient();

// Placeholder hash hasta BE-06 — NO usar en producción
function placeholderHash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed de CIDRIX...\n');

  // ------------------------------------------------------------------
  // Organización demo
  // ------------------------------------------------------------------
  const organization = await prisma.organization.upsert({
    where: { slug: 'cidrix-demo' },
    update: {},
    create: {
      name: 'CIDRIX Demo',
      // slug normalizado a minúsculas — estrategia aprobada para case-insensitive
      slug: 'cidrix-demo',
      plan: OrgPlan.PROFESSIONAL,
      isActive: true,
      settings: {
        timezone: 'America/Bogota',
        language: 'es',
        dateFormat: 'DD/MM/YYYY',
      },
    },
  });

  console.log(`✅ Organización : ${organization.name} (${organization.slug})`);

  // ------------------------------------------------------------------
  // Usuario ADMIN
  // ------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: {
      uq_users_org_email: {
        organizationId: organization.id,
        email: 'admin@cidrix.dev',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: 'admin@cidrix.dev',
      passwordHash: placeholderHash('cidrix123'),
      fullName: 'Admin CIDRIX',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Admin        : ${admin.email} (role: ${admin.role})`);

  // ------------------------------------------------------------------
  // Usuario TECHNICIAN
  // ------------------------------------------------------------------
  const technician = await prisma.user.upsert({
    where: {
      uq_users_org_email: {
        organizationId: organization.id,
        email: 'tecnico@cidrix.dev',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: 'tecnico@cidrix.dev',
      passwordHash: placeholderHash('cidrix123'),
      fullName: 'Técnico CIDRIX',
      role: UserRole.TECHNICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Técnico      : ${technician.email} (role: ${technician.role})`);

  // ------------------------------------------------------------------
  // Usuario USER
  // ------------------------------------------------------------------
  const user = await prisma.user.upsert({
    where: {
      uq_users_org_email: {
        organizationId: organization.id,
        email: 'usuario@cidrix.dev',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: 'usuario@cidrix.dev',
      passwordHash: placeholderHash('cidrix123'),
      fullName: 'Usuario CIDRIX',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Usuario      : ${user.email} (role: ${user.role})`);

  console.log('\n🎉 Seed completado exitosamente.');
  console.log('─────────────────────────────────────────');
  console.log('  Organización : CIDRIX Demo');
  console.log('  Contraseña   : cidrix123 (placeholder — bcrypt en BE-06)');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });