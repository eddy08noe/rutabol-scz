# API del backend RUTABOL-SCZ

Base local: `http://localhost:3001/api`. La interfaz Swagger queda en `http://localhost:3001/api/docs` y el documento OpenAPI JSON en `http://localhost:3001/api/docs-json`. Las sesiones usan cookie HTTP; para peticiones del frontend se deben enviar credenciales (`credentials: 'include'`). Las rutas de administrador, organizador y chofer requieren sesión y respetan el rol y las asignaciones de línea. El registro público crea únicamente cuentas `PASAJERO`.

En Swagger puedes usar **POST `/api/auth/login`** primero; la interfaz guarda la cookie de sesión del mismo servidor y luego puedes probar las rutas protegidas según el rol de esa cuenta.

**Instalación desde cero:** sigue las instrucciones del [README principal](../README.md) y ejecuta `database/rutabol_pgadmin.sql` en una base nueva vacía. **Base anterior ya existente:** solo en ese caso ejecuta una vez `database/03_actualizar_capacidad_tarifas.sql`; no ejecutes el esquema completo encima de una base existente. La migración pone en revisión las validaciones escolares antiguas de tipo `ESCOLAR`, pues no puede inferir primaria o secundaria. Completa sentados/de pie autorizados para cada micro antes de operar; las unidades antiguas conservan su aforo hasta que el admin las actualice con su documentación.

La migración carga tarifas de referencia por línea: general Bs 3,50; menor de 12 y primaria Bs 0,50; secundaria, universidad, adulto mayor y discapacidad Bs 1; benemérito y policía uniformado Bs 0. El administrador puede registrar nuevas tarifas y vigencias cuando cambie la norma. Para configurar un micro, usa su capacidad autorizada en sus documentos: el sistema sugiere como aforo operativo inicial solo las plazas sentadas y permite incluir plazas de pie únicamente si están autorizadas.

## Rutas

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| POST | `/auth/registro` | Público | Crear cuenta pasajero e iniciar sesión |
| POST | `/auth/login` | Público | Iniciar sesión |
| GET | `/auth/me` | Sesión | Consultar usuario actual |
| POST | `/auth/logout` | Sesión | Cerrar sesión |
| GET | `/lineas`, `/lineas/:id` | Público | Consultar líneas activas |
| POST/PATCH/DELETE | `/lineas`, `/lineas/:id` | Admin | Crear, editar o desactivar línea |
| GET/POST | `/organizadores` | Admin | Consultar y crear organizadores con correo y líneas asignadas |
| PATCH | `/organizadores/:id/lineas` | Admin | Reemplazar las líneas asignadas a un organizador |
| GET | `/micros`, `/micros/:id` | Público | Consultar micros |
| GET | `/micros/cercanos?lat=-17.78&lng=-63.18` | Público | Micros activos con ubicación de los últimos 2 minutos, hasta 5 km |
| POST/PATCH/DELETE | `/micros`, `/micros/:id` | Admin/organizador asignado | Crear, editar o desactivar micro; registra capacidad autorizada, plazas sentadas y de pie permitidas |
| GET | `/paradas?lineaId=1` | Público | Consultar paradas de línea |
| POST/DELETE | `/paradas`, `/paradas/:id` | Admin/organizador asignado | Crear o desactivar parada |
| GET | `/tarifas?lineaId=1&categoria=GENERAL` | Público | Consultar tarifas vigentes |
| POST/DELETE | `/tarifas`, `/tarifas/:id` | Admin/organizador asignado | Crear o desactivar tarifa |
| GET | `/viajes?lineaId=1&estado=EN_CURSO` | Público | Consultar viajes |
| GET | `/viajes/:id/aforo` | Público | Consultar ocupación y cupos disponibles |
| POST | `/viajes` | Admin/organizador asignado | Programar viaje con micro y conductor de la línea |
| POST | `/viajes/:id/iniciar`, `/finalizar` | Admin/organizador asignado/chofer asignado | Cambiar estado del viaje |
| POST | `/viajes/:id/incidentes` | Admin/organizador asignado/chofer asignado | Reportar emergencia |
| GET/POST | `/conductores`, `/conductores/:id` | Admin/organizador asignado | Consultar o crear conductor y acceso con correo dentro de una línea |
| PATCH/DELETE | `/conductores/:id` | Admin/organizador de línea asignada | Editar o desactivar conductor |
| POST | `/estudiantes` | Pasajero | Solicitar validación por línea de primaria/secundaria con RUDE o universidad con código y correo UPDS |
| GET | `/estudiantes/mio` | Pasajero | Consultar sus validaciones por línea |
| GET | `/estudiantes/pendientes` | Admin/organizador asignado | Revisar solicitudes de las líneas propias |
| PATCH | `/estudiantes/:id/revision` | Admin/organizador de línea | Aprobar o rechazar solicitud |
| POST | `/beneficios-tarifarios` | Pasajero | Solicitar tarifa de menor, adulto mayor, discapacidad o exención con evidencia por línea |
| GET | `/beneficios-tarifarios/mios` | Pasajero | Consultar beneficios solicitados |
| GET | `/beneficios-tarifarios/pendientes` | Admin/organizador asignado | Revisar beneficios pendientes de las líneas propias |
| PATCH | `/beneficios-tarifarios/:id/revision` | Admin/organizador de línea | Aprobar o rechazar beneficio |
| POST | `/pasajes` | Pasajero | Crear pasaje; beneficios y exenciones requieren aprobación, tarifa cero queda registrada como exenta |
| GET | `/pasajes/mios`, `/pasajes/:codigo` | Pasajero | Consultar sus pasajes |
| POST | `/pagos/pasajes/:pasajeId/checkout` | Pasajero | Checkout solo en modo de prueba local |
| GET | `/pagos`, `/pagos/:id`, `/pagos/reembolsos` | Pasajero/Admin | Consultar operaciones propias o todas como admin |
| GET | `/pagos/reporte-ingresos` | Admin | Resumen y desglose por período, línea, chofer y micro; filtros `desde`, `hasta`, `agrupacion`, `lineaId`, `conductorId`, `microId` |
| PATCH | `/pagos/reembolsos/:id/resultado` | Admin | Registrar resultado confirmado por el proveedor |
| POST | `/ubicaciones` | Admin/chofer asignado | Registrar posición del micro en viaje activo |
| GET | `/ubicaciones/micros/:microId` | Admin | Consultar historial GPS |
| POST | `/abordajes` | Admin/chofer asignado | Registrar abordaje usando el `codigo` alfanumérico visible en el pasaje, además de `viajeId`; `metodoPago: "EFECTIVO"` registra el efectivo en la misma transacción |
| GET | `/abordajes/viaje/:viajeId` | Admin/chofer asignado | Ver pasajeros activos a bordo |
| PATCH | `/abordajes/:id/descenso` | Admin/chofer asignado | Registrar descenso y liberar cupo |
| GET/POST | `/trasbordos` | Sesión / Admin o chofer | Consultar trasbordos visibles o registrar uno |
| POST | `/trasbordos/:id/pasajes/:pasajeId/continuar` | Pasajero dueño/Admin/chofer asignado | Transferir ticket sin volver a cobrar |
| POST | `/trasbordos/:id/pasajes/:pasajeId/rechazar` | Pasajero dueño/Admin/chofer asignado | Rechazar emergencia y crear solicitud de reembolso |

