import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

async function getReceita(id: string) {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM receitas WHERE id = ?', [id]);
  if (!rows.length) return null;
  const [meds] = await pool.query<RowDataPacket[]>('SELECT id, descricao FROM receita_medicamentos WHERE receita_id = ?', [id]);
  const r = rows[0];
  return {
    id: r.id, vendaId: r.venda_id ?? null, medicoId: r.medico_id ?? null, ubsId: r.ubs_id ?? null,
    pacienteNome: r.paciente_nome, observacoes: r.observacoes,
    fileUrl: r.file_url, fileName: r.file_name, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
    medicamentos: meds.map((m) => ({ id: m.id, descricao: m.descricao })),
  };
}

// GET /api/receitas
router.get('/', async (_req, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM receitas ORDER BY created_at DESC');
    const receitas = await Promise.all(rows.map((r) => getReceita(r.id)));
    res.json({ receitas });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar receitas' }); }
});

// POST /api/receitas
router.post('/', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const { medicoId, ubsId, vendaId, pacienteNome, observacoes, status, fileUrl, fileName, medicamentos } = req.body;
    await conn.beginTransaction();

    await conn.query<ResultSetHeader>(
      `INSERT INTO receitas (venda_id, medico_id, ubs_id, paciente_nome, observacoes, file_url, file_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendaId ?? null, medicoId ?? null, ubsId ?? null, pacienteNome ?? '', observacoes ?? '', fileUrl ?? null, fileName ?? null, status ?? 'pendente']
    );

    const [last] = await conn.query<RowDataPacket[]>('SELECT id FROM receitas ORDER BY created_at DESC LIMIT 1');
    const receitaId = last[0].id;

    if (Array.isArray(medicamentos) && medicamentos.length > 0) {
      const vals = medicamentos.map((d: string) => [receitaId, d]);
      await conn.query('INSERT INTO receita_medicamentos (receita_id, descricao) VALUES ?', [vals]);
    }

    await conn.commit();
    conn.release();
    const receita = await getReceita(receitaId);
    res.status(201).json({ receita });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error(err); res.status(500).json({ error: 'Erro ao criar receita' });
  }
});

// PUT /api/receitas/:id
router.put('/:id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const { medicoId, ubsId, pacienteNome, observacoes, status, fileUrl, fileName, medicamentos } = req.body;
    await conn.beginTransaction();

    const fields: string[] = []; const values: any[] = [];
    if (medicoId     !== undefined) { fields.push('medico_id = ?');     values.push(medicoId ?? null); }
    if (ubsId        !== undefined) { fields.push('ubs_id = ?');        values.push(ubsId ?? null); }
    if (pacienteNome !== undefined) { fields.push('paciente_nome = ?'); values.push(pacienteNome); }
    if (observacoes  !== undefined) { fields.push('observacoes = ?');   values.push(observacoes); }
    if (status       !== undefined) { fields.push('status = ?');        values.push(status); }
    if (fileUrl      !== undefined) { fields.push('file_url = ?');      values.push(fileUrl ?? null); }
    if (fileName     !== undefined) { fields.push('file_name = ?');     values.push(fileName ?? null); }

    if (fields.length) {
      values.push(req.params.id);
      const [r] = await conn.query<ResultSetHeader>(`UPDATE receitas SET ${fields.join(', ')} WHERE id = ?`, values);
      if (!r.affectedRows) { await conn.rollback(); conn.release(); res.status(404).json({ error: 'Receita não encontrada' }); return; }
    }

    if (Array.isArray(medicamentos)) {
      await conn.query('DELETE FROM receita_medicamentos WHERE receita_id = ?', [req.params.id]);
      if (medicamentos.length) {
        await conn.query('INSERT INTO receita_medicamentos (receita_id, descricao) VALUES ?', [medicamentos.map((d: string) => [req.params.id, d])]);
      }
    }

    await conn.commit(); conn.release();
    res.json({ receita: await getReceita(req.params.id) });
  } catch (err) {
    await conn.rollback(); conn.release();
    console.error(err); res.status(500).json({ error: 'Erro ao atualizar receita' });
  }
});

export default router;
