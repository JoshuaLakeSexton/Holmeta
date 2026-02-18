export interface TimeWindow {
  start: string;
  end: string;
}

export function parseTime(value: string): { hours: number; minutes: number } {
  const [h = "0", m = "0"] = value.split(":");
  return {
    hours: Number(h),
    minutes: Number(m)
  };
}

export function minutesFromTime(value: string): number {
  const { hours, minutes } = parseTime(value);
  return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
}

export function minutesUntil(targetTime: string, nowDate = new Date()): number {
  const now = nowDate.getHours() * 60 + nowDate.getMinutes();
  const target = minutesFromTime(targetTime);
  const delta = target - now;
  return delta >= 0 ? delta : delta + 1440;
}

export function inWindow(window: TimeWindow, nowDate = new Date()): boolean {
  const now = nowDate.getHours() * 60 + nowDate.getMinutes();
  const start = minutesFromTime(window.start);
  const end = minutesFromTime(window.end);

  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}
