import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@database/prisma.service';
import { JwtConfig } from '@config/jwt.config';
import { AppConfig } from '@config/app.config';
import { JwtPayload, RequestUser } from './types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { UserProfileDto } from './dto/auth-response.dto';
import { UserStatus } from '@prisma/client';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto): Promise<Tokens> {
    const { email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        status: UserStatus.ACTIVE,
      },
      include: {
        organization: {
          select: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.organization.isActive) {
      throw new UnauthorizedException('La organización no está activa');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const requestUser: RequestUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const tokens = await this.generateTokens(requestUser);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, this.getSaltRounds()),
        lastLoginAt: new Date(),
      },
    });

    this.logger.log(`Login exitoso: ${user.email} (org: ${user.organizationId})`);

    return tokens;
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  async refresh(userId: string, refreshToken: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenValid) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const accessToken = this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    this.logger.log(`Token renovado: ${user.email}`);

    return { accessToken };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    this.logger.log(`Logout: userId ${userId}`);
  }

  // ---------------------------------------------------------------------------
  // Me
  // ---------------------------------------------------------------------------

  async getMe(user: RequestUser): Promise<UserProfileDto> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true,
        avatarUrl: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return dbUser;
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private async generateTokens(user: RequestUser): Promise<Tokens> {
    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(this.signAccessToken(user)),
      this.signRefreshToken(user),
    ]);

    return { accessToken, refreshToken };
  }

  private signAccessToken(user: RequestUser): string {
    const jwtConfig = this.configService.get<JwtConfig>('jwt');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    return this.jwtService.sign(payload, {
      secret: jwtConfig?.accessSecret,
      expiresIn: jwtConfig?.accessExpiresIn as never,
    });
  }

  private async signRefreshToken(user: RequestUser): Promise<string> {
    const jwtConfig = this.configService.get<JwtConfig>('jwt');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    return this.jwtService.signAsync(payload, {
      secret: jwtConfig?.refreshSecret,
      expiresIn: jwtConfig?.refreshExpiresIn as never,
    });
  }

  private getSaltRounds(): number {
    return this.configService.get<AppConfig>('app')?.bcryptSaltRounds ?? 10;
  }
}