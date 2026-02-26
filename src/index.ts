import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter       from './routes/auth';
import usuariosRouter   from './routes/usuarios';
import medicamentosRouter from './routes/medicamentos';
import medicosRouter    from './routes/medicos';
import ubsRouter        from './routes/ubs';
import receitasRouter   from './routes/receitas';
import vendasRouter     from './routes/vendas';
import relatoriosRouter from './routes/relatorios';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globais ───────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // necessário para enviar cookies
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/usuarios',     usuariosRouter);
app.use('/api/medicamentos', medicamentosRouter);
app.use('/api/medicos',      medicosRouter);
app.use('/api/ubs',          ubsRouter);
app.use('/api/receitas',     receitasRouter);
app.use('/api/vendas',       vendasRouter);
app.use('/api/relatorios',   relatoriosRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📋 Endpoints disponíveis em http://localhost:${PORT}/api`);
});

export default app;
