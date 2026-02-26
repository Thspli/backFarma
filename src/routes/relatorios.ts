import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth } from '../auth';
import { RowDataPacket } from 'mysql2';

const router = Router();
router.use(requireAuth);

// GET /api/relatorios/medicamentos-mais-vendidos
router.get('/medicamentos-mais-vendidos', async (_req, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT vi.medicamento_id AS medicamentoId, m.nome AS medicamentoNome,
             SUM(vi.quantidade) AS quantidadeTotal, COUNT(DISTINCT vi.venda_id) AS numeroVendas
      FROM venda_itens vi JOIN medicamentos m ON m.id = vi.medicamento_id
      GROUP BY vi.medicamento_id, m.nome ORDER BY quantidadeTotal DESC LIMIT 20
    `);
    res.json({ medicamentos: rows.map(r => ({ ...r, quantidadeTotal: Number(r.quantidadeTotal), numeroVendas: Number(r.numeroVendas) })) });
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar relatório' }); }
});

// GET /api/relatorios/medicos-mais-prescreveram
router.get('/medicos-mais-prescreveram', async (_req, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT md.id AS medicoId, md.nome AS medicoNome, md.crm AS medicoCrm,
             u.nome AS ubsNome, COUNT(r.id) AS numeroReceitas
      FROM receitas r JOIN medicos md ON md.id = r.medico_id
      LEFT JOIN ubs u ON u.id = md.ubs_id
      WHERE r.medico_id IS NOT NULL
      GROUP BY md.id, md.nome, md.crm, u.nome ORDER BY numeroReceitas DESC LIMIT 20
    `);
    res.json({ medicos: rows.map(r => ({ ...r, numeroReceitas: Number(r.numeroReceitas) })) });
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar relatório' }); }
});

// GET /api/relatorios/atendimentos-por-funcionario
router.get('/atendimentos-por-funcionario', async (_req, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id AS usuarioId, u.nome AS usuarioNome, u.tipo AS usuarioTipo,
             COUNT(v.id) AS numeroAtendimentos
      FROM vendas v JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.usuario_id IS NOT NULL
      GROUP BY u.id, u.nome, u.tipo ORDER BY numeroAtendimentos DESC LIMIT 20
    `);
    res.json({ funcionarios: rows.map(r => ({ ...r, numeroAtendimentos: Number(r.numeroAtendimentos) })) });
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar relatório' }); }
});

// GET /api/relatorios/ubs-mais-pedidos
router.get('/ubs-mais-pedidos', async (_req, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id AS ubsId, u.nome AS ubsNome, u.endereco AS ubsEndereco, COUNT(r.id) AS numeroPedidos
      FROM receitas r JOIN ubs u ON u.id = r.ubs_id
      WHERE r.ubs_id IS NOT NULL
      GROUP BY u.id, u.nome, u.endereco ORDER BY numeroPedidos DESC LIMIT 20
    `);
    res.json({ ubs: rows.map(r => ({ ...r, numeroPedidos: Number(r.numeroPedidos) })) });
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar relatório' }); }
});

// GET /api/relatorios/estatisticas-estoque
router.get('/estatisticas-estoque', async (_req, res: Response) => {
  try {
    const [totais] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS quantidadeMedicamentos, COALESCE(SUM(estoque_total),0) AS quantidadeTotal FROM vw_estoque'
    );
    const [baixo] = await pool.query<RowDataPacket[]>(
      `SELECT medicamento_id AS id, medicamento_nome AS nome, categoria,
              unidade_medida AS unidadeMedida, estoque_total AS estoque
       FROM vw_estoque WHERE estoque_total < 10 ORDER BY estoque_total ASC`
    );
    const [vencendo] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, m.nome AS medicamentoNome, l.nome_lote AS nomeLote,
              DATE_FORMAT(l.validade,'%Y-%m-%d') AS validade, l.quantidade,
              DATEDIFF(l.validade, CURDATE()) AS diasParaVencer
       FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
       WHERE l.quantidade > 0 AND l.validade BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
       ORDER BY l.validade ASC LIMIT 20`
    );
    res.json({
      quantidadeMedicamentos:   Number(totais[0].quantidadeMedicamentos),
      quantidadeTotal:          Number(totais[0].quantidadeTotal),
      quantidadeEstoqueBaixo:   baixo.length,
      medicamentosEstoqueBaixo: baixo,
      lotesVencendo90Dias:      vencendo.map(l => ({ ...l, diasParaVencer: Number(l.diasParaVencer) })),
    });
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar estatísticas' }); }
});

export default router;
