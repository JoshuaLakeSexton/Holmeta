export type FilterPresetId =
  | "blueShieldMild"
  | "blueShieldStrong"
  | "blueShieldMax"
  | "nightWarmMild"
  | "nightWarmStrong"
  | "nightWarmMax"
  | "redNightStrong"
  | "redNightMax"
  | "redBlocker"
  | "grayscale"
  | "contrastGuard"
  | "migraineSafe";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "color";

export interface FilterPresetDefinition {
  id: FilterPresetId;
  label: string;
  group: "Mild" | "Strong" | "Max";
  channels: { r: number; g: number; b: number };
  overlay: { color: "amber" | "deepRed" | "warmGray"; blend: BlendMode; alpha: number };
}

export const FILTER_PRESETS: FilterPresetDefinition[] = [
  { id: "blueShieldMild", label: "Blue Shield (Mild)", group: "Mild", channels: { r: 1, g: 0.94, b: 0.56 }, overlay: { color: "amber", blend: "multiply", alpha: 0.12 } },
  { id: "blueShieldStrong", label: "Blue Shield (Strong)", group: "Strong", channels: { r: 1, g: 0.86, b: 0.3 }, overlay: { color: "amber", blend: "multiply", alpha: 0.2 } },
  { id: "blueShieldMax", label: "Blue Shield (Max)", group: "Max", channels: { r: 1, g: 0.74, b: 0.08 }, overlay: { color: "amber", blend: "multiply", alpha: 0.32 } },
  { id: "nightWarmMild", label: "Night Warm (Mild)", group: "Mild", channels: { r: 1, g: 0.9, b: 0.62 }, overlay: { color: "amber", blend: "multiply", alpha: 0.1 } },
  { id: "nightWarmStrong", label: "Night Warm (Strong)", group: "Strong", channels: { r: 1, g: 0.8, b: 0.3 }, overlay: { color: "amber", blend: "multiply", alpha: 0.18 } },
  { id: "nightWarmMax", label: "Night Warm (Max)", group: "Max", channels: { r: 1, g: 0.66, b: 0.08 }, overlay: { color: "amber", blend: "multiply", alpha: 0.3 } },
  { id: "redNightStrong", label: "Red Night (Strong)", group: "Strong", channels: { r: 1, g: 0.12, b: 0.04 }, overlay: { color: "deepRed", blend: "multiply", alpha: 0.48 } },
  { id: "redNightMax", label: "Red Night (Max)", group: "Max", channels: { r: 1, g: 0.04, b: 0.01 }, overlay: { color: "deepRed", blend: "multiply", alpha: 0.66 } },
  { id: "redBlocker", label: "Red Blocker", group: "Strong", channels: { r: 0.34, g: 1, b: 1 }, overlay: { color: "warmGray", blend: "screen", alpha: 0.08 } },
  { id: "grayscale", label: "Grayscale", group: "Strong", channels: { r: 1, g: 1, b: 1 }, overlay: { color: "warmGray", blend: "normal", alpha: 0 } },
  { id: "contrastGuard", label: "Contrast Guard", group: "Mild", channels: { r: 0.98, g: 0.97, b: 0.9 }, overlay: { color: "warmGray", blend: "multiply", alpha: 0.18 } },
  { id: "migraineSafe", label: "Migraine Safe", group: "Max", channels: { r: 1, g: 0.88, b: 0.24 }, overlay: { color: "warmGray", blend: "multiply", alpha: 0.36 } }
];

export function clampUnit(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function buildV2ColorMatrix(channels: { r: number; g: number; b: number }, intensity: number): number[] {
  const amt = clampUnit(intensity, 0, 1);
  return [
    1 - (1 - channels.r) * amt, 0, 0, 0, 0,
    0, 1 - (1 - channels.g) * amt, 0, 0, 0,
    0, 0, 1 - (1 - channels.b) * amt, 0, 0,
    0, 0, 0, 1, 0
  ];
}

export function matrixToStringV2(matrix: number[]): string {
  return matrix.map((value) => Number(value).toFixed(4)).join(" ");
}
