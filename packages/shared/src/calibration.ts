export interface CalibrationSwatch {
  label: string;
  hex: string;
}

export const RGB_SWATCHES: CalibrationSwatch[] = [
  { label: "RED", hex: "#e30000" },
  { label: "GREEN", hex: "#00aa00" },
  { label: "BLUE", hex: "#0050ff" }
];

export const GRAYSCALE_STEPS: string[] = [
  "#000000",
  "#333333",
  "#666666",
  "#999999",
  "#cccccc",
  "#ffffff"
];

export const READABILITY_LINES: string[] = [
  "THE QUICK BROWN FOX JUMPS OVER 13 LAZY DOGS.",
  "Secondary text readability under heavy dimming."
];
