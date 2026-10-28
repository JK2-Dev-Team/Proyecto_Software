-- Migración 002: órdenes de trabajo e inventario
-- Supone que ya existen: usuarios, clientes, citas, tipos_procedimiento (ajusta nombres si difieren).

CREATE TABLE IF NOT EXISTS insumos (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL UNIQUE,
  unidad_medida  VARCHAR(20)  NOT NULL,
  stock_actual   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Receta": qué insumos consume cada tipo de procedimiento
CREATE TABLE IF NOT EXISTS procedimiento_insumos (
  id                      SERIAL PRIMARY KEY,
  tipo_procedimiento_id   INT NOT NULL REFERENCES tipos_procedimiento(id),
  insumo_id               INT NOT NULL REFERENCES insumos(id),
  cantidad                NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  modo_consumo            VARCHAR(20) NOT NULL DEFAULT 'por_unidad'
                          CHECK (modo_consumo IN ('por_unidad','fijo')),
  UNIQUE (tipo_procedimiento_id, insumo_id)
);

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id                       SERIAL PRIMARY KEY,
  cliente_id               INT NOT NULL REFERENCES clientes(id),
  cita_id                  INT REFERENCES citas(id),
  tipo_procedimiento_id    INT NOT NULL REFERENCES tipos_procedimiento(id),
  unidades                 INT NOT NULL DEFAULT 1 CHECK (unidades >= 1),
  descripcion              TEXT,
  estado                   VARCHAR(20) NOT NULL DEFAULT 'recibido'
                           CHECK (estado IN ('recibido','modelado','coccion_acabado',
                                             'control_calidad','terminado','entregado')),
  insumos_descontados      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_entrega_estimada   DATE,
  creado_por               INT REFERENCES usuarios(id),
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_historial_estados (
  id            SERIAL PRIMARY KEY,
  orden_id      INT NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  estado_previo VARCHAR(20),
  estado_nuevo  VARCHAR(20) NOT NULL,
  usuario_id    INT REFERENCES usuarios(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id          SERIAL PRIMARY KEY,
  insumo_id   INT NOT NULL REFERENCES insumos(id),
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad    NUMERIC(12,3) NOT NULL,                -- con signo: + entra, - sale
  motivo      TEXT,
  orden_id    INT REFERENCES ordenes_trabajo(id),
  usuario_id  INT REFERENCES usuarios(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alertas_stock (
  id            SERIAL PRIMARY KEY,
  insumo_id     INT NOT NULL REFERENCES insumos(id),
  stock_actual  NUMERIC(12,3) NOT NULL,
  stock_minimo  NUMERIC(12,3) NOT NULL,
  abierta       BOOLEAN NOT NULL DEFAULT TRUE,
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_alerta_abierta ON alertas_stock(insumo_id) WHERE abierta;
CREATE INDEX IF NOT EXISTS ix_ordenes_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS ix_mov_insumo ON movimientos_inventario(insumo_id);
