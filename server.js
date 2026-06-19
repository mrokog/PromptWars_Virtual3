const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_ecotrack_india_jwt_key';

// In-memory databases for the demo
const userProfiles = {};      // Keyed by user email/id
const emissionsDb = {};       // Keyed by user email/id (stores history lists)
const revokedTokens = new Set(); // Simple token blacklist

// 1. Security Headers Configuration (Helmet)
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://ajax.googleapis.com", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
  }
}));

// 2. Cross-Origin Resource Sharing
app.use(cors());

// 3. Request Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Parse JSON request payloads
app.use(express.json());

/**
 * Middleware: Verify JWT Authentication Token.
 *
 * @param {express.Request} req The Express request object.
 * @param {express.Response} res The Express response object.
 * @param {express.NextFunction} next The next middleware callback function.
 * @returns {void}
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized: Missing token.' });
    return;
  }

  if (revokedTokens.has(token)) {
    res.status(403).json({ success: false, error: 'Forbidden: Token is revoked.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ success: false, error: 'Forbidden: Invalid or expired token.' });
      return;
    }
    req.user = user;
    req.token = token;
    next();
  });
}

// 4. API ROUTES

/**
 * POST /api/auth/login
 * Validates request format, seeds in-memory mock data, and issues a JWT token.
 *
 * @name login
 * @path {POST} /api/auth/login
 * @body {string} email Valid email address.
 * @body {string} password Minimum 6 characters.
 * @returns {void}
 */
app.post(
  '/api/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid email or password format.' });
      return;
    }

    const { email } = req.body;
    
    // Issue token containing email payload
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });

    // Seed mock data for user if not exists
    if (!userProfiles[email]) {
      userProfiles[email] = {
        lang: 'en',
        state: 'Maharashtra',
        transitMode: 'rideshare',
        energySource: 'grid',
        monthlyOrders: '3-5',
        emailConnected: false,
        cloudConnected: false
      };
      emissionsDb[email] = [];
    }

    res.json({ success: true, data: { token, email } });
  }
);

/**
 * POST /api/auth/logout
 * Revokes the current active token by adding it to the blacklist.
 *
 * @name logout
 * @path {POST} /api/auth/logout
 * @header {string} authorization Authorization header with Bearer token.
 * @returns {void}
 */
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  revokedTokens.add(req.token);
  res.json({ success: true, data: { message: 'Logged out successfully.' } });
});

/**
 * GET /api/user/profile
 * Retrieves settings profile config for the authenticated user.
 *
 * @name getProfile
 * @path {GET} /api/user/profile
 * @header {string} authorization Authorization header.
 * @returns {void}
 */
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const profile = userProfiles[req.user.email] || {};
  res.json({ success: true, data: { profile } });
});

/**
 * PUT /api/user/profile
 * Updates settings profile configuration for the authenticated user.
 *
 * @name updateProfile
 * @path {PUT} /api/user/profile
 * @header {string} authorization Authorization header.
 * @body {Object} profile Profile payload object.
 * @returns {void}
 */
app.put(
  '/api/user/profile',
  authenticateToken,
  [
    body('profile').isObject()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid profile data payload.' });
      return;
    }

    const { profile } = req.body;
    userProfiles[req.user.email] = Object.assign({}, userProfiles[req.user.email], profile);

    res.json({ success: true, data: { profile: userProfiles[req.user.email] } });
  }
);

/**
 * POST /api/sync/emissions
 * Accepts aggregated, anonymized emissions data and logs it in-memory.
 *
 * @name syncEmissions
 * @path {POST} /api/sync/emissions
 * @header {string} authorization Authorization header.
 * @body {Object} emissions Anonymized aggregated emissions data.
 * @body {number} timestamp Timestamp of the sync.
 * @returns {void}
 */
app.post(
  '/api/sync/emissions',
  authenticateToken,
  [
    body('emissions').isObject(),
    body('timestamp').isNumeric()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Invalid emissions payload structure.' });
      return;
    }

    const { emissions, timestamp } = req.body;
    const email = req.user.email;

    if (!emissionsDb[email]) {
      emissionsDb[email] = [];
    }

    // Push aggregate metrics log
    emissionsDb[email].push({
      emissions,
      timestamp
    });

    res.json({ success: true, data: { message: 'Aggregated totals synced successfully.' } });
  }
);

/**
 * GET /api/sync/emissions
 * Returns historical aggregated emission totals.
 *
 * @name getSyncedEmissions
 * @path {GET} /api/sync/emissions
 * @header {string} authorization Authorization header.
 * @returns {void}
 */
app.get('/api/sync/emissions', authenticateToken, (req, res) => {
  const email = req.user.email;
  const history = emissionsDb[email] || [];
  
  // Return accumulated historical totals
  const totals = { commute: 0, purchase: 0, email: 0, cloud: 0 };
  history.forEach(item => {
    if (item.emissions) {
      totals.commute += item.emissions.commute || 0;
      totals.purchase += item.emissions.purchase || 0;
      totals.email += item.emissions.email || 0;
      totals.cloud += item.emissions.cloud || 0;
    }
  });

  res.json({ success: true, data: { totals, history } });
});

/**
 * POST /api/oauth/email
 * Simulates client receipt email sync authorization and token exchange.
 *
 * @name emailOauth
 * @path {POST} /api/oauth/email
 * @body {string} consent Explicit user consent validation string.
 * @returns {void}
 */
app.post(
  '/api/oauth/email',
  [
    body('consent').equals('true')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'User consent is required.' });
      return;
    }

    // Simulate OAuth access token exchange on backend side
    res.json({
      success: true,
      data: {
        accessToken: 'simulated_oauth_access_token_xyz123',
        expiresIn: 3600
      }
    });
  }
);

// Serve client-side static assets
app.use(express.static(path.join(__dirname, '/')));

// Serve index.html for all SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start express server listener
const server = app.listen(PORT, () => {
  console.log(`[EcoTrack India Backend] Server listening on port ${PORT}`);
});

module.exports = server; // Export for unit tests
