# Continuación de la Clase 8 (no implementada todavía)

Este repositorio **se detiene intencionalmente al finalizar la Clase 7**.

## Situación inicial
- Next.js consume una API NestJS.
- La pantalla principal presenta un catálogo de líneas de demostración.
- Existe CRUD completo de micros.
- Los datos están en arreglos de memoria, sin usuarios ni sesiones.

## Ejercicios para la Clase 8
1. Crear un servicio `postgres` en Docker Compose con volumen.
2. Modelar las tablas `lineas` y `micros` con clave foránea.
3. Sustituir los arreglos de los servicios por operaciones SQL parametrizadas.
4. Crear tabla `usuarios`, almacenar contraseñas con hash seguro.
5. Implementar login, sesión y logout en NestJS.
6. Proteger POST/PATCH/DELETE con autenticación y autorización.
7. Agregar formulario de inicio de sesión a Next.js y configurar cookies HTTP-only.
8. Demostrar persistencia al reiniciar PostgreSQL y pérdida de sesión si se utiliza un almacén temporal.

**No adelantar estas funcionalidades en la versión de Clase 7.**
