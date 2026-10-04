export const MIN_DESKEW_ANGLE = -7;
export const MAX_DESKEW_ANGLE = 7;

export function clampDeskewAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_DESKEW_ANGLE, Math.min(MAX_DESKEW_ANGLE, Math.round(value * 4) / 4));
}

export function estimateDeskewAngle(
  luminance: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  if (width < 20 || height < 20 || luminance.length !== width * height) return 0;
  const threshold = otsuThreshold(luminance);
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 700));
  const points: Array<readonly [number, number]> = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const value = luminance[y * width + x];
      if (value !== undefined && value < threshold) points.push([x, y]);
    }
  }
  if (points.length < 80 || points.length > (width * height) / (stride * stride) * 0.65) return 0;

  const centerX = width / 2;
  const centerY = height / 2;
  let bestAngle = 0;
  let bestScore = projectionScore(points, centerX, centerY, height, 0);
  const zeroScore = bestScore;
  for (let angle = MIN_DESKEW_ANGLE; angle <= MAX_DESKEW_ANGLE; angle += 0.25) {
    if (angle === 0) continue;
    const score = projectionScore(points, centerX, centerY, height, angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  if (bestScore < zeroScore * 1.025 || Math.abs(bestAngle) < 0.4) return 0;
  return clampDeskewAngle(bestAngle);
}

function projectionScore(
  points: readonly (readonly [number, number])[],
  centerX: number,
  centerY: number,
  height: number,
  angle: number,
): number {
  const radians = angle * Math.PI / 180;
  const sine = Math.sin(radians);
  const cosine = Math.cos(radians);
  const bins = new Uint32Array(Math.ceil(height * 1.25));
  const offset = (bins.length - height) / 2;
  for (const [x, y] of points) {
    const rotatedY = (x - centerX) * sine + (y - centerY) * cosine + centerY + offset;
    const bin = Math.round(rotatedY);
    if (bin >= 0 && bin < bins.length) bins[bin] = (bins[bin] ?? 0) + 1;
  }
  let score = 0;
  for (let index = 1; index < bins.length; index += 1) {
    const difference = (bins[index] ?? 0) - (bins[index - 1] ?? 0);
    score += difference * difference;
  }
  return score;
}

function otsuThreshold(values: Uint8ClampedArray): number {
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (const value of values) {
    histogram[value] = (histogram[value] ?? 0) + 1;
    sum += value;
  }
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 180;
  for (let value = 0; value < 256; value += 1) {
    const count = histogram[value] ?? 0;
    backgroundWeight += count;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = values.length - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * count;
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return Math.min(225, Math.max(70, threshold));
}

