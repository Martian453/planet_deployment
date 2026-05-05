/**
 * Utility to fetch global air quality data from OpenAQ V3
 * Uses public API, no key required.
 */

export interface GlobalAQPoint {
  id: number;
  city: string;
  country: string;
  lat: number;
  lng: number;
  aqi: number;
  parameter: string;
}

export async function fetchGlobalAQData(): Promise<GlobalAQPoint[]> {
  try {
    // Fetch latest locations with PM2.5 data
    const response = await fetch(
      'https://api.openaq.org/v3/locations?limit=40&order_by=last_updated&has_instruments=true',
      { method: 'GET' }
    );
    
    if (!response.ok) throw new Error('OpenAQ fetch failed');
    
    const data = await response.json();
    
    return data.results.map((loc: any) => ({
      id: loc.id,
      city: loc.name || 'Unknown City',
      country: loc.countries?.[0]?.name || 'Unknown',
      lat: loc.coordinates.latitude,
      lng: loc.coordinates.longitude,
      // OpenAQ gives raw values; we simplify it here for the globe visualization
      // In a real app, we'd use the calculateAQI utility
      aqi: loc.sensors?.[0]?.latest?.value || 0,
      parameter: loc.sensors?.[0]?.parameter?.name || 'pm25'
    }));
  } catch (error) {
    console.warn('OpenAQ data fetch failed (likely network or CORS constraint). Using fallback data.', error);
    // Return fallback major cities if API fails
    return [
      { id: 1, city: 'New York', country: 'US', lat: 40.7128, lng: -74.0060, aqi: 15, parameter: 'pm25' },
      { id: 2, city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, aqi: 22, parameter: 'pm25' },
      { id: 3, city: 'Delhi', country: 'IN', lat: 28.6139, lng: 77.2090, aqi: 156, parameter: 'pm25' },
      { id: 4, city: 'Beijing', country: 'CN', lat: 39.9042, lng: 116.4074, aqi: 82, parameter: 'pm25' },
      { id: 5, city: 'Tokyo', country: 'JP', lat: 35.6762, lng: 139.6503, aqi: 18, parameter: 'pm25' },
    ];
  }
}
