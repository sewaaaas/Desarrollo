import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '@config/jwt.config';
import { JwtPayload, RequestUser } from '../types/jwt-payload.type';

/**
 * JwtStrategy
 *
 * Valida el access token en cada request protegido.
 * Extrae el token del header Authorization: Bearer <token>
 *
 * Si el token es válido, retorna RequestUser que NestJS
 * inyecta en req.user — disponible via @CurrentUser().
 *
 * No hace round-trip a DB — toda la info necesaria está en el payload.
 * Si se requiere verificar que el usuario sigue activo en DB,
 * se agrega en un sprint posterior con un interceptor de sesión.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const jwtConfig = configService.get<JwtConfig>('jwt');

    if (!jwtConfig?.accessSecret) {
      throw new Error('JWT_ACCESS_SECRET no está configurado');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  validate(payload: JwtPayload): RequestUser {
    if (!payload.sub || !payload.email || !payload.role || !payload.organizationId) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}