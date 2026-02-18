import { z } from "zod";

export const filterPresetSchema = z.enum(["neutral", "blueBlocker", "redBlocker", "nightWarm"]);

export const settingsSchema = z.object({
  filterPreset: filterPresetSchema.default("nightWarm"),
  filterIntensity: z.number().min(0).max(1).default(0.65),
  wakeTime: z.string().default("07:00"),
  sleepTime: z.string().default("23:00"),
  eyeBreakIntervalMin: z.number().min(10).max(90).default(20),
  hydrationIntervalMin: z.number().min(15).max(180).default(60),
  hydrationGoalGlasses: z.number().min(1).max(20).default(8),
  stillnessThresholdMin: z.number().min(15).max(180).default(50),
  reminderNotifications: z.boolean().default(true),
  audioCues: z.boolean().default(false),
  webcamPostureOptIn: z.boolean().default(false),
  devBypassPremium: z.boolean().default(true),
  disabledDomains: z.array(z.string()).default([]),
  distractorDomains: z.array(z.string()).default(["youtube.com", "x.com", "reddit.com"]) 
});

export type HolmetaSettings = z.infer<typeof settingsSchema>;

export const entitlementSchema = z.object({
  active: z.boolean(),
  plan: z.string().nullable().optional(),
  renewsAt: z.string().nullable().optional()
});

export type Entitlement = z.infer<typeof entitlementSchema>;
