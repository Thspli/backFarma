-- ============================================================
-- SCHEMA MySQL - Sistema de Farmácia
-- ============================================================

CREATE DATABASE IF NOT EXISTS farmacia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE farmacia;

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE usuarios (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  email       VARCHAR(255) NOT NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  nome        VARCHAR(255) NOT NULL,
  tipo        ENUM('funcionario','farmaceutico','gerente','admin') NOT NULL DEFAULT 'funcionario',
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuário admin padrão (senha: admin123)
INSERT INTO usuarios (id, email, senha_hash, nome, tipo)
VALUES (
  'admin-1',
  'admin@farmacia.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Administrador',
  'admin'
);

-- ============================================================
-- TABELA: ubs
-- ============================================================
CREATE TABLE ubs (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  nome        VARCHAR(255) NOT NULL,
  endereco    VARCHAR(500) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: medicos
-- ============================================================
CREATE TABLE medicos (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  nome        VARCHAR(255) NOT NULL,
  crm         VARCHAR(50)  NOT NULL,
  ubs_id      VARCHAR(36)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_medicos_crm (crm),
  CONSTRAINT fk_medicos_ubs
    FOREIGN KEY (ubs_id) REFERENCES ubs(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: medicamentos
-- ============================================================
CREATE TABLE medicamentos (
  id              VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  nome            VARCHAR(255)  NOT NULL,
  categoria       VARCHAR(100)  NOT NULL,
  unidade_medida  VARCHAR(50)   NOT NULL,
  fabricante      VARCHAR(255)  NOT NULL,
  composicao      TEXT          NULL,
  disponivel      TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_medicamentos_nome (nome),
  KEY idx_medicamentos_categoria (categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: lotes
-- ============================================================
CREATE TABLE lotes (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  medicamento_id   VARCHAR(36)  NOT NULL,
  nome_lote        VARCHAR(100) NOT NULL,
  validade         DATE         NOT NULL,
  quantidade       INT          NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_lotes_medicamento (medicamento_id),
  KEY idx_lotes_validade (validade),
  CONSTRAINT fk_lotes_medicamento
    FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: vendas
-- ============================================================
CREATE TABLE vendas (
  id                VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  usuario_id        VARCHAR(36)  NULL,
  paciente_nome     VARCHAR(255) NULL,
  paciente_cpf      VARCHAR(14)  NULL,
  paciente_telefone VARCHAR(20)  NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_vendas_usuario (usuario_id),
  KEY idx_vendas_created_at (created_at),
  CONSTRAINT fk_vendas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: venda_itens
-- ============================================================
CREATE TABLE venda_itens (
  id              VARCHAR(36) NOT NULL DEFAULT (UUID()),
  venda_id        VARCHAR(36) NOT NULL,
  medicamento_id  VARCHAR(36) NOT NULL,
  quantidade      INT         NOT NULL CHECK (quantidade > 0),

  PRIMARY KEY (id),
  KEY idx_venda_itens_venda (venda_id),
  KEY idx_venda_itens_medicamento (medicamento_id),
  CONSTRAINT fk_venda_itens_venda
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_venda_itens_medicamento
    FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: receitas
-- ============================================================
CREATE TABLE receitas (
  id              VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  venda_id        VARCHAR(36)  NULL,
  medico_id       VARCHAR(36)  NULL,
  ubs_id          VARCHAR(36)  NULL,
  paciente_nome   VARCHAR(255) NULL,
  observacoes     TEXT         NULL,
  file_url        VARCHAR(500) NULL,
  file_name       VARCHAR(255) NULL,
  status          ENUM('pendente','entregue','cancelada') NOT NULL DEFAULT 'pendente',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_receitas_medico (medico_id),
  KEY idx_receitas_ubs (ubs_id),
  KEY idx_receitas_venda (venda_id),
  KEY idx_receitas_status (status),
  CONSTRAINT fk_receitas_venda
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_receitas_medico
    FOREIGN KEY (medico_id) REFERENCES medicos(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_receitas_ubs
    FOREIGN KEY (ubs_id) REFERENCES ubs(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABELA: receita_medicamentos
-- Itens de texto livre de cada receita
-- ============================================================
CREATE TABLE receita_medicamentos (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  receita_id  VARCHAR(36)  NOT NULL,
  descricao   VARCHAR(500) NOT NULL,

  PRIMARY KEY (id),
  KEY idx_receita_med_receita (receita_id),
  CONSTRAINT fk_receita_med_receita
    FOREIGN KEY (receita_id) REFERENCES receitas(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- VIEW: vw_estoque
-- Estoque atual por medicamento (soma dos lotes ativos)
-- ============================================================
CREATE OR REPLACE VIEW vw_estoque AS
SELECT
  m.id              AS medicamento_id,
  m.nome            AS medicamento_nome,
  m.categoria,
  m.unidade_medida,
  m.fabricante,
  m.disponivel,
  COALESCE(SUM(l.quantidade), 0) AS estoque_total,
  COUNT(l.id)                    AS total_lotes
FROM medicamentos m
LEFT JOIN lotes l ON l.medicamento_id = m.id AND l.quantidade > 0
GROUP BY m.id, m.nome, m.categoria, m.unidade_medida, m.fabricante, m.disponivel;

-- ============================================================
-- STORED PROCEDURE: sp_venda_fifo
-- Desconta estoque com FIFO (validade mais próxima sai primeiro)
-- Uso: CALL sp_venda_fifo('uuid-do-medicamento', 10, @ok, @msg);
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_venda_fifo(
  IN  p_medicamento_id  VARCHAR(36),
  IN  p_quantidade      INT,
  OUT p_sucesso         TINYINT,
  OUT p_mensagem        VARCHAR(255)
)
BEGIN
  DECLARE v_lote_id   VARCHAR(36);
  DECLARE v_lote_qtd  INT;
  DECLARE v_restante  INT;
  DECLARE v_done      INT DEFAULT 0;

  DECLARE cur_lotes CURSOR FOR
    SELECT id, quantidade
    FROM lotes
    WHERE medicamento_id = p_medicamento_id
      AND quantidade > 0
    ORDER BY validade ASC, created_at ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_restante
  FROM lotes
  WHERE medicamento_id = p_medicamento_id AND quantidade > 0;

  IF v_restante < p_quantidade THEN
    SET p_sucesso  = 0;
    SET p_mensagem = CONCAT('Estoque insuficiente. Disponivel: ', v_restante);
  ELSE
    SET v_restante = p_quantidade;

    OPEN cur_lotes;
    lotes_loop: LOOP
      FETCH cur_lotes INTO v_lote_id, v_lote_qtd;
      IF v_done OR v_restante <= 0 THEN
        LEAVE lotes_loop;
      END IF;

      IF v_lote_qtd >= v_restante THEN
        UPDATE lotes SET quantidade = quantidade - v_restante WHERE id = v_lote_id;
        SET v_restante = 0;
      ELSE
        UPDATE lotes SET quantidade = 0 WHERE id = v_lote_id;
        SET v_restante = v_restante - v_lote_qtd;
      END IF;
    END LOOP;
    CLOSE cur_lotes;

    SET p_sucesso  = 1;
    SET p_mensagem = 'Venda processada com FIFO';
  END IF;
END$$

DELIMITER ;