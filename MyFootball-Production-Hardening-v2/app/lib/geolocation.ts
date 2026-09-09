/**
 * Geographic Centroid & Geocoding Resolution Engine for Indian Grassroots Football
 * Resolves regional centroids and fallback coordinates when raw GPS telemetry is unavailable.
 */

export interface GeoCoordinate {
  latitude: string;
  longitude: string;
}

/**
 * Centroid coordinates for major Indian football cities and grassroots hubs.
 * Values calibrated to central football complexes / municipal centers.
 */
export const INDIAN_CITY_CENTROIDS: Record<string, { lat: number; lng: number; defaultPin: string }> = {
  mumbai: { lat: 18.9248, lng: 72.8286, defaultPin: "400001" }, // Cooperage Ground
  pune: { lat: 18.5204, lng: 73.8567, defaultPin: "411001" },
  delhi: { lat: 28.6139, lng: 77.2090, defaultPin: "110001" }, // Ambedkar Stadium area
  "new delhi": { lat: 28.6139, lng: 77.2090, defaultPin: "110001" },
  bengaluru: { lat: 12.9716, lng: 77.5946, defaultPin: "560001" }, // Bangalore Football Stadium
  bangalore: { lat: 12.9716, lng: 77.5946, defaultPin: "560001" },
  kolkata: { lat: 22.5726, lng: 88.3639, defaultPin: "700001" }, // Salt Lake / Maidan
  goa: { lat: 15.4909, lng: 73.8278, defaultPin: "403001" }, // Duler / Tilak Maidan
  panaji: { lat: 15.4909, lng: 73.8278, defaultPin: "403001" },
  margao: { lat: 15.2832, lng: 73.9862, defaultPin: "403601" },
  kochi: { lat: 9.9312, lng: 76.2673, defaultPin: "682001" }, // Jawaharlal Nehru Stadium
  cochin: { lat: 9.9312, lng: 76.2673, defaultPin: "682001" },
  kerala: { lat: 10.8505, lng: 76.2711, defaultPin: "680001" },
  kozhikode: { lat: 11.2588, lng: 75.7804, defaultPin: "673001" }, // EMS Stadium
  calicut: { lat: 11.2588, lng: 75.7804, defaultPin: "673001" },
  hyderabad: { lat: 17.3850, lng: 78.4867, defaultPin: "500001" }, // Gachibowli Stadium
  chennai: { lat: 13.0827, lng: 80.2707, defaultPin: "600001" }, // Jawaharlal Nehru Stadium
  chandigarh: { lat: 30.7333, lng: 76.7794, defaultPin: "160001" }, // Sector 17
  guwahati: { lat: 26.1445, lng: 91.7362, defaultPin: "781001" }, // Indira Gandhi Stadium
  shillong: { lat: 25.5788, lng: 91.8933, defaultPin: "793001" }, // JN Stadium Shillong
  ahmedabad: { lat: 23.0225, lng: 72.5714, defaultPin: "380001" }, // TransStadia
  jaipur: { lat: 26.9124, lng: 75.7873, defaultPin: "302001" },
  bhubaneswar: { lat: 20.2961, lng: 85.8245, defaultPin: "751001" }, // Kalinga Stadium
};

/**
 * Standard Indian centroid fallback (Mumbai Cooperage Ground).
 */
export const DEFAULT_INDIAN_CENTROID = {
  lat: 18.9248,
  lng: 72.8286,
  defaultPin: "400001",
};

/**
 * Resolves coordinate strings from supplied input, falling back to known city centroids or standard default.
 */
export function resolveCoordinates(
  rawLat?: unknown,
  rawLng?: unknown,
  city?: string,
  state?: string
): GeoCoordinate {
  const parsedLat = Number(rawLat);
  const parsedLng = Number(rawLng);

  const isValidLat = Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 && parsedLat !== 0;
  const isValidLng = Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180 && parsedLng !== 0;

  if (isValidLat && isValidLng) {
    return {
      latitude: parsedLat.toFixed(6),
      longitude: parsedLng.toFixed(6),
    };
  }

  // Lookup city centroid
  const normalizedCity = typeof city === "string" ? city.trim().toLowerCase() : "";
  if (normalizedCity && INDIAN_CITY_CENTROIDS[normalizedCity]) {
    const centroid = INDIAN_CITY_CENTROIDS[normalizedCity];
    return {
      latitude: centroid.lat.toFixed(6),
      longitude: centroid.lng.toFixed(6),
    };
  }

  // Lookup by state if city didn't match
  const normalizedState = typeof state === "string" ? state.trim().toLowerCase() : "";
  if (normalizedState && INDIAN_CITY_CENTROIDS[normalizedState]) {
    const centroid = INDIAN_CITY_CENTROIDS[normalizedState];
    return {
      latitude: centroid.lat.toFixed(6),
      longitude: centroid.lng.toFixed(6),
    };
  }

  // Final fallback
  return {
    latitude: DEFAULT_INDIAN_CENTROID.lat.toFixed(6),
    longitude: DEFAULT_INDIAN_CENTROID.lng.toFixed(6),
  };
}

/**
 * Resolves or standardizes a 6-digit Indian PIN code.
 */
export function resolvePostalCode(postalCode?: unknown, city?: string): string {
  const cleaned = typeof postalCode === "string" ? postalCode.trim() : "";
  if (/^\d{6}$/.test(cleaned)) {
    return cleaned;
  }
  const normalizedCity = typeof city === "string" ? city.trim().toLowerCase() : "";
  if (normalizedCity && INDIAN_CITY_CENTROIDS[normalizedCity]) {
    return INDIAN_CITY_CENTROIDS[normalizedCity].defaultPin;
  }
  return DEFAULT_INDIAN_CENTROID.defaultPin;
}
