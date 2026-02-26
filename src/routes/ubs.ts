import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, requireTipo } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

const fmt = (r: RowDataPacket) => ({ id: r.id, nome: r.nome, endereco: r.endereco, createdAt: r.created_at });

router.get('/', async (_req, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM ubs ORDER BY nome ASC');
  res.json({ ubs: rows.map(fmt) });
});

router.post('/', requireTipo('gerente','admin'), async (req: Request, res: Response) => {
  try {
    const { nome, endereco } = req.body;
    if (!nome || !endereco) { res.status(400).json({ error: 'nome e endereco são obrigatórios' }); return; }
    await pool.query<ResultSetHeader>('INSERT INTO ubs (nome, endereco) VALUES (?, ?)', [nome, endereco]);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM ubs ORDER BY created_at DESC LIMIT 1');
    res.status(201).json({ ubs: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar UBS' }); }
});

router.put('/:id', requireTipo('gerente','admin'), async (req: Request, res: Response) => {
  try {
    const { nome, endereco } = req.body;
    const fields: string[] = []; const values: any[] = [];
    if (nome     != null) { fields.push('nome = ?');     values.push(nome); }
    if (endereco != null) { fields.push('endereco = ?'); values.push(endereco); }
    if (!fields.length) { res.status(400).json({ error: 'Nenhum campo' }); return; }
    values.push(req.params.id);
    const [r] = await pool.query<ResultSetHeader>(`UPDATE ubs SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!r.affectedRows) { res.status(404).json({ error: 'UBS não encontrada' }); return; }
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM ubs WHERE id = ?', [req.params.id]);
    res.json({ ubs: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.delete('/:id', requireTipo('admin'), async (req: Request, res: Response) => {
  const [r] = await pool.query<ResultSetHeader>('DELETE FROM ubs WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) { res.status(404).json({ error: 'UBS não encontrada' }); return; }
  res.json({ success: true });
});

export default router;
