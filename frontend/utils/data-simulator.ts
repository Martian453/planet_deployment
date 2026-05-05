/**
 * Centralized Data Simulation Engine
 * Handles waveform generation and linked physics (motor status vs water level)
 */

export type TimeRange = "1h" | "24h" | "7d";

/**
 * Generates a synthetic time-series waveform based on a base value and time range.
 * Range impacts "waviness" (noise frequency and amplitude).
 */
export function generateWaveform(
  baseValue: number,
  range: TimeRange,
  options: {
    volatility?: number; // 0 to 1 scaling factor for noise
    spikes?: boolean;    // Whether to include random spikes
    trend?: "flat" | "up" | "down";
  } = {}
): number[] {
  const { volatility = 1, spikes = false, trend = "flat" } = options;
  
  // Number of points to generate
  const points = range === "1h" ? 20 : range === "24h" ? 100 : 300;
  
  // Waviness parameters
  let mainWaveAmplitude = 0;
  let noiseAmplitude = 0;
  let frequency = 0;
  
  if (range === "1h") {
    // Steady line
    mainWaveAmplitude = baseValue * 0.01 * volatility;
    noiseAmplitude = baseValue * 0.005 * volatility;
    frequency = 0.05;
  } else if (range === "24h") {
    // Gentle waves (sinusoidal)
    mainWaveAmplitude = baseValue * 0.08 * volatility;
    noiseAmplitude = baseValue * 0.02 * volatility;
    frequency = 0.1;
  } else {
    // Multi-frequency waves (7d)
    mainWaveAmplitude = baseValue * 0.15 * volatility;
    noiseAmplitude = baseValue * 0.05 * volatility;
    frequency = 0.3;
  }

  const result: number[] = [];
  let currentVal = baseValue;

  for (let i = 0; i < points; i++) {
    // 1. Sinusoidal base wave
    const wave = Math.sin(i * frequency) * mainWaveAmplitude;
    
    // 2. High-frequency noise
    const noise = (Math.random() - 0.5) * noiseAmplitude;
    
    // 3. Trend component
    let trendOffset = 0;
    if (trend === "up") trendOffset = (i / points) * (baseValue * 0.2);
    if (trend === "down") trendOffset = -(i / points) * (baseValue * 0.2);
    
    // 4. Random spikes (if enabled)
    let spike = 0;
    if (spikes && Math.random() < 0.02) {
       spike = (Math.random() - 0.5) * baseValue * 0.4;
    }
    
    let nextPoint = baseValue + wave + noise + trendOffset + spike;
    
    // Ensure no negative values for most environmental metrics
    nextPoint = Math.max(nextPoint, baseValue * 0.1);
    
    result.push(nextPoint);
  }

  return result;
}

/**
 * Simulation logic for Water Level vs Motor Status
 * Level drops when motor is ON, slowly rises (recharge) when OFF.
 */
export function calculateNextWaterLevel(
  currentLevel: number,
  isMotorOn: boolean,
  options: {
    extractionRate?: number;
    rechargeRate?: number;
    maxLevel?: number;
    minLevel?: number;
  } = {}
): number {
  const {
    extractionRate = 0.08, // ft per tick
    rechargeRate = 0.03,   // ft per tick
    maxLevel = 15.0,
    minLevel = 0.5
  } = options;

  let nextLevel = currentLevel;

  if (isMotorOn) {
    nextLevel -= extractionRate * (1 + Math.random() * 0.5);
  } else {
    // Natural recharge happens when pump is off
    nextLevel += rechargeRate * (1 + Math.random() * 0.3);
  }

  // Clamp values
  return Math.min(Math.max(nextLevel, minLevel), maxLevel);
}

/**
 * Generate synthetic historical data for water parameters
 */
export function generateWaterHistory(
  baseValues: { level: number; ph: number; tds: number },
  range: TimeRange,
  isMotorOn: boolean,
  count: number,
  labels: string[]
) {
  // Level follows motor physics
  const levelArr = generateWaveform(baseValues.level, range, {
    volatility: 0.6,
    trend: isMotorOn ? "down" : "up"
  });

  // pH and TDS follow random drift with different volatility
  const phArr = generateWaveform(baseValues.ph, range, {
    volatility: 0.3
  });

  const tdsArr = generateWaveform(baseValues.tds, range, {
    volatility: 0.8,
    spikes: range === "7d"
  }).map(val => Math.min(val, 9.9));

  // Truncate/pad to exact count if needed
  return {
    labels: labels.slice(0, count),
    level: levelArr.slice(0, count),
    ph: phArr.slice(0, count),
    tds: tdsArr.slice(0, count),
  };
}

/**
 * Helper to generate a timestamp label array
 */
export function generateTimeLabels(range: TimeRange, count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  
  // 1h: 3 min interval
  // 24h: 15 min interval
  // 7d: 30 min interval
  const subMinutes = range === "1h" ? 3 : range === "24h" ? 15 : 30;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * subMinutes * 60000);
    labels.push(d.toISOString());
  }
  return labels;
}

