# Base de datos local

## Base nueva desde cero

En pgAdmin:

1. Crea una base vacía llamada `rutabol_scz`.
2. Selecciónala y abre **Tools → Query Tool**.
3. Abre `rutabol_pgadmin.sql`, ejecútalo completo y espera el mensaje de éxito.
4. El esquema inserta líneas, tarifas y micros ficticios automáticamente.

`rutabol_pgadmin.sql` es el esquema completo vigente. No ejecutes también los scripts de migración en una base nueva.

Docker Compose también inicializa una base nueva con `rutabol_pgadmin.sql`. PostgreSQL ejecuta ese archivo solo cuando crea por primera vez el volumen `postgres_data`; cambiar el archivo de inicialización no actualiza un volumen que ya contiene la base antigua. Haz una copia de seguridad antes de migrar o recrear un volumen existente.

## Qué hace cada SQL

| Archivo | Uso |
|---|---|
| `rutabol_pgadmin.sql` | Esquema completo vigente para crear una base nueva vacía. Incluye tablas, restricciones, funciones, validaciones y tarifas base. |
| `02_seed_demo.sql` | Datos ficticios para una base con el esquema actual pero que aún no tiene los registros demo. No ejecutar encima de una base recién creada por `rutabol_pgadmin.sql`. |
| `03_actualizar_capacidad_tarifas.sql` | Migración de una base anterior existente. Se usa una sola vez y solo después de haber aplicado el esquema anterior. |
| `04_modelo_organizador.sql` | Agrega ORGANIZADOR, asignación de líneas y revisión de solicitudes por línea en una base existente. |
| `01_init.sql` | Esquema viejo/incompleto. No usar para instalaciones nuevas. |

Después de restaurar/crear la base, el backend crea el usuario ADMIN inicial con los valores `ADMIN_USERNAME` y `ADMIN_PASSWORD` de `backend/.env`.

Para una base que ya funciona con el esquema anterior, aplica `04_modelo_organizador.sql` una sola vez después de las migraciones previas y antes de iniciar el backend actualizado. Las solicitudes antiguas quedan sin línea asociada; ADMIN puede seguir revisándolas.
