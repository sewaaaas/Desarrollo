import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadStream } from 'node:fs';
import { mkdir, open, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { StorageConfig } from '@config/storage.config';
import { AttachmentStorage } from './attachment-storage.interface';

@Injectable()
export class LocalAttachmentStorage implements AttachmentStorage, OnModuleInit {
  private readonly rootPath: string;

  constructor(configService: ConfigService) {
    const config = configService.get<StorageConfig>('storage');

    if (!config) {
      throw new Error('Storage configuration could not be loaded');
    }

    if (config.driver !== 'local') {
      throw new Error(
        `STORAGE_DRIVER=${config.driver} no está implementado. BE-09 solo soporta local.`,
      );
    }

    this.rootPath = resolve(config.localPath);
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  async put(storageKey: string, data: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, data, { flag: 'wx', mode: 0o600 });
  }

  async openReadStream(storageKey: string): Promise<ReadStream> {
    const targetPath = this.resolveSafePath(storageKey);

    // Abrir antes de devolver el stream permite reportar ENOENT antes de que el
    // controller escriba headers de descarga.
    const handle = await open(targetPath, 'r');
    return handle.createReadStream();
  }

  async delete(storageKey: string): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);

    try {
      await unlink(targetPath);
    } catch (error: unknown) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private resolveSafePath(storageKey: string): string {
    if (!storageKey || storageKey.includes('\0') || isAbsolute(storageKey)) {
      throw new Error('Storage key inválida');
    }

    const targetPath = resolve(this.rootPath, storageKey);
    const relativePath = relative(this.rootPath, targetPath);

    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('Storage key fuera del directorio permitido');
    }

    return targetPath;
  }

  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
