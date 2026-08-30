import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  getSettings(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.getSettings(currentUser.organizationId);
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  updateSettings(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponseDto> {
    return this.settingsService.updateSettings(currentUser.organizationId, dto);
  }
}
