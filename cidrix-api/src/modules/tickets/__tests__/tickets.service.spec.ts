import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { TicketFiltersDto } from '../dto/ticket-filters.dto';
import { TicketsService } from '../tickets.service';

describe('TicketsService.findAll authorization scope', () => {
  const ORGANIZATION_ID = 'organization-a';
  const USER_A_ID = 'user-a';
  const USER_B_ID = 'user-b';

  let service: TicketsService;
  let prisma: {
    $transaction: jest.Mock;
    ticket: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  function makeUser(role: UserRole, id = USER_A_ID): RequestUser {
    return {
      id,
      email: `${id}@cidrix.test`,
      organizationId: ORGANIZATION_ID,
      role,
    };
  }

  function expectSafeWhere(expectedCreatedById: string): void {
    const expectedWhere = {
      organizationId: ORGANIZATION_ID,
      createdById: expectedCreatedById,
    };

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  }

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      ticket: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    prisma.$transaction.mockImplementation(
      (operations: Array<Promise<unknown>>) => Promise.all(operations),
    );

    service = new TicketsService(
      prisma as unknown as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
  });

  it('limita a USER a sus tickets cuando createdById no está presente', async () => {
    await service.findAll(makeUser(UserRole.USER), {});

    expectSafeWhere(USER_A_ID);
  });

  it('ignora el createdById de otro usuario enviado por USER', async () => {
    await service.findAll(makeUser(UserRole.USER), {
      createdById: USER_B_ID,
    });

    expectSafeWhere(USER_A_ID);
  });

  it('mantiene el scope cuando USER envía su propio createdById', async () => {
    await service.findAll(makeUser(UserRole.USER), {
      createdById: USER_A_ID,
    });

    expectSafeWhere(USER_A_ID);
  });

  it('permite que ADMIN filtre por createdById', async () => {
    await service.findAll(makeUser(UserRole.ADMIN, 'admin-a'), {
      createdById: USER_B_ID,
    });

    expectSafeWhere(USER_B_ID);
  });

  it('permite que TECHNICIAN filtre por createdById', async () => {
    await service.findAll(makeUser(UserRole.TECHNICIAN, 'technician-a'), {
      createdById: USER_B_ID,
    });

    expectSafeWhere(USER_B_ID);
  });

  it.each([UserRole.USER, UserRole.ADMIN, UserRole.TECHNICIAN])(
    'preserva organizationId para el rol %s',
    async (role) => {
      const filters: TicketFiltersDto = {
        createdById: USER_B_ID,
      };

      await service.findAll(makeUser(role), filters);

      const expectedCreatedById =
        role === UserRole.USER ? USER_A_ID : USER_B_ID;
      expectSafeWhere(expectedCreatedById);
    },
  );
});
