import { Readable } from 'node:stream';

export interface AttachmentStorage {
  put(storageKey: string, data: Buffer): Promise<void>;
  openReadStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}
