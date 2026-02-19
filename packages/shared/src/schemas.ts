import { z } from "zod";

export const filterPresetSchema = z.enum([
  "blueShieldMild",
  "blueShieldStrong",
  "blueShieldMax",
  "nightWarmMild",
  "nightWarmStrong",
  "nightWarmMax",
  "redNightStrong",
  "redNightMax",
  "redBlocker",
  "grayscale",
  "contrastGuard",
  "migraineSafe"
]);

export const siteOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  intensity: z.number().min(0).max(1).nullable().optional(),
  preset: filterPresetSchema.optional()
});

export const reminderTypeSchema = z.enum([
  "eye",
  "movement",
  "posture",
  "hydration",
  "breathwork",
  "dailyAudit"
]);

export const cadenceModeSchema = z.enum(["interval", "workBlocks", "timeWindows"]);

export const cadenceProfileSchema = z.enum([
  "balanced",
  "deepWork",
  "highStrain",
  "gentle",
  "night"
]);

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
  .default("09:00");

export const deliveryStyleSchema = z.object({
  overlay: z.boolean().default(true),
  notification: z.boolean().default(true),
  popupOnly: z.boolean().default(false),
  sound: z.boolean().default(false),
  soundVolume: z.number().min(0).max(1).default(0.25),
  gentle: z.boolean().default(false)
});

export const cadenceWindowSchema = z.object({
  start: timeSchema.default("09:00"),
  end: timeSchema.default("17:00")
});

export const cadenceScheduleSchema = z.object({
  mode: cadenceModeSchema.default("interval"),
  intervalMin: z.number().int().min(5).max(360).default(20),
  jitterMin: z.number().int().min(0).max(3).default(0),
  workMin: z.number().int().min(15).max(120).default(50),
  breakMin: z.number().int().min(5).max(60).default(10),
  anchorTime: timeSchema.default("09:00"),
  windows: z.array(cadenceWindowSchema).max(8).default([{ start: "09:00", end: "17:30" }])
});

const reminderCadenceBaseSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: cadenceScheduleSchema.default({}),
  delivery: deliveryStyleSchema.default({}),
  snoozeMinutes: z.array(z.number().int().min(1).max(180)).min(1).max(8).default([5, 10, 15, 30]),
  snoozeCustomMin: z.number().int().min(1).max(180).default(20),
  escalateIfIgnored: z.boolean().default(false),
  escalateAfterIgnores: z.number().int().min(1).max(10).default(3)
});

export const eyeCadenceSchema = reminderCadenceBaseSchema.extend({
  exerciseDurationSec: z.number().int().min(10).max(120).default(20),
  exerciseSet: z.enum(["classic", "palming", "blink-reset", "focus-shift", "mixed"]).default("mixed")
});

export const movementCadenceSchema = reminderCadenceBaseSchema.extend({
  suggestionRotation: z.boolean().default(true),
  promptType: z.enum(["stand", "walk", "mixed"]).default("mixed")
});

export const postureCadenceSchema = reminderCadenceBaseSchema.extend({
  stillnessMinutes: z.number().int().min(10).max(240).default(50),
  slouchSensitivity: z.number().min(0.1).max(1).default(0.45)
});

export const hydrationCadenceSchema = reminderCadenceBaseSchema.extend({
  dailyGoalGlasses: z.number().int().min(1).max(24).default(8),
  quietHoursOverride: z.boolean().default(false)
});

export const breathworkCadenceSchema = reminderCadenceBaseSchema.extend({
  onDemandPresets: z.array(z.enum(["box", "478", "sigh"])) .min(1).max(3).default(["box", "478", "sigh"])
});

export const dailyAuditCadenceSchema = reminderCadenceBaseSchema.extend({
  nudgeTime: timeSchema.default("18:00"),
  missedDayFallback: z.enum(["nextMorning", "nextWorkWindow", "skip"]).default("nextMorning")
});

export const cadenceGlobalSchema = z.object({
  quietHoursStart: timeSchema.default("22:30"),
  quietHoursEnd: timeSchema.default("07:30"),
  suppressDuringFocus: z.boolean().default(true),
  suppressWhenIdle: z.boolean().default(true),
  meetingModeManual: z.boolean().default(false),
  meetingModeAuto: z.boolean().default(false),
  meetingDomains: z.array(z.string()).default([
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com"
  ]),
  panicUntilTs: z.number().int().nonnegative().default(0),
  snoozeAllUntilTs: z.number().int().nonnegative().default(0)
});

