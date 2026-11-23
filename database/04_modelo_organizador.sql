-- Actualiza una base existente para el rol ORGANIZADOR y su alcance por línea.
-- Ejecutar una sola vez después de las migraciones anteriores.
BEGIN;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'usuarios'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('ADMIN', 'ORGANIZADOR', 'CHOFER', 'PASAJERO'));

CREATE TABLE IF NOT EXISTS organizador_lineas (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
  asignado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, linea_id)
);
CREATE INDEX IF NOT EXISTS organizador_lineas_linea_idx ON organizador_lineas(linea_id);

CREATE TABLE IF NOT EXISTS conductor_lineas (
  conductor_id BIGINT NOT NULL REFERENCES conductores(id) ON DELETE CASCADE,
  linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
  asignado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conductor_id, linea_id)
);
CREATE INDEX IF NOT EXISTS conductor_lineas_linea_idx ON conductor_lineas(linea_id);

-- Conserva el alcance histórico que se puede inferir de los viajes existentes.
INSERT INTO conductor_lineas (conductor_id, linea_id)
SELECT DISTINCT conductor_id, linea_id FROM viajes
ON CONFLICT DO NOTHING;

ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL;
ALTER TABLE beneficios_tarifarios ADD COLUMN IF NOT EXISTS linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL;

ALTER TABLE estudiantes
  DROP CONSTRAINT IF EXISTS estudiantes_usuario_id_key;
ALTER TABLE estudiantes
  DROP CONSTRAINT IF EXISTS estudiantes_usuario_linea_key;
ALTER TABLE estudiantes
  ADD CONSTRAINT estudiantes_usuario_linea_key UNIQUE (usuario_id, linea_id);

ALTER TABLE beneficios_tarifarios
  DROP CONSTRAINT IF EXISTS beneficios_tarifarios_usuario_id_categoria_key;
ALTER TABLE beneficios_tarifarios
  DROP CONSTRAINT IF EXISTS beneficios_tarifarios_usuario_categoria_linea_key;
ALTER TABLE beneficios_tarifarios
  ADD CONSTRAINT beneficios_tarifarios_usuario_categoria_linea_key
  UNIQUE (usuario_id, categoria, linea_id);

COMMIT;
