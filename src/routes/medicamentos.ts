import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth, requireTipo } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

// GET /api/medicamentos — usa vw_estoque + lotes
router.get('/', async (_req, res: Response) => {
  try {
    const [meds] = await pool.query<RowDataPacket[]>(`
      SELECT medicamento_id AS id, medicamento_nome AS nome, categoria,
             unidade_medida AS unidadeMedida, fabricante, disponivel,
             estoque_total AS estoqueTotal, total_lotes AS totalLotes
      FROM vw_estoque ORDER BY medicamento_nome ASC
    `);

    if (meds.length === 0) { res.json({ medicamentos: [] }); return; }

    const ids = meds.map((m) => m.id);
    const [lotes] = await pool.query<RowDataPacket[]>(
      `SELECT id, medicamento_id AS medicamentoId, nome_lote AS nomeLote,
              DATE_FORMAT(validade,'%Y-%m-%d') AS validade, quantidade
       FROM lotes WHERE medicamento_id IN (?) AND quantidade > 0 ORDER BY validade ASC`,
      [ids]
    );

    const lotesPorMed = new Map<string, any[]>();
    for (const l of lotes) {
      if (!lotesPorMed.has(l.medicamentoId)) lotesPorMed.set(l.medicamentoId, []);
      lotesPorMed.get(l.medicamentoId)!.push(l);
    }

    const medicamentos = meds.map((m) => ({ ...m, lotes: lotesPorMed.get(m.id) ?? [] }));
    res.json({ medicamentos });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar medicamentos' }); }
});

// GET /api/medicamentos/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.nome, m.categoria, m.unidade_medida AS unidadeMedida,
              m.fabricante, m.composicao, m.disponivel, m.created_at AS createdAt,
              l.id AS loteId, l.nome_lote AS nomeLote,
              DATE_FORMAT(l.validade,'%Y-%m-%d') AS validade, l.quantidade
       FROM medicamentos m
       LEFT JOIN lotes l ON l.medicamento_id = m.id AND l.quantidade > 0
       WHERE m.id = ? ORDER BY l.validade ASC`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'Medicamento não encontrado' }); return; }

    const f = rows[0];
    const med: any = {
      id: f.id, nome: f.nome, categoria: f.categoria, unidadeMedida: f.unidadeMedida,
      fabricante: f.fabricante, composicao: f.composicao, disponivel: f.disponivel,
      createdAt: f.createdAt, lotes: [],
    };
    for (const r of rows) {
      if (r.loteId) med.lotes.push({ id: r.loteId, nomeLote: r.nomeLote, validade: r.validade, quantidade: r.quantidade });
    }
    res.json({ medicamento: med });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar medicamento' }); }
});

const permMed = requireTipo('farmaceutico', 'gerente', 'admin');

// POST /api/medicamentos
router.post('/', permMed, async (req: Request, res: Response) => {
  try {
    const { nome, categoria, unidadeMedida, fabricante, composicao, disponivel } = req.body;
    if (!nome || !categoria || !unidadeMedida || !fabricante) {
      res.status(400).json({ error: 'Campos obrigatórios: nome, categoria, unidadeMedida, fabricante' }); return;
    }
    await pool.query<ResultSetHeader>(
      'INSERT INTO medicamentos (nome, categoria, unidade_medida, fabricante, composicao, disponivel) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, categoria, unidadeMedida, fabricante, composicao || null, disponivel !== false ? 1 : 0]
    );
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM medicamentos ORDER BY created_at DESC LIMIT 1');
    const m = rows[0];
    res.status(201).json({ medicamento: { id: m.id, nome: m.nome, categoria: m.categoria, unidadeMedida: m.unidade_medida, fabricante: m.fabricante, composicao: m.composicao, disponivel: m.disponivel, lotes: [] } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar medicamento' }); }
});

// PUT /api/medicamentos/:id
router.put('/:id', permMed, async (req: Request, res: Response) => {
  try {
    const b = req.body;
    const fields: string[] = []; const values: any[] = [];
    if (b.nome          != null) { fields.push('nome = ?');           values.push(b.nome); }
    if (b.categoria     != null) { fields.push('categoria = ?');       values.push(b.categoria); }
    if (b.unidadeMedida != null) { fields.push('unidade_medida = ?');  values.push(b.unidadeMedida); }
    if (b.fabricante    != null) { fields.push('fabricante = ?');      values.push(b.fabricante); }
    if (b.composicao    != null) { fields.push('composicao = ?');      values.push(b.composicao); }
    if (b.disponivel    != null) { fields.push('disponivel = ?');      values.push(b.disponivel ? 1 : 0); }
    if (!fields.length) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }

    values.push(req.params.id);
    const [r] = await pool.query<ResultSetHeader>(`UPDATE medicamentos SET ${fields.join(', ')} WHERE id = ?`, values);
    if (!r.affectedRows) { res.status(404).json({ error: 'Medicamento não encontrado' }); return; }

    // Retorna o medicamento atualizado com lotes
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.nome, m.categoria, m.unidade_medida AS unidadeMedida,
              m.fabricante, m.composicao, m.disponivel,
              l.id AS loteId, l.nome_lote AS nomeLote,
              DATE_FORMAT(l.validade,'%Y-%m-%d') AS validade, l.quantidade
       FROM medicamentos m
       LEFT JOIN lotes l ON l.medicamento_id = m.id AND l.quantidade > 0
       WHERE m.id = ? ORDER BY l.validade ASC`,
      [req.params.id]
    );
    const f = rows[0];
    const med: any = { id: f.id, nome: f.nome, categoria: f.categoria, unidadeMedida: f.unidadeMedida, fabricante: f.fabricante, composicao: f.composicao, disponivel: f.disponivel, lotes: [] };
    for (const row of rows) if (row.loteId) med.lotes.push({ id: row.loteId, nomeLote: row.nomeLote, validade: row.validade, quantidade: row.quantidade });
    res.json({ medicamento: med });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao atualizar' }); }
});

// DELETE /api/medicamentos/:id
router.delete('/:id', permMed, async (req: Request, res: Response) => {
  try {
    const [r] = await pool.query<ResultSetHeader>('DELETE FROM medicamentos WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) { res.status(404).json({ error: 'Medicamento não encontrado' }); return; }
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') { res.status(409).json({ error: 'Medicamento possui vendas associadas' }); return; }
    res.status(500).json({ error: 'Erro ao excluir' });
  }
});

// POST /api/medicamentos/:id/lotes
router.post('/:id/lotes', permMed, async (req: Request, res: Response) => {
  try {
    const { nomeLote, validade, quantidade } = req.body;
    if (!nomeLote || !validade || quantidade == null) {
      res.status(400).json({ error: 'Campos obrigatórios: nomeLote, validade, quantidade' }); return;
    }
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      res.status(400).json({ error: 'Quantidade deve ser inteiro maior que zero' }); return;
    }

    const [meds] = await pool.query<RowDataPacket[]>('SELECT id FROM medicamentos WHERE id = ?', [req.params.id]);
    if (!meds.length) { res.status(404).json({ error: 'Medicamento não encontrado' }); return; }

    await pool.query<ResultSetHeader>(
      'INSERT INTO lotes (medicamento_id, nome_lote, validade, quantidade) VALUES (?, ?, ?, ?)',
      [req.params.id, nomeLote, validade, quantidade]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, medicamento_id AS medicamentoId, nome_lote AS nomeLote,
              DATE_FORMAT(validade,'%Y-%m-%d') AS validade, quantidade
       FROM lotes WHERE medicamento_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );
    res.status(201).json({ lote: rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao adicionar lote' }); }
});

export default router;
