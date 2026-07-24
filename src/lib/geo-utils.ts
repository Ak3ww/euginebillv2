/**
 * Geodesic Distance & Technician Performance Score Utilities
 * EugineBill V2.0 — Haversine Formula & Gamified Rating Algorithm
 */

// Default Office Coordinates (EugineBill HQ Cibinong)
export const EUGINEBILL_HQ = {
  lat: -6.4805,
  lng: 106.8412,
  name: 'HQ EugineBill Cibinong',
};

/**
 * Calculates geodesic distance between two GPS points in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates geodesic distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(calculateDistanceKm(lat1, lon1, lat2, lon2) * 1000);
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export interface PerformanceRating {
  durationSeconds: number;
  formattedDuration: string;
  distOfficeToCustomerKm: number;
  distOdpToCustomerMeters: number;
  targetMinutes: number;
  score: number;
  stars: number;
  badge: string;
  rankTitle: string;
}

/**
 * Calculates Technician Performance Rating based on GPS Distance & Stopwatch Time
 */
export function calculateTechnicianScore(
  startTimeMs: number,
  endTimeMs: number,
  customerLat: number,
  customerLng: number,
  odpLat?: number | null,
  odpLng?: number | null,
  officeLat = EUGINEBILL_HQ.lat,
  officeLng = EUGINEBILL_HQ.lng
): PerformanceRating {
  const durationSeconds = Math.max(1, Math.round((endTimeMs - startTimeMs) / 1000));
  const durationMinutes = durationSeconds / 60;

  // 1. Distance Office to Customer (KM)
  const distOfficeToCustomerKm = parseFloat(
    calculateDistanceKm(officeLat, officeLng, customerLat, customerLng).toFixed(2)
  );

  // 2. Distance ODP to Customer (Meters)
  const distOdpToCustomerMeters =
    odpLat && odpLng
      ? calculateDistanceMeters(odpLat, odpLng, customerLat, customerLng)
      : 0;

  // Target Time Calculation:
  // Base 25 mins installation + 4 mins per KM traveled from office
  const travelAllowanceMins = distOfficeToCustomerKm * 4;
  const targetMinutes = Math.round(25 + travelAllowanceMins);

  // Score Calculation (Base 100)
  let score = 100;

  if (durationMinutes > targetMinutes) {
    // Penalty: -1.5 points per minute over target time
    const overage = durationMinutes - targetMinutes;
    score = Math.max(50, Math.round(100 - overage * 1.5));
  } else {
    // Bonus: +1 point per minute under target time (max 100)
    const under = targetMinutes - durationMinutes;
    score = Math.min(100, Math.round(100 + under * 0.5));
  }

  // Star Rating & Badge Classification
  let stars = 5;
  let badge = '🏆 SSS Rank';
  let rankTitle = 'Speedrunner Super Efisien';

  if (score >= 95) {
    stars = 5;
    badge = '⚡ SSS Rank';
    rankTitle = 'Speedrunner Kilat';
  } else if (score >= 85) {
    stars = 5;
    badge = '🥇 SS Rank';
    rankTitle = 'Sangat Cepat & Presisi';
  } else if (score >= 75) {
    stars = 4;
    badge = '🥈 S Rank';
    rankTitle = 'Teknisi Handal';
  } else if (score >= 65) {
    stars = 3;
    badge = '🥉 A Rank';
    rankTitle = 'Standar Prosedural';
  } else {
    stars = 2;
    badge = '🎗️ B Rank';
    rankTitle = 'Cukup Baik';
  }

  // Formatted duration (e.g. 24 Min 15 Detik)
  const hours = Math.floor(durationSeconds / 3600);
  const mins = Math.floor((durationSeconds % 3600) / 60);
  const secs = durationSeconds % 60;

  let formattedDuration = '';
  if (hours > 0) formattedDuration += `${hours} Jam `;
  formattedDuration += `${mins} Menit ${secs} Detik`;

  return {
    durationSeconds,
    formattedDuration,
    distOfficeToCustomerKm,
    distOdpToCustomerMeters,
    targetMinutes,
    score,
    stars,
    badge,
    rankTitle,
  };
}
