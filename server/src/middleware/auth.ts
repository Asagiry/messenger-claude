import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-please-7421';

export interface AuthRequest extends Request {
  userId?: number;
}

export function signToken(userId: number): string {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: number };
    return decoded.uid;
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const uid = verifyToken(header.slice(7));
  if (!uid) return res.status(401).json({ error: 'Invalid token' });
  req.userId = uid;
  next();
}
