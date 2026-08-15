/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { LocalAttachmentStorage } from '../storage/local-attachment.storage';

describe('LocalAttachmentStorage', () => {
  let rootPath: string;
  let storage: LocalAttachmentStorage;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'cidrix-attachments-'));
    storage = new LocalAttachmentStorage(
      new ConfigService({
        storage: {
          driver: 'local',
          localPath: rootPath,
          maxFileSizeBytes: 10,
          maxFilesPerTicket: 20,
          maxTotalSizePerTicketBytes: 100,
        },
      }),
    );
    await storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it('escribe y lee bytes exactos bajo el root privado', async () => {
    const bytes = Buffer.from('contenido privado');
    await storage.put('attachments/key-1', bytes);

    const stream = await storage.openReadStream('attachments/key-1');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks)).toEqual(bytes);
  });

  it('usa creación exclusiva y no sobrescribe una clave existente', async () => {
    await storage.put('attachments/key-1', Buffer.from('primero'));

    await expect(
      storage.put('attachments/key-1', Buffer.from('segundo')),
    ).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it.each(['../escape', 'attachments/../../escape', '..\\escape'])(
    'rechaza path traversal: %s',
    async (storageKey) => {
      await expect(storage.put(storageKey, Buffer.from('x'))).rejects.toThrow(
        'fuera del directorio permitido',
      );
    },
  );

  it('rechaza paths absolutos y claves vacías', async () => {
    const absolutePath = isAbsolute(rootPath)
      ? rootPath
      : join(tmpdir(), 'absolute');

    await expect(storage.put(absolutePath, Buffer.from('x'))).rejects.toThrow(
      'Storage key inválida',
    );
    await expect(storage.put('', Buffer.from('x'))).rejects.toThrow(
      'Storage key inválida',
    );
  });

  it('delete elimina el objeto y es idempotente si ya no existe', async () => {
    await storage.put('attachments/key-1', Buffer.from('x'));
    await storage.delete('attachments/key-1');
    await storage.delete('attachments/key-1');

    await expect(
      storage.openReadStream('attachments/key-1'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('falla explícitamente si STORAGE_DRIVER=s3', () => {
    expect(
      () =>
        new LocalAttachmentStorage(
          new ConfigService({
            storage: {
              driver: 's3',
              localPath: rootPath,
              maxFileSizeBytes: 10,
              maxFilesPerTicket: 20,
              maxTotalSizePerTicketBytes: 100,
            },
          }),
        ),
    ).toThrow('STORAGE_DRIVER=s3 no está implementado');
  });
});
