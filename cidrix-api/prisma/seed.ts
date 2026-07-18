import { PrismaClient, UserRole, UserStatus, OrgPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed de desarrollo — CIDRIX
 *
 * Crea datos mínimos para desarrollo:
 *   - 1 organización demo
 *   - 1 usuario ADMIN
 *   - 1 usuario TECHNICIAN
 *   - 1 usuario USER
 *
 * Contraseña de todos los usuarios: cidrix123
 * NUNCA ejecutar en producción.
 */

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'cidrix123';

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed de CIDRIX...\n');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // ------------------------------------------------------------------
  // Organización demo
  // ------------------------------------------------------------------
  const organization = await prisma.organization.upsert({
    where: { slug: 'cidrix-demo' },
    update: {},
    create: {
      name: 'CIDRIX Demo',
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
    update: { passwordHash },
    create: {
      organizationId: organization.id,
      email: 'admin@cidrix.dev',
      passwordHash,
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
    update: { passwordHash },
    create: {
      organizationId: organization.id,
      email: 'tecnico@cidrix.dev',
      passwordHash,
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
    update: { passwordHash },
    create: {
      organizationId: organization.id,
      email: 'usuario@cidrix.dev',
      passwordHash,
      fullName: 'Usuario CIDRIX',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Usuario      : ${user.email} (role: ${user.role})`);

  console.log('\n🎉 Seed completado exitosamente.');
  console.log('─────────────────────────────────────────');
  console.log('  Organización : CIDRIX Demo');
  console.log('  Contraseña   : cidrix123 (bcrypt)');
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