## Arranque local

1. Configura `backend/.env` con la conexión a tu PostgreSQL, `SESSION_SECRET` de 32 caracteres o más, `ADMIN_USERNAME`, `ADMIN_PASSWORD` de 12 caracteres o más y `FRONTEND_ORIGIN`.
2. Desde `backend`, instala dependencias si hace falta y ejecuta `npm run start:dev`.
3. Comprueba compilación con `npm run build`.
4. Para simular pago durante desarrollo, usa `PAYMENT_MODE=mock` y `NODE_ENV` distinto de `production`. El modo queda deshabilitado por defecto.

## Límites de esta versión

- `ORGANIZADOR` opera únicamente sobre las líneas asignadas por un ADMIN. La migración `database/04_modelo_organizador.sql` agrega el rol, las asignaciones de organizador y conductor por línea y el alcance de solicitudes tarifarias/estudiantiles. En una base existente, aplícala una vez antes de iniciar la versión actualizada.
- El esquema para una base nueva (`database/rutabol_pgadmin.sql`) ya incluye las tablas y el rol `ORGANIZADOR`.

- No se integra una pasarela bancaria; la tarjeta es simulada en desarrollo y no se reciben ni guardan datos de tarjeta. El efectivo se registra al abordar. El reembolso de efectivo o de la tarjeta simulada queda solicitado hasta que un administrador registre su entrega/resultado.
- Para habilitar la simulación local configura `PAYMENT_MODE=mock` en `backend/.env` y mantén `NODE_ENV` distinto de `production`. El transbordo normal exige motivo `FIN_TURNO` y viajes de la misma línea; el transbordo de emergencia mantiene su flujo separado.
- Las evidencias estudiantiles se guardan como referencia (`evidenciaRef`); falta definir e integrar almacenamiento seguro de fotos/documentos.
- El GPS depende de que el chofer o cliente autorizado envíe ubicaciones; no hay proveedor de mapas integrado.
- Si se rechaza un reemplazo de emergencia, se solicita la devolución total del importe cobrado; un pasaje exento se cancela sin crear un reembolso de importe cero.
- Para crear viajes deben existir líneas, micros, conductores y tarifas. El archivo `database/02_seed_demo.sql` agrega líneas y micros de demostración a una base cuyo esquema ya existe.
