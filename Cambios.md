# Cambios de la Clase Anterior a la Clase Actual con Psql CORS actualizado y  CRUD CON BD, DTO Para bd y schema de bd en 01_init.sql

**Proyecto:** Micros SCZ / Rutabol SCZ

**Asignatura:** Tecnología Web I

**Tecnologías:** Next.js, NestJS, TypeScript, PostgreSQL, Docker Compose

**Propósito:** guía de estudio, análisis y réplica de las mejoras realizadas en la Clase.

> **Nota sobre el alcance:** esta guía se basa en la estructura y los archivos de la versión entregada de la Clase. Incluye los dos ajustes de TypeScript que corregimos posteriormente al poner en marcha el backend. Si el estudiante trabaja con una copia editada del proyecto, debe contrastar los nombres y rutas con su propio repositorio.
## 1. El problema que resolvemos

En la Clase anterior la aplicación tenía dos partes:

- **Next.js:** mostraba el catálogo, formularios, botones y tablas.
- **NestJS:** recibía solicitudes HTTP a través de los endpoints REST y administraba los registros mediante arreglos de memoria.

El CRUD funcionaba, pero tenía dos limitaciones:

1. **Falta de persistencia:** los micros registrados o editados desaparecían al reiniciar NestJS, porque el arreglo se reconstruía.
2. **Falta de control de acceso:** cualquier cliente capaz de llamar al endpoint podía intentar crear, editar o eliminar micros.

En la Clase 8 mantenemos la misma aplicación y sus rutas REST, pero trasladamos los datos a **PostgreSQL** y protegemos las operaciones administrativas mediante **autenticación con sesiones**.

### Comparación

| Aspecto | Clase 7 | Clase 8 |
|---|---|---|
| Catálogo principal | Next.js consume `GET /api/lineas` | Se conserva, ahora consulta PostgreSQL |
| CRUD | `GET`, `POST`, `PATCH`, `DELETE` | Se conserva el contrato HTTP |
| Almacenamiento de micros | Arreglo dentro de `MicrosService` | Tabla `micros` en PostgreSQL |
| Reinicio de NestJS | Los cambios se pierden | Los cambios permanecen en la base de datos |
| Usuarios | No existe login | Usuario administrador almacenado en `usuarios` |
| Contraseñas | No se manejaban | Se guarda un hash bcrypt, no la contraseña |
| Sesiones | No existen | Cookie con identificador; sesión almacenada en PostgreSQL |
| Autorización | No hay restricciones de escritura | `SessionGuard` verifica usuario y rol `ADMIN` |
| Frontend | Tabla y formulario disponibles | Catálogo público y controles administrativos según sesión |

## 2. Arquitectura: cómo se comunican las partes

```text
NAVEGADOR
  |
  | http://localhost:3000
  v
NEXT.JS (frontend/src/app/page.tsx)
  |  fetch() / JSON / credentials: 'include'
  |  http://localhost:3001/api
  v
NESTJS (controladores y servicios)
  |-- GET /api/lineas                 -> LineasService  -> PostgreSQL
  |-- GET /api/micros                 -> MicrosService  -> PostgreSQL
  |-- POST /api/auth/login            -> AuthService    -> PostgreSQL
  |-- GET /api/auth/me                -> sesión actual
  |-- POST /api/auth/logout           -> destruye sesión
  |-- POST/PATCH/DELETE /api/micros   -> SessionGuard   -> MicrosService
  |
  v
POSTGRESQL (contenedor Docker, puerto local 5433)
  |-- lineas
  |-- micros
  |-- usuarios
  `-- tabla de sesiones gestionada por connect-pg-simple
```

**Idea fundamental:** la interfaz no decide por sí sola quién tiene permiso. Next.js adapta lo que muestra, pero **NestJS valida la sesión y la autorización en el servidor**, incluso cuando alguien llama a la API sin utilizar la página web.

## 3. Docker Compose: ejecutar PostgreSQL

**Archivo:** `compose.yaml` (raíz del repositorio).

  Se incorpora un servicio `postgres` que usa la imagen `postgres:17-alpine` y una base de datos llamada `micros_scz`.

Fragmento relevante:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: micros_scz
      POSTGRES_USER: micros
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Configure POSTGRES_PASSWORD en .env}
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/01_init.sql:/docker-entrypoint-initdb.d/01_init.sql:ro

volumes:
  postgres_data:
```

