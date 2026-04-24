import type { z } from 'zod';
import type {
  AdjustmentLogSchema,
  BucketInputSchema,
  BucketSchema,
  CampaignListResponseSchema,
  CampaignSchema,
  ConnectionStatusSchema,
  GoogleAdsCampaignStatusSchema,
  GoogleAdsCampaignViewSchema,
  WeatherConditionSchema,
  WeatherSnapshotSchema,
} from './schemas.js';

export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Bucket = z.infer<typeof BucketSchema>;
export type BucketInput = z.infer<typeof BucketInputSchema>;
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export type AdjustmentLog = z.infer<typeof AdjustmentLogSchema>;

export type GoogleAdsCampaignStatus = z.infer<typeof GoogleAdsCampaignStatusSchema>;
export type GoogleAdsCampaignView = z.infer<typeof GoogleAdsCampaignViewSchema>;
export type CampaignListResponse = z.infer<typeof CampaignListResponseSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
