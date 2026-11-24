# RUTABOL-SCZ

Aplicación web académica para gestionar líneas y micros, conductores, viajes, pasajes, pagos simulados, aforo y transbordos de emergencia en Santa Cruz. La aplicación tiene un frontend Next.js y una API NestJS conectada a PostgreSQL.

## Requisitos

- Node.js 22 o superior y npm.
- PostgreSQL 15 o superior, con pgAdmin opcional.
- Git, si se clonará el proyecto desde un repositorio.

## Inicio rápido en una computadora nueva

### 1. Preparar PostgreSQL

1. En pgAdmin crea una base de datos vacía llamada `rutabol_scz`.
2. Abre Query Tool conectado a esa base y ejecuta **una sola vez** [`database/rutabol_pgadmin.sql`](database/rutabol_pgadmin.sql). Ese archivo es el esquema completo y actualizado para una instalación desde cero.
3. El esquema completo ya incluye líneas, tarifas y micros ficticios para que la API arranque y se pueda probar. No son rutas reales. El ejemplo trata toda la capacidad de cada unidad como plazas sentadas y cero plazas de pie; ajusta los valores usando la autorización del vehículo antes de usar datos reales.

No ejecutes `database/02_seed_demo.sql` después del esquema completo: sus datos demo ya están incluidos. Ese seed es para una base con esquema vigente pero sin esos registros. No uses `database/01_init.sql`: es un esquema antiguo e incompleto. `database/03_actualizar_capacidad_tarifas.sql` es únicamente para actualizar una base existente creada con una versión previa; no se ejecuta encima de una base nueva.

Como alternativa a instalar PostgreSQL manualmente, puedes levantarlo con Docker Compose desde la raíz:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Antes de iniciar, reemplaza `POSTGRES_PASSWORD` en `.env` y usa esa misma clave en `DATABASE_URL` de `backend/.env`. Compose publica PostgreSQL en el puerto `5433` y crea el esquema vigente solo al inicializar un volumen nuevo.

Para una base existente, aplica primero la migración que corresponda a su versión. Para incorporar el rol ORGANIZADOR, usa una vez [`database/04_modelo_organizador.sql`](database/04_modelo_organizador.sql) después de las migraciones anteriores. Para registrar el viaje real de cada cobro y generar reportes por unidad y chofer, aplica una vez [`database/05_reporte_ingresos.sql`](database/05_reporte_ingresos.sql) después de la migración 04.

### 2. Configurar y arrancar el backend

En PowerShell, desde la carpeta del proyecto:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edita `backend/.env` y configura `DATABASE_URL` con el usuario, contraseña, host, puerto y base de datos locales. Por ejemplo:

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/rutabol_scz
SESSION_SECRET=pon_aqui_un_secreto_aleatorio_de_32_caracteres_o_mas
ADMIN_USERNAME=admin
ADMIN_PASSWORD=pon_una_clave_de_admin_de_12_caracteres_o_mas
PAYMENT_MODE=disabled
```

No compartas el archivo `.env`. Al arrancar, el backend crea la cuenta administradora indicada si todavía no existe; anota sus credenciales. La tarjeta simulada se puede habilitar solo para desarrollo con `PAYMENT_MODE=mock`.

Arranca la API:

```powershell
npm run start:dev
```

Documentación Swagger: <http://localhost:3001/api/docs>.

### 3. Configurar y arrancar el frontend

Abre una segunda terminal desde la raíz del proyecto:

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

Abre <http://localhost:3000>. La variable `NEXT_PUBLIC_API_URL` debe apuntar a `http://localhost:3001/api`.

## Para la persona que implementará el frontend

- La lista de rutas, roles, cuerpos y respuestas de la API está en [`docs/API_BACKEND.md`](docs/API_BACKEND.md) y en Swagger.
- La cookie de sesión requiere enviar credenciales en las solicitudes del navegador: `credentials: 'include'`.
- El origen permitido se configura con `FRONTEND_ORIGIN` en el backend y debe coincidir exactamente con la URL del frontend.
- Los datos de demostración son ficticios. Para flujos que requieren ADMIN, inicia sesión con la cuenta que se crea desde `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
- Antecedentes y reglas de negocio acordadas: [`docs/REQUERIMIENTOS_RUTABOL_BORRADOR.md`](docs/REQUERIMIENTOS_RUTABOL_BORRADOR.md).

## Verificaciones

Desde `backend`, `npm run build`. Desde `frontend`, `npm run build`.

## Seguridad de sesiones y API

- Las consultas a PostgreSQL usan parámetros (`$1`, `$2`, etc.). Los nombres de tabla que no se pueden parametrizar se seleccionan desde una lista fija; no agregues valores recibidos del usuario mediante interpolación SQL.
- Las rutas protegidas validan la sesión contra una cuenta activa y cargan el rol vigente desde PostgreSQL en cada solicitud. Los DTO rechazan campos extra (`whitelist` y `forbidNonWhitelisted`).
- El inicio de sesión regenera el ID de sesión; la sesión queda guardada en PostgreSQL y sobrevive reinicios del proceso. La cookie `micros.sid` es `HttpOnly`, `SameSite=Lax`, dura una hora y usa `Secure` cuando `NODE_ENV=production`.
- Las solicitudes que cambian datos (`POST`, `PATCH`, `DELETE`) deben incluir el `Origin` del frontend configurado en `FRONTEND_ORIGIN`. Mantén ese valor como origen exacto, sin rutas. Swagger permite también el origen local de la API para facilitar pruebas.
- En producción sirve la API detrás de HTTPS y configura correctamente el proxy inverso. El backend confía en un salto de proxy cuando `NODE_ENV=production`; ajusta esa opción si tu infraestructura tiene otra topología.
- Este repositorio no implementa WebSockets ni expone un endpoint/socket gateway. La autenticación actual es HTTP con cookie de sesión. Si se incorporan WebSockets, valida la sesión en el handshake, comprueba el rol en cada evento sensible, limita el origen permitido y no aceptes IDs de usuario/rol enviados por el cliente.
- Para probar manualmente: inicia sesión desde la aplicación, recarga la página y confirma que `/api/auth/me` conserva la cuenta; cierra sesión y confirma que `/api/auth/me` responde `401`. Prueba también una ruta administrativa con una sesión de pasajero (debe responder `403`) y una mutación con un `Origin` ajeno a `FRONTEND_ORIGIN` (debe responder `403`). Las verificaciones de compilación indicadas arriba no sustituyen estas pruebas con una base local.
