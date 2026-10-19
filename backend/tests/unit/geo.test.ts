import { describe, it, expect } from '@jest/globals';
import { calculateHaversineDistance, isValidCoordinate } from '../../src/utils/geo';

describe('Geo & Haversine Utility', () => {
  describe('calculateHaversineDistance', () => {
    it('should return 0 meters for identical coordinates', () => {
      const lat = 28.6139;
      const lon = 77.209;
      const distance = calculateHaversineDistance(lat, lon, lat, lon);
      expect(distance).toBe(0);
    });

    it('should accurately calculate distance between known points', () => {
      // Point 1: Campus center (approx Connaught Place, New Delhi)
      const lat1 = 28.6315;
      const lon1 = 77.2167;
      // Point 2: India Gate (approx 2.3km away)
      const lat2 = 28.6129;
      const lon2 = 77.2295;

      const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
      // Distance is ~2390 meters
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2600);
    });

    it('should calculate small distances within a 150m geofence accurately', () => {
      // 0.0009 degrees latitude corresponds to approx 100 meters
      const lat1 = 28.613939;
      const lon1 = 77.209021;
      const lat2 = 28.614839;
      const lon2 = 77.209021;

      const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });
  });

  describe('isValidCoordinate', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinate(28.6139, 77.209)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it('should return false for out-of-bounds coordinates', () => {
      expect(isValidCoordinate(91, 77.209)).toBe(false);
      expect(isValidCoordinate(-91, 77.209)).toBe(false);
      expect(isValidCoordinate(28.6139, 181)).toBe(false);
      expect(isValidCoordinate(28.6139, -181)).toBe(false);
      expect(isValidCoordinate(NaN as any, 77.209)).toBe(false);
    });
  });
});
