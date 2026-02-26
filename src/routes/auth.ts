import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { setSession, clearSession, getSessionUser } from '../auth';
import { RowDataPacket } from 'mysql2';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, senha_hash, nome, tipo, ativo FROM usuarios WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user || !await bcrypt.compare(senha, user.senha_hash)) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }
    if (!user.ativo) {
      res.status(403).json({ error: 'Usuário inativo' });
      return;
    }

    const sessionUser = { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
    setSession(res, sessionUser);
    res.json({ user: sessionUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  clearSession(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }
  res.json({ user });
});

export default router;
