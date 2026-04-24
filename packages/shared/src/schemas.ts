import { z } from 'zod';

export const WeatherConditionSchema = z.enum([
  'clear',
  'partly_cloudy',
  'cloudy',
  'rain',
  'snow',
  'thunderstorm',
]);

const epochMs = z.number().int().nonnegative();
const percent = z.number().finite();

export const CampaignSchema = z.object({
  id: z.number().int().positive(),
  googleCampaignId: z.string().min(1),
  name: z.string().min(1),
  baseBudgetMicros: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: epochMs,
  updatedAt: epochMs,
});

export const BucketSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    priority: z.number().int(),
    minTempC: z.number().nullable(),
    maxTempC: z.number().nullable(),
    conditions: z.array(WeatherConditionSchema),
    modifierPct: percent,
    active: z.boolean(),
    createdAt: epochMs,
    updatedAt: epochMs,
  })
  .refine(
    (b) => b.minTempC === null || b.maxTempC === null || b.minTempC <= b.maxTempC,
    { message: 'minTempC must be <= maxTempC when both are set', path: ['minTempC'] },
  );

export const BucketInputSchema = z
  .object({
    name: z.string().min(1),
    priority: z.number().int(),
    minTempC: z.number().nullable().default(null),
    maxTempC: z.number().nullable().default(null),
    conditions: z.array(WeatherConditionSchema).default([]),
    modifierPct: percent,
    active: z.boolean().default(true),
  })
  .refine(
    (b) => b.minTempC === null || b.maxTempC === null || b.minTempC <= b.maxTempC,
    { message: 'minTempC must be <= maxTempC when both are set', path: ['minTempC'] },
  );

export const WeatherSnapshotSchema = z.object({
  id: z.number().int().positive(),
  ts: epochMs,
  tempC: z.number(),
  condition: WeatherConditionSchema,
  wmoCode: z.number().int().nonnegative(),
  location: z.string().min(1),
});

// ---- Google Ads service layer ----------------------------------------
// Shape returned by the /api/campaigns endpoint (one row per campaign).
// Distinct from the DB `CampaignSchema` which represents our local link row.

export const GoogleAdsCampaignStatusSchema = z.enum(['ENABLED', 'PAUSED', 'REMOVED']);

export const GoogleAdsCampaignViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dailyBudgetMicros: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  status: GoogleAdsCampaignStatusSchema,
  budgetResourceId: z.string().min(1).optional(),
});

export const CampaignListResponseSchema = z.object({
  campaigns: z.array(GoogleAdsCampaignViewSchema),
});

export const ConnectionStatusSchema = z.object({
  connected: z.boolean(),
  customerId: z.string().optional(),
});

export const AdjustmentLogSchema = z.object({
  id: z.number().int().positive(),
  ts: epochMs,
  campaignId: z.number().int().positive(),
  bucketId: z.number().int().positive().nullable(),
  oldBudgetMicros: z.number().int().nonnegative(),
  newBudgetMicros: z.number().int().nonnegative(),
  reason: z.string(),
  dryRun: z.boolean(),
});
