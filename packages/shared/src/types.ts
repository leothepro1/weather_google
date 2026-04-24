import type { z } from 'zod';
import type {
  AdjustmentLogSchema,
  BucketInputSchema,
  BucketSchema,
  CampaignSchema,
  WeatherConditionSchema,
  WeatherSnapshotSchema,
} from './schemas.js';

export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Bucket = z.infer<typeof BucketSchema>;
export type BucketInput = z.infer<typeof BucketInputSchema>;
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export type AdjustmentLog = z.infer<typeof AdjustmentLogSchema>;
