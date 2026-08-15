import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { AttachmentsService } from './attachments.service';
import { AttachmentFiltersDto } from './dto/attachment-filters.dto';
import {
  AttachmentResponseDto,
  PaginatedAttachmentsDto,
} from './dto/attachment-response.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { UploadedAttachmentFile } from './validation/attachment-file.validator';

@Controller('tickets/:ticketId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<AttachmentResponseDto> {
    return this.attachmentsService.upload(currentUser, ticketId, dto, file);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  findAll(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Query() filters: AttachmentFiltersDto,
  ): Promise<PaginatedAttachmentsDto> {
    return this.attachmentsService.findAll(currentUser, ticketId, filters);
  }

  @Get(':attachmentId/download')
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async download(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const attachment = await this.attachmentsService.download(
      currentUser,
      ticketId,
      attachmentId,
    );

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', attachment.sizeBytes.toString());
    response.setHeader(
      'Content-Disposition',
      this.buildContentDisposition(attachment.originalName),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');

    await pipeline(attachment.stream, response);
  }

  @Delete(':attachmentId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    return this.attachmentsService.remove(currentUser, ticketId, attachmentId);
  }

  private buildContentDisposition(originalName: string): string {
    const asciiFallback = originalName
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(originalName).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
  }
}