**Lógica de cada parte:**

- La imagen contiene PostgreSQL; no hace falta instalar el motor directamente en SO.
- `POSTGRES_DB` define el nombre de la base y `POSTGRES_USER` el usuario de conexión.
- `${POSTGRES_PASSWORD}` obtiene la contraseña desde el `.env` de **la raíz**, no desde `backend/.env`.
- `127.0.0.1:5433:5432` permite conectarse desde el Mac por el puerto 5433 mientras PostgreSQL escucha en el 5432 del contenedor.
- `postgres_data` guarda los archivos de la base de datos fuera del ciclo de vida del contenedor: reconstruir o reiniciar el contenedor no borra los registros mientras se conserve ese volumen.
- El archivo `01_init.sql` crea las tablas y datos iniciales cuando PostgreSQL inicializa **por primera vez un volumen vacío**; no se ejecuta cada vez que reiniciamos.
- El `healthcheck` incluido en el proyecto verifica cuándo PostgreSQL está respondiendo.

**Comandos desde la raíz:**

```bash
cp .env.example .env           # si existe la plantilla
# Si la plantilla no existe, crear .env con POSTGRES_PASSWORD=una_clave_local
docker compose up -d
docker compose ps
docker compose exec postgres psql -U micros -d micros_scz
```

Dentro de `psql`:

```sql
\dt
SELECT * FROM lineas;
SELECT * FROM micros;
\q
```

`\dt` y `\q` son instrucciones de **psql**, no comandos de la terminal zsh. Nunca usar `docker compose down -v` para una parada normal: `-v` elimina los volúmenes administrados por Compose y puede destruir los datos.

## 4. SQL: pasar del arreglo a tablas relacionadas

**Archivo:** `database/01_init.sql`.

Se crean tres tablas principales:

| Tabla | Qué almacena | Relaciones o restricciones |
|---|---|---|
| `lineas` | Nombre, zona, descripción, color | Identificador primario y nombre único |
| `micros` | Placa, interno, capacidad, estado | `linea_id` referencia `lineas(id)`; placa e interno únicos |
| `usuarios` | Nombre, hash de contraseña, rol | Nombre único; en este laboratorio el rol permitido es `ADMIN` |

Ejemplo conceptual:

```sql
CREATE TABLE micros (
  id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  placa VARCHAR(20) NOT NULL UNIQUE,
  interno VARCHAR(20) NOT NULL UNIQUE,
  capacidad INTEGER NOT NULL CHECK (capacidad BETWEEN 1 AND 100),
  estado VARCHAR(20) NOT NULL CHECK
    (estado IN ('ACTIVO', 'MANTENIMIENTO', 'INACTIVO')),
  linea_id INTEGER NOT NULL REFERENCES lineas(id)
);
```

**Por qué es importante:** la clave foránea impide registrar un micro vinculado a una línea inexistente. Los `UNIQUE` impiden duplicaciones y los `CHECK` impiden valores inválidos. La validación debe existir tanto en NestJS como en la base de datos: la primera ofrece mensajes adecuados y la segunda protege la integridad.

En la versión de referencia las líneas y los micros iniciales son de demostración.

## 5. DatabaseService: conexión reutilizable con PostgreSQL

**Archivos:**

```text
backend/src/database/database.module.ts
backend/src/database/database.service.ts
```

Antes, cada servicio trabajaba directamente con un arreglo. Ahora ambos dependen de `DatabaseService`, que crea un **Pool** (grupo de conexiones) usando `process.env.DATABASE_URL`.

