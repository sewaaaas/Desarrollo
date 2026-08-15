import { registerAs } from '@nestjs/config';

export type StorageDriver = 'local' | 's3';

export interface StorageConfig {
  driver: StorageDriver;
  localPath: string;
  maxFileSizeBytes: number;
  maxFilesPerTicket: number;
  maxTotalSizePerTicketBytes: number;
}

export const storageConfig = registerAs('storage', (): StorageConfig => ({
  driver: (process.env['STORAGE_DRIVER'] ?? 'local') as StorageDriver,
  localPath: process.env['STORAGE_LOCAL_PATH'] ?? './uploads',
  maxFileSizeBytes: parseInt(
    process.env['ATTACHMENT_MAX_FILE_SIZE_BYTES'] ?? '10485760',
    10,
  ),
  maxFilesPerTicket: parseInt(
    process.env['ATTACHMENT_MAX_FILES_PER_TICKET'] ?? '20',
    10,
  ),
  maxTotalSizePerTicketBytes: parseInt(
    process.env['ATTACHMENT_MAX_TOTAL_SIZE_PER_TICKET_BYTES'] ?? '104857600',
    10,
  ),
}));
