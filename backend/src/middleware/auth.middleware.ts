import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';
import { authService } from '../modules/auth/auth.service.js';
import { AppError } from './error-handler.js';

// ---------------------------------------------------------------------------
// requireAuth — verifies Bearer JWT, attaches req.user
// ---------------------------------------------------------------------------

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }
  const token = authHeader.slice(7);
  try {
    req.user = authService.verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// requireRole — factory that checks req.user.role
// ---------------------------------------------------------------------------

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${roles.join(' or ')}`,
          403,
          'FORBIDDEN',
        ),
      );
    }
    next();
  };
}
