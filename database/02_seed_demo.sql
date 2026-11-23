-- Ejecutar una sola vez en rutabol_scz si la base ya existia antes
-- de agregar los datos de demostracion al esquema.
BEGIN;
INSERT INTO lineas (id, nombre, zona, descripcion, color) VALUES
  (1, 'Linea Demo Norte',  'Zona norte',   'Recorrido ilustrativo, sin validez oficial.', '#0f766e'),
  (2, 'Linea Demo Centro', 'Zona central', 'Recorrido ilustrativo, sin validez oficial.', '#2563eb'),
  (3, 'Linea Demo Sur',    'Zona sur',     'Recorrido ilustrativo, sin validez oficial.', '#c2410c'),
  (4, 'Linea Demo Este',   'Zona este',    'Recorrido ilustrativo, sin validez oficial.', '#7c3aed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tarifas (linea_id, categoria, importe, vigente_desde)
SELECT l.id, t.categoria, t.importe, DATE '2026-10-05'
  FROM lineas l
 CROSS JOIN (VALUES
   ('GENERAL', 3.50::NUMERIC), ('MENOR_12', 0.50::NUMERIC),
   ('ESCOLAR_PRIMARIA', 0.50::NUMERIC), ('ESCOLAR_SECUNDARIA', 1.00::NUMERIC),
   ('UNIVERSITARIO', 1.00::NUMERIC), ('ADULTO_MAYOR', 1.00::NUMERIC),
   ('DISCAPACIDAD', 1.00::NUMERIC), ('BENEMERITO', 0.00::NUMERIC),
   ('POLICIA_UNIFORMADO', 0.00::NUMERIC)
 ) AS t(categoria, importe)
ON CONFLICT (linea_id, categoria, vigente_desde) DO NOTHING;

-- Datos ilustrativos: para estas unidades ficticias se asume que toda la
-- capacidad indicada son plazas sentadas. No representa una autorización real.
INSERT INTO micros (id, placa, interno, capacidad, capacidad_sentados,
                    capacidad_parados_autorizada, capacidad_operativa, estado, linea_id) VALUES
  (1, 'DEMO-001', '101', 32, 32, 0, 32, 'ACTIVO', 1),
  (2, 'DEMO-002', '202', 38, 38, 0, 38, 'MANTENIMIENTO', 2),
  (3, 'DEMO-003', '303', 30, 30, 0, 30, 'ACTIVO', 3)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('lineas', 'id'), (SELECT COALESCE(MAX(id), 1) FROM lineas), TRUE);
SELECT setval(pg_get_serial_sequence('micros', 'id'), (SELECT COALESCE(MAX(id), 1) FROM micros), TRUE);
COMMIT;
