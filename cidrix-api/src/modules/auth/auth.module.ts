import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule
 *
 * Registra JwtModule sin secret fijo — cada llamada a sign()
 * pasa su propio secret (access o refresh) desde ConfigService.
 * Esto permite usar dos secrets distintos con un solo JwtModule.
 *
 * PassportModule registra el sistema de estrategias.
 * JwtStrategy se registra como provider para que Passport
 * la descubra automáticamente.
 *
 * DatabaseModule no se importa aquí porque es @Global()
 * — PrismaService está disponible directamente.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}