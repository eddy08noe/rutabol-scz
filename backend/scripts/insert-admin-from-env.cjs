const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { hash } = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const username = process.env.ADMIN_USERNAME?.trim() || 'admin';
  let password = process.env.ADMIN_PASSWORD;
  let passwordGenerada = false;
  if (!password || password.length < 12 || /REEMPLAZAR|CAMBIAR/i.test(password)) {
    password = randomBytes(24).toString('base64url');
    passwordGenerada = true;
    let env = fs.readFileSync(envPath, 'utf8');
    if (/^ADMIN_USERNAME=/m.test(env)) env = env.replace(/^ADMIN_USERNAME=.*$/m, `ADMIN_USERNAME=${username}`);
    else env += `\nADMIN_USERNAME=${username}`;
    if (/^ADMIN_PASSWORD=/m.test(env)) env = env.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${password}`);
    else env += `\nADMIN_PASSWORD=${password}`;
    fs.writeFileSync(envPath, env);
    process.env.ADMIN_PASSWORD = password;
  }
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en backend/.env.');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await pool.query('SELECT 1 FROM usuarios LIMIT 1');
    const passwordHash = await hash(password, 12);
    const result = await pool.query(
      `INSERT INTO usuarios (username, password_hash, rol, nombre_completo, activo)
       VALUES ($1, $2, 'ADMIN', 'Administrador', TRUE)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         rol = 'ADMIN',
         activo = TRUE
       RETURNING username, rol`,
      [username, passwordHash],
    );
    process.stdout.write(`Cuenta ADMIN lista: ${result.rows[0].username}\n`);
    if (passwordGenerada) process.stdout.write(`Contraseña inicial: ${password}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo insertar la cuenta ADMIN.'}\n`);
  process.exitCode = 1;
});
