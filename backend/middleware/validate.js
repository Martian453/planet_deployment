/**
 * Input Validation Utilities
 * ===========================
 * 
 * Provides safe numeric parsing and range-checking for all sensor ingestion.
 * Replaces raw parseFloat() calls that could produce NaN.
 * 
 * AUDIT FIX: Finding 5.1, 5.2, 5.3, 5.4
 *   - No input validation on /api/push        (Critical)
 *   - No input validation on /api/aqi          (Critical)
 *   - No validation on /api/control            (High)
 *   - parseFloat() without NaN guard           (High)
 */

/**
 * Safely parse a value to a float. Returns `fallback` if the value
 * is undefined, null, NaN, Infinity, or not a number.
 * 
 * This replaces ALL raw parseFloat() calls in the ingestion pipeline.
 */
function safeFloat(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return fallback;
    return parsed;
}

/**
 * Physical range limits for every sensor metric.
 * Values outside these ranges indicate sensor malfunction or data corruption.
 */
const RANGES = {
    ph:          { min: 0,    max: 14     },
    tds:         { min: 0,    max: 5000   },  // ppm
    turbidity:   { min: 0,    max: 4000   },  // NTU
    water_level: { min: 0,    max: 100    },  // feet
    flow_rate:   { min: 0,    max: 500    },  // LPM
    current:     { min: 0,    max: 50     },  // Amps
    voltage:     { min: 0,    max: 500    },  // Volts
    pm25:        { min: 0,    max: 1000   },  // µg/m³
    pm10:        { min: 0,    max: 1000   },  // µg/m³
    co2:         { min: 0,    max: 10000  },  // ppm
    tvoc:        { min: 0,    max: 50     },  // mg/m³
    hcho:        { min: 0,    max: 10     },  // mg/m³
    temp:        { min: -40,  max: 80     },  // °C
    humidity:    { min: 0,    max: 100    },  // %
};

/**
 * Check if a value is within the acceptable range for a given metric.
 * Returns true if value is null (meaning "not provided") or within range.
 */
function inRange(value, metric) {
    if (value === null || value === undefined) return true;
    const range = RANGES[metric];
    if (!range) return true; // Unknown metric — allow
    return value >= range.min && value <= range.max;
}

/**
 * Clamp a value within the given range. Useful for derived/calculated values.
 */
function clampToRange(value, metric) {
    if (value === null || value === undefined) return value;
    const range = RANGES[metric];
    if (!range) return value;
    return Math.max(range.min, Math.min(range.max, value));
}

/**
 * Middleware: Validate water/borewell sensor payload.
 * Rejects payloads where critical numeric fields are non-numeric.
 * Allows partial payloads (sensors may send subsets of data).
 */
function validateWaterPayload(req, res, next) {
    const p = req.body;

    if (!p || typeof p !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }

    // Check that any provided numeric fields are actually numeric
    const numericFields = ['ph', 'tds', 'turbidity', 'wl', 'water_level', 'flow_rate', 'flow_lpm',
                           'flow', 'current', 'a', 'v', 'rt', 'total_liters'];
    const errors = [];

    for (const field of numericFields) {
        if (p[field] !== undefined && p[field] !== null) {
            const parsed = safeFloat(p[field]);
            if (parsed === null) {
                errors.push(`${field}: expected a number, got "${p[field]}"`);
            }
        }
    }

    if (errors.length > 0) {
        console.warn(`🚫 Validation rejected water payload: ${errors.join(', ')}`);
        return res.status(400).json({ error: 'Invalid numeric fields in water payload.', details: errors });
    }

    // Range checks on parsed values (warn but don't reject — sensor may be calibrating)
    const ph = safeFloat(p.ph);
    if (ph !== null && !inRange(ph, 'ph')) {
        console.warn(`⚠️  Out-of-range pH value: ${ph} (expected 0–14)`);
    }

    const tds = safeFloat(p.tds);
    if (tds !== null && !inRange(tds, 'tds')) {
        console.warn(`⚠️  Out-of-range TDS value: ${tds} (expected 0–5000 ppm)`);
    }

    next();
}

/**
 * Middleware: Validate AQI sensor payload.
 * Requires at least pm25 or pm10 to compute meaningful AQI.
 */
function validateAqiPayload(req, res, next) {
    const p = req.body;

    if (!p || typeof p !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object.' });
    }

    const numericFields = ['pm25', 'pm10', 'co2', 'tvoc', 'hcho', 'temp', 'humidity'];
    const errors = [];

    for (const field of numericFields) {
        if (p[field] !== undefined && p[field] !== null) {
            const parsed = safeFloat(p[field]);
            if (parsed === null) {
                errors.push(`${field}: expected a number, got "${p[field]}"`);
            }
        }
    }

    if (errors.length > 0) {
        console.warn(`🚫 Validation rejected AQI payload: ${errors.join(', ')}`);
        return res.status(400).json({ error: 'Invalid numeric fields in AQI payload.', details: errors });
    }

    // At least one particulate reading should be present for AQI calculation
    const pm25 = safeFloat(p.pm25);
    const pm10 = safeFloat(p.pm10);
    if (pm25 === null && pm10 === null) {
        console.warn('🚫 AQI rejected — missing pm25/pm10. Full normalized body:', JSON.stringify(p));
        return res.status(400).json({ error: 'AQI payload must include at least pm25 or pm10.' });
    }

    next();
}

/**
 * Middleware: Validate pump control payload.
 * Requires a valid borewell ID and ON/OFF command.
 */
function validateControlPayload(req, res, next) {
    const { id, command } = req.body || {};

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "id" field. Expected: BW-01, BW-02, or BW-03.' });
    }

    // Whitelist valid borewell IDs to prevent SQL injection and unauthorized access
    const validIds = ['BW-01', 'BW-02', 'BW-03'];
    if (!validIds.includes(id)) {
        return res.status(400).json({ error: `Invalid borewell ID "${id}". Valid IDs: ${validIds.join(', ')}` });
    }

    if (!command || !['ON', 'OFF'].includes(command)) {
        return res.status(400).json({ error: 'Missing or invalid "command" field. Expected: "ON" or "OFF".' });
    }

    next();
}

module.exports = {
    safeFloat,
    inRange,
    clampToRange,
    RANGES,
    validateWaterPayload,
    validateAqiPayload,
    validateControlPayload,
};
