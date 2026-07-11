import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService
 *
 * Wrapper de PrismaClient para NestJS.
 * - OnModuleInit: conecta a la DB cuando el módulo arranca.
 * - OnModuleDestroy: desconecta limpiamente cuando la app cierra.
 *   Esto es crítico para Docker — evita conexiones colgadas al detener el contenedor.
 *
 * Patrón oficial recomendado por NestJS + Prisma.
 * Documentación: https://docs.nestjs.com/recipes/prisma
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}