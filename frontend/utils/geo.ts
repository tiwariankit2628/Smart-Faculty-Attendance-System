/**
 * Earth radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates Great-Circle distance between two coordinates using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10; // Round to 1 decimal place
}

/**
 * Checks if point is inside a polygon using Ray-Casting algorithm
 */
export function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  let inside = false;
  const { latitude: x, longitude: y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Formats distance into human-friendly representation
 */
export function formatDistance(meters: number): string {
  if (meters < 1) return 'Within zone (<1m)';
  if (meters < 1000) return `${Math.round(meters)} meters`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Returns descriptive signal strength category based on GPS accuracy in meters
 */
export function getGpsAccuracyStatus(accuracyMeters: number): {
  label: string;
  isAcceptable: boolean;
  color: 'emerald' | 'amber' | 'rose';
} {
  if (accuracyMeters <= 15) {
    return { label: `High Precision (±${Math.round(accuracyMeters)}m)`, isAcceptable: true, color: 'emerald' };
  }
  if (accuracyMeters <= 30) {
    return { label: `Moderate Precision (±${Math.round(accuracyMeters)}m)`, isAcceptable: true, color: 'emerald' };
  }
  if (accuracyMeters <= 60) {
    return { label: `Low Precision (±${Math.round(accuracyMeters)}m)`, isAcceptable: false, color: 'amber' };
  }
  return { label: `Unreliable GPS (±${Math.round(accuracyMeters)}m)`, isAcceptable: false, color: 'rose' };
}
