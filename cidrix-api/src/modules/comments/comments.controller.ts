import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentFiltersDto } from './dto/comment-filters.dto';
import { CommentResponseDto, PaginatedCommentsDto } from './dto/comment-response.dto';

/**
 * CommentsController
 *
 * Roles por endpoint (igual convención que TicketsController — @Roles()
 * explícito aunque los tres roles pasen el guard):
 *   POST /tickets/:ticketId/comments → ADMIN, TECHNICIAN, USER (alcance
 *     distinto para cada uno, resuelto en CommentsService — ver matriz RBAC)
 *   GET  /tickets/:ticketId/comments → ADMIN, TECHNICIAN, USER (USER ve solo
 *     los suyos, y solo PUBLIC)
 */
@Controller('tickets/:ticketId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(currentUser, ticketId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Param('ticketId') ticketId: string,
    @Query() filters: CommentFiltersDto,
  ): Promise<PaginatedCommentsDto> {
    return this.commentsService.findAll(currentUser, ticketId, filters);
  }
}
