import { IsEnum, IsOptional } from 'class-validator';
import { DashboardPeriod } from '../dashboard.constants';

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period: DashboardPeriod = DashboardPeriod.THIRTY_DAYS;
}
