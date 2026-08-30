import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isTimeZone } from 'class-validator';
import { PrismaService } from '@database/prisma.service';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEFAULT_ORGANIZATION_SETTINGS } from './settings.constants';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(organizationId: string): Promise<SettingsResponseDto> {
    const organization = await this.findActiveOrganization(organizationId);
    return this.toResponse(organization.settings);
  }

  async updateSettings(
    organizationId: string,
    dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    const organization = await this.findActiveOrganization(organizationId);
    const rawSettings = organization.settings;

    if (!this.isJsonObject(rawSettings)) {
      throw new ConflictException(
        'La configuración de la organización tiene un formato inconsistente',
      );
    }

    if (dto.timezone === undefined) {
      return this.toResponse(rawSettings);
    }

    const requestedTimezone = this.canonicalizeTimezone(dto.timezone);
    const persistedTimezone = this.getPersistedCanonicalTimezone(rawSettings);

    if (persistedTimezone === requestedTimezone) {
      return { timezone: persistedTimezone };
    }

    const updatedSettings = {
      ...rawSettings,
      timezone: requestedTimezone,
    } as Prisma.InputJsonObject;

    const result = await this.prisma.organization.updateMany({
      where: { id: organizationId, isActive: true },
      data: { settings: updatedSettings },
    });

    if (result.count === 0) {
      throw new NotFoundException('Organización no encontrada o inactiva');
    }

    return { timezone: requestedTimezone };
  }

  private async findActiveOrganization(
    organizationId: string,
  ): Promise<{ settings: Prisma.JsonValue }> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
      select: { settings: true },
    });

    if (!organization) {
      throw new NotFoundException('Organización no encontrada o inactiva');
    }

    return organization;
  }

  private toResponse(rawSettings: Prisma.JsonValue): SettingsResponseDto {
    if (!this.isJsonObject(rawSettings)) {
      return { ...DEFAULT_ORGANIZATION_SETTINGS };
    }

    return {
      timezone:
        this.getPersistedCanonicalTimezone(rawSettings) ??
        DEFAULT_ORGANIZATION_SETTINGS.timezone,
    };
  }

  private getPersistedCanonicalTimezone(
    settings: Prisma.JsonObject,
  ): string | null {
    const timezone = settings['timezone'];
    if (typeof timezone !== 'string' || !isTimeZone(timezone)) {
      return null;
    }

    return this.tryCanonicalizeTimezone(timezone);
  }

  private canonicalizeTimezone(timezone: string): string {
    const canonical = this.tryCanonicalizeTimezone(timezone);
    if (!canonical) {
      throw new BadRequestException('timezone debe ser una zona IANA válida');
    }
    return canonical;
  }

  private tryCanonicalizeTimezone(timezone: string): string | null {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
      }).resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
