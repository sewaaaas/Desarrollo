/**
 * El refresh token viaja en httpOnly cookie — no en el body.
 * Este DTO existe como documentación del contrato y para uso futuro.
 */
export class RefreshTokenDto {
  refreshToken!: string;
}