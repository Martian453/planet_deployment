'use strict';
/**
 * Shared runtime configuration
 * =============================
 * Centralises secrets so they are generated ONCE per process — preventing
 * a split-brain situation where server.js and auth.js hold different random
 * secrets and tokens fail to verify.
 *
 * SESSION_SECRET:
 *   - In production: set SESSION_SECRET in Render env vars.
 *   - If not set: a cryptographically random secret is generated at startup.
 *     ⚠ This means all sessions are invalidated on every server restart.
 *     Fine for development, NOT ideal for production — set the env var.
 */
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET
  ? process.env.SESSION_SECRET
  : (() => {
      const rand = crypto.randomBytes(32).toString('hex');
      console.warn('⚠️  SESSION_SECRET not set — generated ephemeral secret.');
      console.warn('   All sessions will be invalidated on server restart.');
      console.warn('   Set SESSION_SECRET in Render → Environment to fix this.');
      return rand;
    })();

module.exports = { SESSION_SECRET };
