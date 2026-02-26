import { Request, Response, NextFunction } from 'express';

export interface SessionUser {
  id:    string;
  nome:  string;
  email: string;
  tipo:  string;
}

const COOKIE_NAME = 'farmacia_session';

export function setSession(res: Response, user: SessionUser): void {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64');
  res.cookie(COOKIE_NAME, payload, {
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000, // 8h em ms
    sameSite: 'lax',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

export function getSessionUser(req: Request): SessionUser | null {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) return null;
  try {
    return JSON.parse(Buffer.from(cookie, 'base64').toString('utf8')) as SessionUser;
  } catch {
    return null;
  }
}

// Middleware: exige sessão ativa
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  (req as any).user = user;
  next();
}

// Middleware: exige tipos específicos
export function requireTipo(...tipos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as SessionUser;
    if (!tipos.includes(user.tipo)) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
}
