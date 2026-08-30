import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardOverviewResponseDto,
  DashboardTrendsResponseDto,
} from './dto/dashboard-response.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<DashboardOverviewResponseDto> {
    return this.dashboardService.getOverview(currentUser);
  }

  @Get('trends')
  getTrends(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardTrendsResponseDto> {
    return this.dashboardService.getTrends(currentUser, query.period);
  }
}
