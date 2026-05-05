export type Breakpoint = {
    cLow: number;
    cHigh: number;
    iLow: number;
    iHigh: number;
};

// Pollutant definitions based on CPCB (India) National Air Quality Index standards
const BREAKPOINTS: Record<string, Breakpoint[]> = {
    pm25: [
        { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
        { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
        { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
        { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
        { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
        { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 },
    ],
    pm10: [
        { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
        { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
        { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
        { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
        { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
        { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
    ],
};

export function calculateSubIndex(concentration: number, pollutant: string): number {
    const breakpoints = BREAKPOINTS[pollutant];
    if (!breakpoints) return 0;

    const range = breakpoints.find(b => concentration >= b.cLow && concentration <= b.cHigh);

    if (!range) {
        if (concentration > breakpoints[breakpoints.length - 1].cHigh) return 500;
        return 0;
    }

    const slope = (range.iHigh - range.iLow) / (range.cHigh - range.cLow);
    const result = slope * (concentration - range.cLow) + range.iLow;

    return Math.round(result);
}

interface AQICalculatorInput {
    pm25: number;
    pm10: number;
}

export function calculateAQI(data: AQICalculatorInput): { aqi: number, category: string, dominant_pollutant: string } {
    const pm25Idx = calculateSubIndex(data.pm25, 'pm25');
    const pm10Idx = calculateSubIndex(data.pm10, 'pm10');
    
    const aqi = Math.max(pm25Idx, pm10Idx, 0);
    const dominant = pm25Idx >= pm10Idx ? "pm25" : "pm10";

    const getCategory = (v: number) => {
        if (v <= 50) return "Good";
        if (v <= 100) return "Satisfactory";
        if (v <= 200) return "Moderate";
        if (v <= 300) return "Poor";
        if (v <= 400) return "Very Poor";
        return "Severe";
    };

    return {
        aqi: aqi,
        category: getCategory(aqi),
        dominant_pollutant: dominant
    };
}
