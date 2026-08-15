import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { TextDecoder } from 'node:util';
import { StorageConfig } from '@config/storage.config';

export interface UploadedAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ValidatedAttachmentFile extends UploadedAttachmentFile {
  normalizedName: string;
  extension: string;
}

const ALLOWED_EXTENSIONS_BY_MIME: Readonly<Record<string, readonly string[]>> =
  {
    'application/pdf': ['.pdf'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
    'text/plain': ['.txt', '.log'],
    'text/csv': ['.csv'],
  };

const DANGEROUS_EMBEDDED_EXTENSIONS = new Set([
  '.exe',
  '.com',
  '.bat',
  '.cmd',
  '.msi',
  '.ps1',
  '.sh',
  '.js',
  '.mjs',
  '.html',
  '.htm',
  '.svg',
  '.zip',
  '.rar',
  '.7z',
  '.docm',
  '.xlsm',
]);

@Injectable()
export class AttachmentFileValidator {
  private readonly maxFileSizeBytes: number;

  constructor(configService: ConfigService) {
    const config = configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration could not be loaded');
    }
    this.maxFileSizeBytes = config.maxFileSizeBytes;
  }

  validate(file: UploadedAttachmentFile | undefined): ValidatedAttachmentFile {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio');
    }

    if (!Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('El archivo no contiene datos válidos');
    }

    if (file.size <= 0 || file.buffer.length <= 0) {
      throw new BadRequestException('El archivo no puede estar vacío');
    }

    if (
      file.size > this.maxFileSizeBytes ||
      file.buffer.length > this.maxFileSizeBytes
    ) {
      throw new PayloadTooLargeException(
        `El archivo supera el límite de ${this.maxFileSizeBytes} bytes`,
      );
    }

    if (file.size !== file.buffer.length) {
      throw new BadRequestException(
        'El tamaño declarado del archivo es inválido',
      );
    }

    const normalizedName = this.normalizeOriginalName(file.originalname);
    const extension = extname(normalizedName).toLowerCase();
    const mimeType = file.mimetype.trim().toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME[mimeType];

    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        'La extensión o el tipo MIME del archivo no está permitido',
      );
    }

    this.rejectDangerousEmbeddedExtension(normalizedName, extension);

    if (!this.matchesContent(mimeType, file.buffer)) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con su tipo declarado',
      );
    }

    return {
      ...file,
      originalname: normalizedName,
      mimetype: mimeType,
      normalizedName,
      extension,
    };
  }

  private normalizeOriginalName(originalName: string): string {
    if (
      typeof originalName !== 'string' ||
      originalName.includes('/') ||
      originalName.includes('\\') ||
      this.containsControlCharacter(originalName)
    ) {
      throw new BadRequestException('El nombre del archivo es inválido');
    }

    const normalized = originalName.normalize('NFC').trim();

    if (!normalized || normalized.length > 255) {
      throw new BadRequestException('El nombre del archivo es inválido');
    }

    return normalized;
  }

  private containsControlCharacter(value: string): boolean {
    return Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    });
  }

  private rejectDangerousEmbeddedExtension(
    originalName: string,
    finalExtension: string,
  ): void {
    const nameWithoutFinalExtension = originalName.slice(
      0,
      -finalExtension.length,
    );
    const segments = nameWithoutFinalExtension
      .toLowerCase()
      .split('.')
      .slice(1);

    if (
      segments.some((segment) =>
        DANGEROUS_EMBEDDED_EXTENSIONS.has(`.${segment}`),
      )
    ) {
      throw new BadRequestException(
        'El nombre contiene una extensión intermedia peligrosa',
      );
    }
  }

  private matchesContent(mimeType: string, data: Buffer): boolean {
    switch (mimeType) {
      case 'application/pdf':
        return data.subarray(0, 5).toString('ascii') === '%PDF-';
      case 'image/png':
        return data
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          );
      case 'image/jpeg':
        return (
          data.length >= 3 &&
          data[0] === 0xff &&
          data[1] === 0xd8 &&
          data[2] === 0xff
        );
      case 'image/webp':
        return (
          data.length >= 12 &&
          data.subarray(0, 4).toString('ascii') === 'RIFF' &&
          data.subarray(8, 12).toString('ascii') === 'WEBP'
        );
      case 'text/plain':
      case 'text/csv':
        return this.isValidUtf8Text(data);
      default:
        return false;
    }
  }

  private isValidUtf8Text(data: Buffer): boolean {
    if (data.includes(0)) {
      return false;
    }

    try {
      new TextDecoder('utf-8', { fatal: true }).decode(data);
      return true;
    } catch {
      return false;
    }
  }
}
