import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestUser } from './types/jwt-payload.type';

/**
 * AuthController
 *
 * Rutas públicas:
 *   POST /auth/login    — Login con email + password
 *   POST /auth/refresh  — Renovar access token via cookie
 *
 * Rutas protegidas (JwtAuthGuard):
 *   POST /auth/logout   — Cerrar sesión
 *   GET  /auth/me       — Perfil del usuario autenticado
 *
 * El refresh token viaja exclusivamente en httpOnly cookie.
 * Nunca se expone en el body de la respuesta.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // POST /auth/login
  // ---------------------------------------------------------------------------

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return { accessToken };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/refresh
  // ---------------------------------------------------------------------------

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    // Decodificar sin verificar para obtener el userId
    // La verificación real ocurre en AuthService (comparación con hash en DB)
    const decoded = this.decodeRefreshToken(refreshToken);

    const { accessToken } = await this.authService.refresh(decoded.sub, refreshToken);

    return { accessToken };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/logout
  // ---------------------------------------------------------------------------

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);

    this.clearRefreshTokenCookie(res);

    return { message: 'Sesión cerrada exitosamente' };
  }

  // ---------------------------------------------------------------------------
  // GET /auth/me
  // ---------------------------------------------------------------------------

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: RequestUser): Promise<UserProfileDto> {
    return this.authService.getMe(user);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

private setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,                                    // JS nunca puede leerla
    secure: isProduction,                              // HTTPS solo en producción
    sameSite: isProduction ? 'strict' : 'lax',        // lax en dev, strict en prod
    maxAge: 7 * 24 * 60 * 60 * 1000,                  // 7 días en ms
    path: '/api/v1/auth',                              // Solo rutas de auth
  });
}

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      path: '/api/v1/auth',
    });
  }

  private decodeRefreshToken(token: string): { sub: string } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || !parts[1]) {
        throw new UnauthorizedException('Token malformado');
      }
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { sub?: string };

      if (!payload.sub) {
        throw new UnauthorizedException('Token inválido');
      }

      return { sub: payload.sub };
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}