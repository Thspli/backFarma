import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, requireTipo } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

const fmt = (r: RowDataPacket) => ({ id: r.id, nome: r.nome, crm: r.crm, ubsId: r.ubs_id ?? null, createdAt: r.created_at });

router.get('/', async (_req, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM medicos ORDER BY nome ASC');
  res.json({ medicos: rows.map(fmt) });
});

router.post('/', requireTipo('farmaceutico','gerente','admin'), async (req: Request, res: Response) => {
  try {
    const { nome, crm, ubsId } = req.body;
    if (!nome || !crm) { res.status(400).json({ error: 'nome e crm são obrigatórios' }); return; }
    const [exist] = await pool.query<RowDataPacket[]>('SELECT id FROM medicos WHERE crm = ?', [crm]);
    if (exist.length) { res.status(400).json({ error: 'CRM já cadastrado' }); return; }
    await pool.query<ResultSetHeader>('INSERT INTO medicos (nome, crm, ubs_id) VALUES (?, ?, ?)', [nome, crm, ubsId?.trim() || null]);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM medicos ORDER BY created_at DESC LIMIT 1');
    res.status(201).json({ medico: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar médico' }); }
});

router.put('/:id', requireTipo('farmaceutico','gerente','admin'), async (req: Request, res: Response) => {
  try {
    const { nome, crm, ubsId } = req.body;
    const fields: string[] = []; const values: any[] = [];
    if (nome  != null) { fields.push('nome = ?');   values.push(nome); }
    if (crm   != null) { fields.push('crm = ?');    values.push(crm); }
    if (ubsId !== undefined) { fields.push('ubs_id = ?'); values.push(ubsId?.trim() || null); }
    if (!fields.length) { res.status(400).json({ error: 'Nenhum campo' }); return; }
    values.push(req.params.id);
    const [r] = await pool.query<ResultSetHeader>(`UPDATE medicos SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!r.affectedRows) { res.status(404).json({ error: 'Médico não encontrado' }); return; }
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM medicos WHERE id = ?', [req.params.id]);
    res.json({ medico: fmt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.delete('/:id', requireTipo('gerente','admin'), async (req: Request, res: Response) => {
  const [r] = await pool.query<ResultSetHeader>('DELETE FROM medicos WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) { res.status(404).json({ error: 'Médico não encontrado' }); return; }
  res.json({ success: true });
});

export default router;
