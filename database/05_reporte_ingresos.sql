-- Registra el viaje donde se concretó cada cobro para atribuirlo a línea,
-- micro y chofer incluso cuando el pasaje tuvo un trasbordo.
-- Ejecutar una vez después de database/04_modelo_organizador.sql.
BEGIN;

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS viaje_id BIGINT REFERENCES viajes(id) ON DELETE RESTRICT;

-- Los cobros existentes solo conservan el viaje inicial del pasaje.
UPDATE pagos p
   SET viaje_id = t.viaje_inicial_id
  FROM pasajes t
 WHERE t.id = p.pasaje_id AND p.viaje_id IS NULL;

ALTER TABLE pagos ALTER COLUMN viaje_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS pagos_viaje_fecha_idx ON pagos(viaje_id, creado_en DESC);

COMMIT;
