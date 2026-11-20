-- Columnas y tablas que el código usa y que no estaban en schema.sql.
-- Reproduce la base de datos real (Supabase). Todo es idempotente: se puede ejecutar varias veces.
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS unidades INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS insumos_descontados BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE procedimiento_insumos ADD COLUMN IF NOT EXISTS modo_consumo VARCHAR(20) NOT NULL DEFAULT 'por_unidad';

CREATE TABLE IF NOT EXISTS alertas_stock (
  id            SERIAL PRIMARY KEY,
  insumo_id     INTEGER NOT NULL REFERENCES insumos(id),
  stock_actual  NUMERIC(12,2) NOT NULL,
  stock_minimo  NUMERIC(12,2) NOT NULL,
  abierta       BOOLEAN NOT NULL DEFAULT TRUE,
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en    TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_alerta_abierta ON alertas_stock (insumo_id) WHERE abierta;
