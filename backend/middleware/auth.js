/**
 * Authentication Middleware
 * =========================
 * 
 * Two authentication modes:
 * 
 * 1. API Key — for edge devices (ESP32, Heltec LoRa Receiver)
 *    Provide via:  X-API-Key header  OR  ?key= query parameter
 *    Configured via:  DEVICE_API_KEY environment variable
 *
 * 2. Dashboard Token — for browser clients (Next.js dashboard)
 *    Provide via:  Authorization: Bearer <token> header
 *    Configured via:  DASHBOARD_TOKEN environment variable
 *
 * BACKWARDS COMPATIBILITY:
 *   If the corresponding env var is NOT set, auth is BYPASSED with a
 *   console warning. This ensures existing deployments keep working
 *   while new/production deployments can enforce auth by setting env vars.
 */

const DEVICE_API_KEY = process.env.DEVICE_API_KEY || null;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;

// Track whether we've already logged the warning (avoid console spam)
let deviceAuthWarned = false;
let dashboardAuthWarned = false;

/**
 * Middleware: Require a valid API key for device ingestion endpoints.
 * Used on: POST /api/push, POST /api/aqi
 */
function requireApiKey(req, res, next) {
    if (!DEVICE_API_KEY) {
        if (!deviceAuthWarned) {
            console.warn('⚠️  DEVICE_API_KEY not set — device authentication DISABLED. Set this env var in production!');
            deviceAuthWarned = true;
        }
        return next();
    }

    const key = req.headers['x-api-key'] || req.query.key;

    if (!key) {
        console.warn(`🚫 Auth rejected: Missing API key from ${req.ip} on ${req.method} ${req.path}`);
        return res.status(401).json({ error: 'Missing API key. Provide X-API-Key header or ?key= query parameter.' });
    }

    if (key !== DEVICE_API_KEY) {
        console.warn(`🚫 Auth rejected: Invalid API key from ${req.ip} on ${req.method} ${req.path}`);
        return res.status(403).json({ error: 'Invalid API key.' });
    }

    next();
}

const db = require('../db');

/**
 * Middleware: Require a valid bearer token for dashboard endpoints.
 * Used on: GET /api/borewells, GET /api/history/:id, POST /api/control, etc.
 */
function requireDashboardAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (!DASHBOARD_TOKEN) {
            if (!dashboardAuthWarned) {
                console.warn('⚠️  DASHBOARD_TOKEN not set — dashboard authentication DISABLED. Set this env var in production!');
                dashboardAuthWarned = true;
            }
            return next();
        }
        return res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Direct environment variable token match (fallback/automated requests)
    if (DASHBOARD_TOKEN && token === DASHBOARD_TOKEN) {
        return next();
    }

    // 2. Dynamic base64 token validation against users table
    try {
        const decoded = Buffer.from(token, 'base64').toString('ascii').split(':');
        const email = decoded[0];
        const password = decoded[1];

        if (!email || !password) {
            return res.status(403).json({ error: 'Invalid authentication credentials.' });
        }

        db.get('SELECT id, email, full_name FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
            if (err || !user) {
                return res.status(403).json({ error: 'Access denied: Invalid credentials or account unregistered.' });
            }
            req.user = user; // Bind user context
            next();
        });
    } catch (e) {
        return res.status(403).json({ error: 'Malformed access token.' });
    }
}

module.exports = { requireApiKey, requireDashboardAuth };
