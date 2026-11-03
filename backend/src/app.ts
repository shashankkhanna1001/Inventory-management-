import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { getCorsOrigins, env } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import { requireAuth, requireRole } from './middleware/auth.middleware.js';
import { healthRouter } from './modules/health/health.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { assignmentsRouter } from './modules/assignments/assignments.routes.js';
import { requestsRouter } from './modules/requests/requests.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';

// ---------------------------------------------------------------------------
// Application factory
// ---------------------------------------------------------------------------

export function createApp(): express.Application {
  const app = express();

  // ── Security headers ────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = getCorsOrigins();
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman in development)
        if (!origin) {
          callback(null, true);
          return;
        }
        const isLocalOrLan =
          /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
            origin,
          );
        if (
          env.NODE_ENV === 'development' ||
          allowedOrigins.includes(origin) ||
          isLocalOrLan
        ) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} is not allowed`));
        }
      },
      credentials: true,
    }),
  );

  // ── Request parsing ───────────────────────────────────────────────────────
  // Increased to 25mb to accommodate base64-encoded device photos
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // ── Structured request logging ────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    },
  });
  app.use('/api', limiter);

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/inventory', requireAuth, inventoryRouter);
  app.use('/api/assignments', requireAuth, assignmentsRouter);
  app.use('/api/requests', requireAuth, requestsRouter);
  app.use('/api/audit', requireAuth, requireRole('Admin'), auditRouter);

  // ── 404 handler — must come after all routes ──────────────────────────────
  app.use(notFoundHandler);

  // ── Centralized error handler — must be last ──────────────────────────────
  app.use(errorHandler);

  return app;
}
