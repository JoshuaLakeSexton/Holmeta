export interface DailyLog {
  date: string;
  energy: number;
  mood: number;
  sleepQuality: number;
}

export function rollingAverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

export function summarizeDailyLogs(logs: DailyLog[]): {
  avgEnergy: number;
  avgMood: number;
  avgSleepQuality: number;
  score: number;
} {
  const energy = logs.map((log) => log.energy);
  const mood = logs.map((log) => log.mood);
  const sleep = logs.map((log) => log.sleepQuality);

  const avgEnergy = rollingAverage(energy);
  const avgMood = rollingAverage(mood);
  const avgSleepQuality = rollingAverage(sleep);
  const score = (avgEnergy + avgMood + avgSleepQuality) / 3;

  return {
    avgEnergy,
    avgMood,
    avgSleepQuality,
    score
  };
}