export const cadenceSchema = z.object({
  version: z.number().int().default(2),
  activeProfile: cadenceProfileSchema.default("balanced"),
  global: cadenceGlobalSchema.default({}),
  reminders: z
    .object({
      eye: eyeCadenceSchema.default({}),
      movement: movementCadenceSchema.default({}),
      posture: postureCadenceSchema.default({}),
      hydration: hydrationCadenceSchema.default({}),
      breathwork: breathworkCadenceSchema.default({}),
      dailyAudit: dailyAuditCadenceSchema.default({})
    })
    .default({})
});

export const entitlementFeaturesSchema = z.object({
  advancedCadence: z.boolean().default(false),
  workBlocks: z.boolean().default(false),
  timeWindows: z.boolean().default(false),
  multiProfiles: z.boolean().default(false),
  settingsSync: z.boolean().default(false),
  meetingAutoSuppression: z.boolean().default(false),
  advancedAnalytics: z.boolean().default(false)
});

export const settingsSchema = z.object({
  settingsVersion: z.number().int().default(2),
  filterPreset: filterPresetSchema.default("nightWarmStrong"),
  filterIntensity: z.number().min(0).max(1).default(0.78),
  filterEnabled: z.boolean().default(true),
  colorAccurate: z.boolean().default(false),
  overlayStrength: z.number().min(0).max(1).default(0.35),
  filterDimming: z.number().min(0).max(1).default(0.2),
  filterContrast: z.number().min(0.35).max(2.4).default(1),
  filterSaturation: z.number().min(0).max(2.2).default(0.95),
  filterGamma: z.number().min(0.5).max(1.8).default(1),
  overlayBlendMode: z.enum(["normal", "multiply", "screen", "overlay", "color"]).default("multiply"),
  overlayColorPreset: z.enum(["amber", "deepRed", "warmGray", "custom"]).default("amber"),
  overlayCustomColor: z
    .object({
      r: z.number().min(0).max(255),
      g: z.number().min(0).max(255),
      b: z.number().min(0).max(255)
    })
    .default({ r: 255, g: 96, b: 48 }),
  preserveLuminance: z.boolean().default(false),
  applyToMedia: z.boolean().default(false),
  excludeMedia: z.boolean().default(true),
  designMode: z.boolean().default(false),
  wakeTime: z.string().default("07:00"),
  sleepTime: z.string().default("23:00"),
  rampMinutes: z.number().min(10).max(180).default(60),
  reminderNotifications: z.boolean().default(true),
  audioCues: z.boolean().default(false),
  speechCues: z.boolean().default(false),
  webcamPostureOptIn: z.boolean().default(false),
  devBypassPremium: z.boolean().default(true),
  debugPanel: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
  apiBaseUrl: z.string().default(""),
  entitlementUrl: z.string().default(""),
  pairingExchangeUrl: z.string().default(""),
  pairingCodeCreateUrl: z.string().default(""),
  checkoutUrl: z.string().default(""),
  dashboardUrl: z.string().default(""),
  extensionToken: z.string().default(""),
  disabledDomains: z.array(z.string()).default([]),
  siteOverrides: z.record(z.string(), siteOverrideSchema).default({}),
  distractorDomains: z.array(z.string()).default(["youtube.com", "x.com", "reddit.com"]),
  cadence: cadenceSchema.default({})
});

export type HolmetaSettings = z.infer<typeof settingsSchema>;
export type ReminderType = z.infer<typeof reminderTypeSchema>;
export type CadenceMode = z.infer<typeof cadenceModeSchema>;
export type CadenceProfile = z.infer<typeof cadenceProfileSchema>;

export const entitlementSchema = z.object({
  active: z.boolean(),
  plan: z.string().nullable().optional(),
  renewsAt: z.string().nullable().optional(),
  checkedAt: z.string().nullable().optional(),
  features: entitlementFeaturesSchema.default({})
});

export type Entitlement = z.infer<typeof entitlementSchema>;
