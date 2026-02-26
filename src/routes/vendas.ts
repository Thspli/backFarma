import { Router, Request, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();
router.use(requireAuth);

// GET /api/vendas
router.get('/', async (_req, res: Response) => {
  try {
    const [vendas] = await pool.query<RowDataPacket[]>(
      `SELECT v.*, u.nome AS usuario_nome
       FROM vendas v LEFT JOIN usuarios u ON u.id = v.usuario_id
       ORDER BY v.created_at DESC`
    );

    const resultado = await Promise.all(vendas.map(async (v) => {
      const [itens] = await pool.query<RowDataPacket[]>(
        `SELECT vi.id, vi.medicamento_id AS medicamentoId, vi.quantidade,
                m.nome AS medicamentoNome, m.unidade_medida AS unidadeMedida
         FROM venda_itens vi JOIN medicamentos m ON m.id = vi.medicamento_id
         WHERE vi.venda_id = ?`,
        [v.id]
      );
      return {
        id: v.id, usuarioId: v.usuario_id, usuarioNome: v.usuario_nome,
        pacienteNome: v.paciente_nome, pacienteCpf: v.paciente_cpf,
        pacienteTelefone: v.paciente_telefone, createdAt: v.created_at,
        itens,
      };
    }));

    res.json({ vendas: resultado });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao buscar vendas' }); }
});

// POST /api/vendas
router.post('/', async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const conn = await pool.getConnection();

  try {
    const { itens, pacienteNome, pacienteCpf, pacienteTelefone, receita } = req.body;

    if (!Array.isArray(itens) || !itens.length) {
      conn.release(); res.status(400).json({ error: 'Itens da venda são obrigatórios' }); return;
    }

    await conn.beginTransaction();

    // 1. Cria a venda
    await conn.query<ResultSetHeader>(
      'INSERT INTO vendas (usuario_id, paciente_nome, paciente_cpf, paciente_telefone) VALUES (?, ?, ?, ?)',
      [authUser.id, pacienteNome ?? null, pacienteCpf ?? null, pacienteTelefone ?? null]
    );

    const [lastVenda] = await conn.query<RowDataPacket[]>('SELECT id FROM vendas ORDER BY created_at DESC LIMIT 1');
    const vendaId = lastVenda[0].id;

    // 2. Para cada item: chama sp_venda_fifo e insere em venda_itens
    for (const item of itens) {
      if (!item.medicamentoId || !item.quantidade) {
        await conn.rollback(); conn.release();
        res.status(400).json({ error: 'Cada item precisa de medicamentoId e quantidade' }); return;
      }

      // Chama a Stored Procedure FIFO do schema
      await conn.query('CALL sp_venda_fifo(?, ?, @sucesso, @mensagem)', [item.medicamentoId, item.quantidade]);
      const [[sp]] = await conn.query<RowDataPacket[]>('SELECT @sucesso AS sucesso, @mensagem AS mensagem');

      if (!sp.sucesso) {
        await conn.rollback(); conn.release();
        res.status(400).json({ error: sp.mensagem || 'Estoque insuficiente' }); return;
      }

      await conn.query<ResultSetHeader>(
        'INSERT INTO venda_itens (venda_id, medicamento_id, quantidade) VALUES (?, ?, ?)',
        [vendaId, item.medicamentoId, item.quantidade]
      );
    }

    // 3. Cria receita automaticamente se enviada
    if (receita) {
      await conn.query<ResultSetHeader>(
        `INSERT INTO receitas (venda_id, medico_id, ubs_id, paciente_nome, observacoes, file_url, file_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'entregue')`,
        [vendaId, receita.medicoId ?? null, receita.ubsId ?? null, pacienteNome ?? '', receita.observacoes ?? '', receita.fileUrl ?? null, receita.fileName ?? null]
      );

      if (Array.isArray(receita.medicamentos) && receita.medicamentos.length) {
        const [lastRec] = await conn.query<RowDataPacket[]>('SELECT id FROM receitas ORDER BY created_at DESC LIMIT 1');
        const recId = lastRec[0].id;
        await conn.query('INSERT INTO receita_medicamentos (receita_id, descricao) VALUES ?', [receita.medicamentos.map((d: string) => [recId, d])]);
      }
    }

    await conn.commit(); conn.release();

    // Busca venda completa para retornar
    const [vendaRows] = await pool.query<RowDataPacket[]>('SELECT * FROM vendas WHERE id = ?', [vendaId]);
    const [itensRows] = await pool.query<RowDataPacket[]>(
      `SELECT vi.id, vi.medicamento_id AS medicamentoId, vi.quantidade,
              m.nome AS medicamentoNome, m.unidade_medida AS unidadeMedida
       FROM venda_itens vi JOIN medicamentos m ON m.id = vi.medicamento_id
       WHERE vi.venda_id = ?`, [vendaId]
    );

    res.status(201).json({
      venda: { id: vendaId, usuarioId: authUser.id, ...vendaRows[0], itens: itensRows }
    });
  } catch (err: any) {
    await conn.rollback(); conn.release();
    console.error(err); res.status(500).json({ error: err.message || 'Erro ao finalizar venda' });
  }
});

export default router;
