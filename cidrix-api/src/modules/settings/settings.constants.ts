export const DEFAULT_ORGANIZATION_SETTINGS = {
  timezone: 'UTC',
} as const;

export interface SupportedOrganizationSettings {
  timezone: string;
}