Versión de referencia compatible con los ajustes que hicimos al levantar el proyecto:

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL');
    }
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
```

**Lógica:**

1. La variable `DATABASE_URL` indica host, puerto, usuario, contraseña y base de datos.
2. `Pool` administra conexiones reutilizables a PostgreSQL.
3. `query()` recibe una instrucción SQL y sus parámetros, y devuelve filas tipadas.
4. `getPool()` permite que el almacén de sesiones reutilice el mismo grupo de conexiones sin hacer pública la propiedad interna.
5. `onModuleDestroy()` cierra el pool durante un apagado gestionado por NestJS.

**Correcciones de TypeScript que surgieron durante la práctica:**

- `query<T>` pasó a `query<T extends QueryResultRow>` porque `pg` exige ese límite para el tipo de fila.
- En `main.ts`, al usar `private readonly pool`, cambiamos `database.pool` por `database.getPool()`.

Estas correcciones son importantes al replicar el proyecto: **el ZIP inicial no incluía necesariamente estos dos ajustes**, pero el backend que pusimos en marcha sí los necesitó.

## 6. LineasService: consultar en lugar de leer un arreglo

**Archivo:** `backend/src/lineas/lineas.service.ts`.

La operación pública mantiene su nombre, pero la fuente de información cambia:

```typescript
findAll(): Promise<Linea[]> {
  return this.db.query<Linea>(
    'SELECT id, nombre, zona, descripcion, color FROM lineas ORDER BY id'
  );
}
```

**Flujo:** Next.js llama `GET /api/lineas` → `LineasController` delega en `LineasService` → el servicio consulta PostgreSQL → NestJS responde JSON. El frontend conserva el mismo tipo de datos, por eso no debemos rehacer el catálogo.

Para consultar una línea concreta se utiliza `WHERE id = $1` y el valor se pasa como parámetro (`[id]`), evitando construir SQL mediante interpolación de entradas externas.

## 7. MicrosService: CRUD persistente

**Archivo:** `backend/src/micros/micros.service.ts`.

Las operaciones se traducen a SQL:

| Acción | Método NestJS | SQL |
|---|---|---|
| Listar | `findAll()` | `SELECT` |
| Buscar por ID | `findOne(id)` | `SELECT ... WHERE id = $1` |
| Crear | `create(dto)` | `INSERT ... RETURNING` |
| Actualizar | `update(id, dto)` | `UPDATE ... RETURNING` |
| Eliminar | `remove(id)` | `DELETE ... RETURNING` |

Por ejemplo, el registro de un micro usa esta lógica:

```typescript
await this.lineas.findOne(dto.lineaId);
const rows = await this.db.query<Micro>(
  `INSERT INTO micros (placa, interno, capacidad, estado, linea_id)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, placa, interno, capacidad, estado, linea_id AS "lineaId"`,
  [dto.placa.trim().toUpperCase(), dto.interno.trim(),
   dto.capacidad, dto.estado, dto.lineaId]
);
return rows[0];
```

**Qué sucede paso a paso:**

1. El controlador recibe JSON desde el formulario.
2. El DTO (`CreateMicroDto`) valida estructura y valores.
3. El servicio comprueba que la línea existe.
4. `INSERT` guarda un registro en PostgreSQL. `$1`, `$2`, etc. son marcadores para valores, no texto concatenado.
5. `RETURNING` devuelve el micro recién creado.
6. El alias `linea_id AS "lineaId"` conserva el nombre de campo que ya esperaba Next.js en la Clase 7.
7. Si la placa o el interno están duplicados, el servicio transforma el código SQL `23505` en una respuesta HTTP `409 Conflict`. Una línea inexistente se responde con un error apropiado.

La gran diferencia no está en el botón del frontend, sino en **dónde se ejecuta y conserva la operación**.

## 8. Autenticación: usuarios y contraseñas

**Archivos:**

```text
backend/src/auth/auth.module.ts
backend/src/auth/auth.service.ts
backend/src/auth/auth.controller.ts
backend/src/auth/dto/login.dto.ts
```

### 8.1 ¿Qué es autenticarse?

Autenticarse significa **comprobar quién es el usuario**. No es lo mismo que autorización: esta última decide **qué operaciones puede realizar** después de identificarse.

### 8.2 Creación del administrador inicial

Al iniciar NestJS, `AuthService` implementa `OnModuleInit` y lee `ADMIN_USERNAME` y `ADMIN_PASSWORD` de `backend/.env`. Valida que la contraseña tenga al menos 12 caracteres, calcula un hash con `bcryptjs` e inserta el usuario si todavía no existe:

```sql
INSERT INTO usuarios (username, password_hash, rol)
VALUES ($1, $2, 'ADMIN')
ON CONFLICT (username) DO NOTHING;
```

**Por qué hash:** no se guarda la contraseña original. Cuando alguien intenta entrar, `compare()` contrasta la contraseña introducida con el hash almacenado.

**Importante:** si ya se creó el administrador, cambiar `ADMIN_PASSWORD` en `.env` no sustituye automáticamente su contraseña anterior debido a `ON CONFLICT DO NOTHING`. La versión de la Clase 8 usa un único rol `ADMIN` como simplificación educativa; no ofrece registro público de usuarios.

### 8.3 Inicio de sesión

**Endpoint:** `POST /api/auth/login`.

El navegador envía JSON:

```json
{
  "username": "admin",
  "password": "CONTRASENA_DE_PRUEBA"
}
```

Flujo:

1. `LoginDto` valida que se hayan recibido dos cadenas no vacías.
2. `AuthService.validar()` consulta al usuario por nombre.
3. `bcryptjs.compare()` verifica la contraseña.
4. Si falla, NestJS devuelve `401 Unauthorized`.
5. Si es correcta, `req.session.regenerate()` crea una nueva identidad de sesión (defensa ante fijación de sesión).
6. Se guardan `usuarioId`, `username` y `rol` en la sesión y se confirma su almacenamiento.
7. El navegador recibe una cookie con el identificador de la sesión.

**La cookie no contiene la contraseña:** contiene un identificador que el servidor utiliza para recuperar el estado guardado de la sesión.

### 8.4 Consultar y cerrar sesión

- `GET /api/auth/me`: revisa la sesión enviada por el navegador y responde los datos del usuario actual; sin sesión devuelve `401`.
- `POST /api/auth/logout`: destruye la sesión en el servidor y ordena al navegador eliminar la cookie de sesión.

## 9. Sesiones y cookies: cómo se mantiene el login

**Archivos:** `backend/src/main.ts` y `backend/src/types/express-session.d.ts`.

En `main.ts` se usa `express-session` con `connect-pg-simple`. El segundo guarda la información de sesión en una tabla de PostgreSQL que se crea automáticamente al iniciar el sistema si no existe.

Fragmento conceptual, con el ajuste aplicado durante la puesta en marcha:

```typescript
const PgStore = connectPgSimple(session);
app.use(session({
  name: 'micros.sid',
  secret,
  resave: false,
  saveUninitialized: false,
  store: new PgStore({
    pool: database.getPool(),
    createTableIfMissing: true
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 1000
  }
}));
```

- **`httpOnly: true`:** JavaScript del navegador no puede leer directamente el valor de la cookie.
- **`sameSite: 'lax'`:** restringe determinados envíos de cookies entre sitios. No sustituye por sí sola la protección CSRF completa.
- **`secure: false`:** se permite HTTP en `localhost` para la práctica; producción requiere HTTPS y cookies seguras.
- **`maxAge`:** duración de la cookie (una hora en el ejemplo).
- **`secret`:** firma la cookie; debe ser aleatorio y mantenerse fuera de Git.
- **`store`:** guarda las sesiones del servidor en PostgreSQL, no en arreglos de memoria.

**Diferencia importante:** la sesión puede sobrevivir al reinicio de NestJS porque está almacenada en la base de datos, pero esto también depende de que siga siendo válida, no haya expirado y se conserve la cookie del navegador.

El archivo `express-session.d.ts` amplía los tipos de TypeScript para reconocer `usuarioId`, `username` y `rol` dentro de `req.session`.

## 10. Autorización: impedir operaciones sin permiso

**Archivo:** `backend/src/auth/session.guard.ts`.

En la Clase 8 se implementa un **Guard** de NestJS:

```typescript
if (!req.session?.usuarioId) {
  throw new UnauthorizedException('Debe iniciar sesión');
}
if (req.session.rol !== 'ADMIN') {
  throw new ForbiddenException('No tiene permisos');
}
return true;
```

- `401 Unauthorized`: no hay sesión autenticada.
- `403 Forbidden`: existe sesión, pero no tiene rol autorizado.
- `true`: la solicitud puede continuar hasta el controlador.

**Archivo:** `backend/src/micros/micros.controller.ts`.

```typescript
@Post()
@UseGuards(SessionGuard)
create(@Body() dto: CreateMicroDto) {
  return this.service.create(dto);
}
```

La misma protección se aplica a `PATCH` y `DELETE`. En cambio, `GET /api/lineas` y `GET /api/micros` continúan públicos.

**Por qué el Guard es imprescindible:** ocultar el botón «Registrar» en Next.js no protege el endpoint. Una persona podría enviar un POST directamente usando un cliente HTTP. El backend debe rechazarlo si no hay autorización.

## 11. Cambios en Next.js

**Archivos:**

```text
frontend/src/lib/api.ts
frontend/src/lib/types.ts
frontend/src/app/page.tsx
```

### 11.1 Enviar cookies con `fetch`

En `api.ts` se añadió:

```typescript
credentials: 'include'
```

Esto permite que el navegador incluya cookies en las solicitudes al backend. NestJS también configura CORS con `credentials: true` y el origen explícito `http://localhost:3000`.

**Nota:** el frontend y backend usan `localhost` con puertos distintos: son **orígenes distintos**, por lo que se debe configurar CORS. Para esta práctica conviene no alternar entre `localhost` y `127.0.0.1`.

### 11.2 Funciones nuevas de la API

```typescript
login: (username: string, password: string) =>
  request<Usuario>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
usuarioActual: () => request<Usuario>('/auth/me'),
logout: () => request<{ mensaje: string }>('/auth/logout', {
  method: 'POST'
})
```

**Ventaja:** `page.tsx` no necesita construir todas las URL ni repetir los detalles de `fetch`. La capa `api.ts` concentra la comunicación HTTP.

### 11.3 Estado de usuario en la interfaz

En `page.tsx` se añaden estados como `usuario`, `username`, `password`, `errorLogin` y `procesandoLogin`.

- Al cargar la página, `api.usuarioActual()` intenta recuperar la sesión existente.
- Al enviar el formulario, `api.login()` actualiza el estado `usuario` si las credenciales son correctas.
- Al cerrar sesión, `api.logout()` destruye la sesión y se limpia el estado del frontend.
- La interfaz muestra el formulario de administración y los botones de modificación únicamente si existe una sesión reconocida.

**Distinción docente:** mostrar u ocultar elementos es una decisión de presentación; la autorización efectiva continúa en NestJS mediante `SessionGuard`.

## 12. Rutas HTTP de la Clase 8

| Método | Ruta | Operación | Acceso |
|---|---|---|---|
| GET | `/api/lineas` | Listar líneas | Público |
| GET | `/api/lineas/:id` | Consultar una línea | Público |
| GET | `/api/micros` | Listar micros | Público |
| GET | `/api/micros/:id` | Consultar un micro | Público |
| POST | `/api/micros` | Registrar micro | Sesión ADMIN |
| PATCH | `/api/micros/:id` | Editar micro | Sesión ADMIN |
| DELETE | `/api/micros/:id` | Eliminar micro | Sesión ADMIN |
| POST | `/api/auth/login` | Iniciar sesión | Público |
| GET | `/api/auth/me` | Consultar sesión | Sesión iniciada |
| POST | `/api/auth/logout` | Cerrar sesión | Finaliza la sesión si existe |

## 13. Variables de entorno y qué significa cada una

### `.env` de la raíz

```dotenv
POSTGRES_PASSWORD=REEMPLAZAR_CON_VALOR_LOCAL
```

Compose usa esa contraseña al inicializar PostgreSQL.

### `backend/.env`

```dotenv
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://micros:REEMPLAZAR_CON_CLAVE@localhost:5433/micros_scz
SESSION_SECRET=REEMPLAZAR_CON_SECRETO_ALEATORIO_LARGO
ADMIN_USERNAME=admin
ADMIN_PASSWORD=REEMPLAZAR_CON_CLAVE_ADMIN_DE_AL_MENOS_12_CARACTERES
```

- `DATABASE_URL`: contraseña, host, puerto y nombre de la base deben coincidir con Docker.
- `FRONTEND_ORIGIN`: origen autorizado para las solicitudes del navegador.
- `SESSION_SECRET`: secreto que utiliza el middleware de sesión; generar con `openssl rand -hex 32`.
- `ADMIN_USERNAME` y `ADMIN_PASSWORD`: credenciales iniciales para laboratorio.

### `frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

La dirección debe acabar en `/api`, **sin `/n`, `\n` literal ni `/lineas`**. El prefijo `NEXT_PUBLIC_` permite que Next.js exponga la URL al código del navegador; no debe utilizarse para secretos.

**Seguridad:** nunca subir los archivos `.env` con valores reales. Verificar `.gitignore` antes de `git add`.

## 14. Pasos para replicar las mejoras en otro proyecto

El objetivo es comprender el patrón y no copiar archivos sin analizarlos.

1. **Identificar el recurso y su modelo:** por ejemplo, `micros`, `vehiculos` o `reservas`. Definir campos, tipos y reglas.
2. **Definir el contrato REST:** decidir qué endpoints son públicos y cuáles modifican datos.
3. **Crear Compose y la base de datos:** definir usuario, contraseña, volumen y script de inicialización.
4. **Diseñar tablas y relaciones:** claves primarias, foráneas, índices únicos y restricciones.
5. **Crear un servicio de base de datos en NestJS:** conexión compartida y consultas parametrizadas.
6. **Migrar los servicios del CRUD:** reemplazar arreglos por `SELECT`, `INSERT`, `UPDATE`, `DELETE` sin cambiar innecesariamente los formatos JSON.
7. **Probar persistencia:** crear un registro, reiniciar NestJS y confirmar que se conserva.
8. **Crear la tabla de usuarios:** guardar hashes de contraseña, no texto plano.
9. **Implementar los endpoints de autenticación:** login, consulta de sesión y logout.
10. **Configurar cookies y almacén de sesiones:** usar middleware de sesión y almacenamiento del lado del servidor.
11. **Crear un Guard:** asegurar en el backend las rutas que modifican información.
12. **Adaptar el frontend:** usar `credentials: 'include'`, formulario de login y estado del usuario.
13. **Probar casos correctos y errores:** credenciales inválidas, sin sesión, datos duplicados, sesión expirada, servidor desconectado.
14. **Documentar y versionar:** confirmar que la versión anterior sigue disponible en Git.

## 15. Prácticas de verificación

| Caso de prueba | Resultado esperado | Concepto evaluado |
|---|---|---|
| Abrir catálogo sin login | Se muestran las líneas | Acceso público |
| Consultar micros sin login | HTTP 200 | Lectura pública |
| Enviar POST sin sesión | HTTP 401 | Autenticación requerida |
| Login con contraseña errónea | HTTP 401 | Verificación de credenciales |
| Login con credenciales válidas | Sesión iniciada | Cookies y sesión |
| Registrar micro con login | HTTP 201 | Escritura autorizada |
| Registrar placa duplicada | HTTP 409 | Integridad y manejo de errores |
| Enviar PATCH sobre micro existente | HTTP 200 | Actualización persistente |
| Enviar DELETE con sesión ADMIN | HTTP 204 | Eliminación autorizada |
| Reiniciar NestJS y consultar | El micro sigue en la BD | Persistencia |
| Cerrar sesión y enviar POST | HTTP 401 | Invalidación de sesión |

### Demostración para explicar persistencia

1. Iniciar Docker, backend y frontend.
2. Iniciar sesión como administrador.
3. Registrar un micro nuevo y comprobarlo en el catálogo.
4. Detener solamente NestJS con `Control + C`.
5. Volver a iniciar `npm run start:dev`.
6. Recargar Next.js y verificar que el micro permanece.
7. Mostrar `SELECT * FROM micros;` en PostgreSQL.

### Consultar datos directamente en PostgreSQL

Desde la **raíz del proyecto**:

```bash
docker compose exec postgres psql -U micros -d micros_scz
```

En `psql`:

```sql
SELECT id, placa, interno, capacidad, estado, linea_id FROM micros ORDER BY id;
SELECT id, username, rol FROM usuarios;
```

No mostrar hashes ni contraseñas en capturas o presentaciones para el alumnado.

## 16. Posibles Errores al poner en marcha el proyecto

| Error | Explicación | Corrección |
|---|---|---|
| `POSTGRES_PASSWORD variable is not set` | Falta `.env` en la raíz | Crear `.env` y establecer la variable esperada por Compose |
| Contenedor PostgreSQL reiniciando | Falló la inicialización o configuración | Revisar `docker compose ps` y `docker compose logs postgres` |
| `Type 'T' does not satisfy ... QueryResultRow` | El genérico de `pg` necesita una restricción | `query<T extends QueryResultRow>` |
| `Property 'pool' is private` | `main.ts` intenta acceder a un atributo privado | Añadir `getPool()` y usar `database.getPool()` |
| `next: command not found` | Falta instalar dependencias del frontend | Desde `frontend`, ejecutar `npm install` |
| `Cannot GET /api/n/lineas` | URL base mal formada | Corregir `frontend/.env.local` a `http://localhost:3001/api` |
| `zsh: command not found: dt` | `\dt` se ejecutó en zsh | Entrar primero a `psql` y después ejecutar `\dt` |

Para diagnosticar un problema, **leer primero el mensaje exacto** y corregir la capa involucrada. No borrar volúmenes, carpetas o dependencias sin identificar la causa.

## 17. Git: dos versiones para comparar

El repositorio conserva la versión de la Clase 7 en `main` y publica la nueva versión en `clase-8`.

**Estudiantes que ya clonaron el proyecto:**

```bash
git fetch origin
git switch --track origin/clase-8
```

Si la rama `clase-8` ya existe en su máquina, usar `git switch clase-8` y luego `git pull origin clase-8`, siempre guardando primero los cambios propios.

**Comparar ramas:**

```bash
git diff main..clase-8 -- backend/src
```

El objetivo de comparar ramas es observar cómo cambian los servicios, controladores y configuración sin confundir los contenidos de cada clase.

## 18. Actividades de estudio y réplica

**Actividad 2 — Análisis:**

1. Explica por qué en Clase 7 se perdían los micros al reiniciar el backend.
2. Explica por qué ahora `LineasService` devuelve una `Promise<Linea[]>`.
3. ¿Qué problema resuelve `linea_id REFERENCES lineas(id)`?
4. ¿Qué diferencia existe entre autenticar un usuario y autorizar un POST?
5. ¿Por qué ocultar un botón no garantiza la seguridad de la API?
6. ¿Qué contiene la cookie y dónde están los datos de la sesión?
7. ¿Qué ocurre si PostgreSQL se detiene, aunque Next.js y NestJS sigan abiertos?
8. ¿Para qué sirven los marcadores `$1`, `$2` en SQL?

**Actividad 3 — Réplica:** crear una pequeña aplicación diferente (por ejemplo, inventario de equipos o reservas de turnos), conservar su frontend y API REST, sustituir el almacenamiento en memoria por PostgreSQL y proteger las operaciones de escritura mediante sesiones. Presentar evidencia de persistencia, login y respuestas HTTP correctas.

# Para acceder a la rama de git ocupen el mismo enlace pero con otra rama llama --CambiosJueves
SWITCH brach -- CambiosJueves
