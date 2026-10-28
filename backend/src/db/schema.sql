-- Esquema relacional (3FN) del sistema del Laboratorio Dental Miguel Torres
-- Ejecutar completo en el SQL Editor de Supabase (es idempotente: se puede correr más de una vez).

-- ============================================================
-- MÓDULO 1: Autenticación
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,            -- bcrypt, nunca texto plano
  rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'recepcionista')),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- Clientes (odontólogos y pacientes particulares)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(150) NOT NULL,
  tipo       VARCHAR(20)  NOT NULL CHECK (tipo IN ('odontologo', 'paciente')),
  telefono   VARCHAR(30),
  email      VARCHAR(150),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 2: Gestión de Citas
-- ============================================================
CREATE TABLE IF NOT EXISTS citas (
  id         SERIAL PRIMARY KEY,
  cliente_id INTEGER      NOT NULL REFERENCES clientes(id),
  fecha_hora TIMESTAMPTZ  NOT NULL,
  motivo     VARCHAR(255) NOT NULL,
  estado     VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
  notas      TEXT,
  creado_por INTEGER      REFERENCES usuarios(id),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citas_fecha  ON citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);

-- ============================================================
-- MÓDULO 4: Inventario (se crea antes que órdenes porque estas lo consumen)
-- ============================================================
CREATE TABLE IF NOT EXISTS insumos (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL UNIQUE,
  unidad       VARCHAR(20)  NOT NULL,                       -- g, ml, unidad, etc.
  stock_actual NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),  -- umbral de alerta
  activo       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- MÓDULO 3: Órdenes de Trabajo Dental (trazabilidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_procedimiento (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL UNIQUE,
  descripcion VARCHAR(255)
);

-- "Receta" de insumos que consume cada tipo de procedimiento (base del descuento automático)
CREATE TABLE IF NOT EXISTS procedimiento_insumos (
  tipo_procedimiento_id INTEGER NOT NULL REFERENCES tipos_procedimiento(id) ON DELETE CASCADE,
  insumo_id             INTEGER NOT NULL REFERENCES insumos(id),
  cantidad              NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (tipo_procedimiento_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id                    SERIAL PRIMARY KEY,
  cita_id               INTEGER REFERENCES citas(id),
  cliente_id            INTEGER NOT NULL REFERENCES clientes(id),
  tipo_procedimiento_id INTEGER NOT NULL REFERENCES tipos_procedimiento(id),
  descripcion           TEXT,
  estado                VARCHAR(30) NOT NULL DEFAULT 'recibido'
                        CHECK (estado IN ('recibido', 'en_modelado', 'en_coccion_acabado',
                                          'control_calidad', 'terminado', 'entregado')),
  fecha_entrega_estimada DATE,
  creado_por            INTEGER REFERENCES usuarios(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes_trabajo(estado);

-- Historial de trazabilidad: cada cambio de estado queda registrado
CREATE TABLE IF NOT EXISTS orden_historial_estados (
  id              SERIAL PRIMARY KEY,
  orden_id        INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(30),
  estado_nuevo    VARCHAR(30) NOT NULL,
  usuario_id      INTEGER REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Historial de movimientos de inventario (entradas, salidas y consumo por órdenes)
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id         SERIAL PRIMARY KEY,
  insumo_id  INTEGER NOT NULL REFERENCES insumos(id),
  tipo       VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad   NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  motivo     VARCHAR(255),
  orden_id   INTEGER REFERENCES ordenes_trabajo(id),   -- se llena cuando el consumo viene de una orden
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_insumo ON movimientos_inventario(insumo_id);

-- ============================================================
-- Datos de ejemplo (ajustar con los procedimientos reales de Miguel Torres)
-- ============================================================
INSERT INTO tipos_procedimiento (nombre, descripcion) VALUES
  ('Corona', 'Corona dental individual'),
  ('Prótesis total', 'Prótesis completa removible'),
  ('Prótesis parcial', 'Prótesis parcial removible'),
  ('Puente', 'Puente fijo de varias piezas')
ON CONFLICT (nombre) DO NOTHING;
