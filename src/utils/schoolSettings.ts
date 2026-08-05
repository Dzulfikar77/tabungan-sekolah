import { SchoolSettings } from '../types';

export function mergeSchoolSettings(current: SchoolSettings, incoming?: Partial<SchoolSettings> | null): SchoolSettings {
  return {
    ...current,
    ...(incoming ?? {}),
  };
}
