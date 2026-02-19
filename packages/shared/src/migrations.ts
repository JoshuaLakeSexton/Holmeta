import { settingsSchema, type HolmetaSettings } from "./schemas";

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  return input as Record<string, unknown>;
}

function toNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function migrateCadence(input: Record<string, unknown>): Record<string, unknown> {
  const existingCadence = asRecord(input.cadence);
  if (Object.keys(existingCadence).length > 0) {
    return existingCadence;
  }

  const reminderNotifications = toBoolean(input.reminderNotifications, true);
  const audioCues = toBoolean(input.audioCues, false);

  const baseDelivery = {
    overlay: true,
    notification: reminderNotifications,
    popupOnly: false,
    sound: audioCues,
    soundVolume: 0.25,
    gentle: false
  };

  return {
    version: 2,
    activeProfile: "balanced",
    global: {
      quietHoursStart: "22:30",
      quietHoursEnd: "07:30",
      suppressDuringFocus: true,
      suppressWhenIdle: true,
      meetingModeManual: false,
      meetingModeAuto: false,
      meetingDomains: ["meet.google.com", "zoom.us", "teams.microsoft.com"],
      panicUntilTs: 0,
      snoozeAllUntilTs: 0
    },
    reminders: {
      eye: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: toNumber(input.eyeBreakIntervalMin, 20),
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: baseDelivery,
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: true,
        escalateAfterIgnores: 3,
        exerciseDurationSec: 20,
        exerciseSet: "mixed"
      },
      movement: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 45,
          jitterMin: 1,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: baseDelivery,
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 15,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        suggestionRotation: true,
        promptType: "mixed"
      },
      posture: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: 40,
          jitterMin: 1,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: baseDelivery,
        snoozeMinutes: [5, 10, 15, 30],
        snoozeCustomMin: 15,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        stillnessMinutes: toNumber(input.stillnessThresholdMin, 50),
        slouchSensitivity: 0.45
      },
      hydration: {
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMin: toNumber(input.hydrationIntervalMin, 60),
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "09:00", end: "17:30" }]
        },
        delivery: baseDelivery,
        snoozeMinutes: [10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        dailyGoalGlasses: toNumber(input.hydrationGoalGlasses, 8),
        quietHoursOverride: false
      },
      breathwork: {
        enabled: true,
        schedule: {
          mode: "timeWindows",
          intervalMin: 120,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [
            { start: "10:30", end: "11:00" },
            { start: "15:30", end: "16:00" }
          ]
        },
        delivery: {
          ...baseDelivery,
          notification: false,
          gentle: true
        },
        snoozeMinutes: [10, 15, 30],
        snoozeCustomMin: 20,
        escalateIfIgnored: false,
        escalateAfterIgnores: 3,
        onDemandPresets: ["box", "478", "sigh"]
      },
      dailyAudit: {
        enabled: true,
        schedule: {
          mode: "timeWindows",
          intervalMin: 1440,
          jitterMin: 0,
          workMin: 50,
          breakMin: 10,
          anchorTime: "09:00",
          windows: [{ start: "17:00", end: "20:00" }]
        },
        delivery: {
          ...baseDelivery,
          notification: false,
          gentle: true
        },
        snoozeMinutes: [15, 30],
        snoozeCustomMin: 30,
        escalateIfIgnored: false,
        escalateAfterIgnores: 2,
        nudgeTime: "18:00",
        missedDayFallback: "nextMorning"
      }
    }
  };
}

export function migrateSettings(input: unknown): HolmetaSettings {
  const base = asRecord(input);
  const migrated = {
    ...base,
    settingsVersion: 2,
    cadence: migrateCadence(base)
  };

  return settingsSchema.parse(migrated);
}
