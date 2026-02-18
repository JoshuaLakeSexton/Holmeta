export type FilterPreset = "neutral" | "blueBlocker" | "redBlocker" | "nightWarm";

export interface CircadianSchedule {
  wakeTime: string;
  sleepTime: string;
  rampMinutes: number;
}

const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function parseClock(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function withinWindow(now: number, start: number, end: number): boolean {
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

export function getPresetScales(preset: FilterPreset): { r: number; g: number; b: number } {
  switch (preset) {
    case "blueBlocker":
      return { r: 1, g: 0.92, b: 0.28 };
    case "redBlocker":
      return { r: 0.35, g: 1, b: 1 };
    case "nightWarm":
      return { r: 1, g: 0.78, b: 0.2 };
    default:
      return { r: 1, g: 1, b: 1 };
  }
}

export function circadianBoost(schedule: CircadianSchedule, date = new Date()): number {
  const wake = parseClock(schedule.wakeTime);
  const sleep = parseClock(schedule.sleepTime);
  const now = minutesOfDay(date);
  const ramp = Math.max(10, schedule.rampMinutes || 60);

  const windDownStart = (sleep - ramp + 1440) % 1440;
  const wakeRampEnd = (wake + ramp) % 1440;

  if (withinWindow(now, windDownStart, sleep)) {
    const delta = now >= windDownStart ? now - windDownStart : now + 1440 - windDownStart;
    return clamp(delta / ramp);
  }

  if (withinWindow(now, wake, wakeRampEnd)) {
    const delta = now >= wake ? now - wake : now + 1440 - wake;
    return clamp(1 - delta / ramp);
  }

  if (withinWindow(now, sleep, wake)) {
    return 1;
  }

  return 0;
}

export function buildColorMatrix(
  preset: FilterPreset,
  intensity: number,
  schedule?: CircadianSchedule,
  date = new Date()
): number[] {
  const base = getPresetScales(preset);
  const circadian = schedule ? circadianBoost(schedule, date) : 1;
  const effectiveIntensity = clamp(intensity) * (schedule ? 0.35 + circadian * 0.65 : 1);

  const matrix = IDENTITY.slice();
  matrix[0] = 1 - (1 - base.r) * effectiveIntensity;
  matrix[6] = 1 - (1 - base.g) * effectiveIntensity;
  matrix[12] = 1 - (1 - base.b) * effectiveIntensity;

  return matrix;
}

export function matrixToString(matrix: number[]): string {
  return matrix.map((n) => Number(n.toFixed(4))).join(" ");
}

export { clamp };
