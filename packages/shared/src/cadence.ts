import {
  type CadenceMode,
  type CadenceProfile,
  type ReminderType,
  cadenceProfileSchema,
  cadenceSchema,
  type HolmetaSettings,
  type Entitlement
} from "./schemas";

export const REMINDER_TYPES: ReminderType[] = [
  "eye",
  "movement",
  "posture",
  "hydration",
  "breathwork",
  "dailyAudit"
];

export interface TimelineEvent {
  reminder: ReminderType;
  at: number;
  label: string;
}

export interface CadenceNextOptions {
  lastTriggeredAt?: number;
  now?: Date;
}

export interface CadenceFeatureFlags {
  advancedCadence: boolean;
  workBlocks: boolean;
  timeWindows: boolean;
  multiProfiles: boolean;
  settingsSync: boolean;
  meetingAutoSuppression: boolean;
  advancedAnalytics: boolean;
}

const MINUTE_MS = 60_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function parseClock(clock: string): number {
  const [h = "0", m = "0"] = String(clock || "0:0").split(":");
  const hours = Number(h);
  const minutes = Number(m);
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

export function minutesSinceMidnight(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function inClockWindow(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

export function isWithinTimeWindows(
  windows: Array<{ start: string; end: string }> | undefined,
  date = new Date()
): boolean {
  const safe = windows || [];
  if (!safe.length) {
    return true;
  }
  const now = minutesSinceMidnight(date);
  return safe.some((windowDef) => inClockWindow(now, parseClock(windowDef.start), parseClock(windowDef.end)));
}

export function isQuietHours(
  quietHoursStart: string,
  quietHoursEnd: string,
  date = new Date()
): boolean {
  return inClockWindow(minutesSinceMidnight(date), parseClock(quietHoursStart), parseClock(quietHoursEnd));
}

function jitterOffsetMinutes(intervalMin: number, jitterMin: number, seed: number): number {
  const jitter = clamp(Number(jitterMin || 0), 0, 3);
  if (jitter === 0) {
    return Math.max(1, Math.round(intervalMin));
  }

  const randomFactor = Math.sin(seed * 0.001) * 10_000;
  const unit = randomFactor - Math.floor(randomFactor);
  const range = Math.round(jitter * 2);
  const centered = Math.round(unit * range) - Math.round(jitter);
  return Math.max(1, Math.round(intervalMin) + centered);
}

function alignToWindowStart(now: Date, startClock: string): number {
  const base = new Date(now);
  const [h = "0", m = "0"] = String(startClock || "09:00").split(":");
  base.setHours(Number(h), Number(m), 0, 0);
  if (base.getTime() < now.getTime()) {
    base.setDate(base.getDate() + 1);
  }
  return base.getTime();
}

function nextFromWindows(
  windows: Array<{ start: string; end: string }>,
  now: Date,
  intervalMin: number
): number {
  const nowMin = minutesSinceMidnight(now);
  const intervalMs = Math.max(1, intervalMin) * MINUTE_MS;

  for (const windowDef of windows) {
    const start = parseClock(windowDef.start);
    const end = parseClock(windowDef.end);

    if (inClockWindow(nowMin, start, end)) {
      return now.getTime() + intervalMs;
    }

    if (start > nowMin) {
      return alignToWindowStart(now, windowDef.start);
    }
  }

  return alignToWindowStart(now, windows[0]?.start || "09:00");
}

function nextFromWorkBlocks(
  workMin: number,
  breakMin: number,
  anchorClock: string,
  now: Date
): number {
  const safeWork = Math.max(15, Math.round(workMin));
  const safeBreak = Math.max(5, Math.round(breakMin));
  const cycleMin = safeWork + safeBreak;

  const anchor = new Date(now);
  const [h = "9", m = "0"] = String(anchorClock || "09:00").split(":");
  anchor.setHours(Number(h), Number(m), 0, 0);

  while (anchor.getTime() > now.getTime()) {
    anchor.setDate(anchor.getDate() - 1);
  }

  const elapsedMin = Math.floor((now.getTime() - anchor.getTime()) / MINUTE_MS);
  const cycleOffset = ((elapsedMin % cycleMin) + cycleMin) % cycleMin;

  if (cycleOffset >= safeWork) {
    return now.getTime() + MINUTE_MS;
  }

  const untilBreak = safeWork - cycleOffset;
  return now.getTime() + untilBreak * MINUTE_MS;
}

export function nextReminderAt(
  settings: HolmetaSettings,
  reminder: ReminderType,
  options: CadenceNextOptions = {}
): number | null {
  const cadence = cadenceSchema.parse(settings.cadence || {});
  const config = cadence.reminders[reminder];
  if (!config.enabled) {
    return null;
  }

  const now = options.now || new Date();
  const schedule = config.schedule;
  const lastAt = Number(options.lastTriggeredAt || 0);

  if (schedule.mode === "workBlocks") {
    return nextFromWorkBlocks(schedule.workMin, schedule.breakMin, schedule.anchorTime, now);
  }

  if (schedule.mode === "timeWindows") {
    return nextFromWindows(schedule.windows, now, schedule.intervalMin);
  }

  const minutes = jitterOffsetMinutes(
    Math.max(5, Math.round(schedule.intervalMin)),
    Math.round(schedule.jitterMin || 0),
    lastAt || now.getTime()
  );
  const base = lastAt > 0 ? Math.max(lastAt, now.getTime()) : now.getTime();
  return base + minutes * MINUTE_MS;
}

export function cadencePresetIds(): CadenceProfile[] {
  return cadenceProfileSchema.options;
}

export function cadenceFeaturesFromEntitlement(entitlement: Entitlement): CadenceFeatureFlags {
  const active = Boolean(entitlement.active);
  if (!active) {
    return {
      advancedCadence: false,
      workBlocks: false,
      timeWindows: false,
      multiProfiles: false,
      settingsSync: false,
      meetingAutoSuppression: false,
      advancedAnalytics: false
    };
  }

  const mapped = entitlement.features || {};
  return {
    advancedCadence: Boolean(mapped.advancedCadence ?? true),
    workBlocks: Boolean(mapped.workBlocks ?? true),
    timeWindows: Boolean(mapped.timeWindows ?? true),
    multiProfiles: Boolean(mapped.multiProfiles ?? true),
    settingsSync: Boolean(mapped.settingsSync ?? true),
    meetingAutoSuppression: Boolean(mapped.meetingAutoSuppression ?? true),
    advancedAnalytics: Boolean(mapped.advancedAnalytics ?? true)
  };
}

function timelineLabel(reminder: ReminderType): string {
  return {
    eye: "EYE",
    movement: "MOVE",
    posture: "POSTURE",
    hydration: "HYDRATE",
    breathwork: "BREATH",
    dailyAudit: "AUDIT"
  }[reminder];
}

export function buildTimelinePreview(
  settings: HolmetaSettings,
  startClock = "09:00",
  endClock = "18:00",
  now = new Date()
): TimelineEvent[] {
  const startMin = parseClock(startClock);
  const endMin = parseClock(endClock);

  const start = new Date(now);
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

  const end = new Date(now);
  end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  const events: TimelineEvent[] = [];

  for (const reminder of REMINDER_TYPES) {
    let cursor = start.getTime();
    let lastTriggered = 0;

    for (let i = 0; i < 8; i += 1) {
      const nextAt = nextReminderAt(settings, reminder, {
        lastTriggeredAt: lastTriggered || cursor,
        now: new Date(cursor)
      });

      if (!nextAt || nextAt > end.getTime()) {
        break;
      }

      lastTriggered = nextAt;
      cursor = nextAt + MINUTE_MS;
      events.push({
        reminder,
        at: nextAt,
        label: timelineLabel(reminder)
      });
    }
  }

  return events.sort((a, b) => a.at - b.at);
}
