import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * JwtAuthGuard
 *
 * Guard que protege endpoints requiriendo un JWT válido.
 * Usa JwtStrategy para validar el token.
 *
 * Uso en controller:
 *   @UseGuards(JwtAuthGuard)
 *
 * En sprints futuros se registrará globalmente en AppModule
 * y se usará @Public() para excluir endpoints abiertos.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err ?? !user) {
      throw new UnauthorizedException('No autorizado — token inválido o expirado');
    }
    return user;
  }
}