import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { StorageConfig } from '@config/storage.config';
import { TicketsModule } from '@modules/tickets/tickets.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsService } from './attachments.service';
import { ATTACHMENT_STORAGE } from './storage/attachment-storage.token';
import { LocalAttachmentStorage } from './storage/local-attachment.storage';
import { AttachmentFileValidator } from './validation/attachment-file.validator';

@Module({
  imports: [
    TicketsModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<StorageConfig>('storage');
        if (!config) {
          throw new Error('Storage configuration could not be loaded');
        }
        return {
          limits: {
            fileSize: config.maxFileSizeBytes,
            files: 1,
            fields: 2,
            parts: 3,
          },
        };
      },
    }),
  ],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsRepository,
    AttachmentFileValidator,
    LocalAttachmentStorage,
    {
      provide: ATTACHMENT_STORAGE,
      useExisting: LocalAttachmentStorage,
    },
  ],
})
export class AttachmentsModule {}
