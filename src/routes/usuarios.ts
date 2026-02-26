import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { requireAuth, requireTipo } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

const fmt = (r: RowDataPacket) => ({
  id: r.id, nome: r.nome, email: r.email, tipo: r.tipo, ativo: r.ativo,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// GET /api/usuarios
router.get('/', requireTipo('admin', 'gerente'), async (_req, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nome, email, tipo, ativo, created_at, updated_at FROM usuarios ORDER BY created_at DESC'
  );
  res.json({ usuarios: rows.map(fmt) });
});

// POST /api/usuarios
router.post('/', requireTipo('admin'), async (req: Request, res: Response) => {
  try {
    const { nome, email, senha, tipo } = req.body;
    if (!nome || !email || !senha) { res.status(400).json({ error: 'nome, email e senha são obrigatórios' }); return; }

    const [exist] = await pool.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (exist.length) { res.status(400).json({ error: 'Email já cadastrado' }); return; }

    const hash = await bcrypt.hash(senha, 10);
    await pool.query<ResultSetHeader>(
      'INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES (?, ?, ?, ?)',
      [nome, email, hash, tipo || 'funcionario']
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, nome, email, tipo, ativo, created_at, updated_at FROM usuarios WHERE email = ?', [email]
    );
    res.status(201).json({ usuario: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar usuário' }); }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (authUser.id !== req.params.id && authUser.tipo !== 'admin') {
    res.status(403).json({ error: 'Acesso negado' }); return;
  }
  try {
    const { nome, email, senha, tipo, ativo } = req.body;
    const fields: string[] = []; const values: any[] = [];
    if (nome  != null) { fields.push('nome = ?');  values.push(nome); }
    if (email != null) { fields.push('email = ?'); values.push(email); }
    if (tipo  != null && authUser.tipo === 'admin') { fields.push('tipo = ?'); values.push(tipo); }
    if (ativo != null && authUser.tipo === 'admin') { fields.push('ativo = ?'); values.push(ativo ? 1 : 0); }
    if (senha != null) { fields.push('senha_hash = ?'); values.push(await bcrypt.hash(senha, 10)); }
    if (!fields.length) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }

    values.push(req.params.id);
    const [r] = await pool.query<ResultSetHeader>(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!r.affectedRows) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, nome, email, tipo, ativo, created_at, updated_at FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ usuario: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar' }); }
});

// DELETE /api/usuarios/:id
router.delete('/:id', requireTipo('admin'), async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (authUser.id === req.params.id) { res.status(400).json({ error: 'Não é possível excluir o próprio usuário' }); return; }
  const [r] = await pool.query<ResultSetHeader>('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  res.json({ success: true });
});

export default router;
