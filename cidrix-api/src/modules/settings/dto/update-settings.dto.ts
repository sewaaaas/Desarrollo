import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsTimeZone, ValidateIf } from 'class-validator';

export class UpdateSettingsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsTimeZone()
  timezone?: string;
}
