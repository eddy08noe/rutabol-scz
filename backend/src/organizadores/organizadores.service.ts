import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class OrganizadoresService {
  constructor(private readonly db: DatabaseService) {}

  listar() {
    return this.db.query(
      `SELECT u.id AS "usuarioId", u.username, u.nombre_completo AS "nombreCompleto", u.correo,
              COALESCE(json_agg(json_build_object('id', l.id, 'nombre', l.nombre))
                FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS lineas
         FROM usuarios u LEFT JOIN organizador_lineas ol ON ol.usuario_id = u.id
         LEFT JOIN lineas l ON l.id = ol.linea_id
        WHERE u.rol = 'ORGANIZADOR' AND u.activo
        GROUP BY u.id ORDER BY u.username`);
  }

  async crear(adminId: number, dto: { username: string; password: string; nombreCompleto: string; correo: string; lineaIds: number[] }) {
    const ids = [...new Set(dto.lineaIds)];
    const correo = dto.correo.trim().toLowerCase();
    try {
      const passwordHash = await hash(dto.password, 12);
      return await this.db.transaction(async client => {
        const lines = await client.query<{ id: number }>(
          'SELECT id FROM lineas WHERE activa AND id = ANY($1::int[])', [ids]);
        if (lines.rowCount !== ids.length) throw new NotFoundException('Una o más líneas no existen o están inactivas');
        const user = await client.query<{ id: number }>(
          `INSERT INTO usuarios (username, password_hash, rol, nombre_completo, correo)
           VALUES ($1, $2, 'ORGANIZADOR', $3, $4) RETURNING id`,
          [dto.username.trim(), passwordHash, dto.nombreCompleto.trim(), correo]);
        await client.query(
          `INSERT INTO organizador_lineas (usuario_id, linea_id, asignado_por)
           SELECT $1, unnest($2::int[]), $3`, [user.rows[0].id, ids, adminId]);
        return { usuarioId: user.rows[0].id, username: dto.username.trim(), nombreCompleto: dto.nombreCompleto.trim(), correo, lineaIds: ids };
      });
    } catch (error) {
      const dbError = error as { code?: string; constraint?: string };
      if (dbError.code === '23505' && dbError.constraint === 'usuarios_correo_lower_uq') {
        throw new ConflictException('Ese correo ya está registrado');
      }
      if (dbError.code === '23505') throw new ConflictException('Ese nombre de usuario ya existe');
      throw error;
    }
  }

  async asignarLineas(adminId: number, usuarioId: number, lineaIds: number[]) {
    const ids = [...new Set(lineaIds)];
    return this.db.transaction(async client => {
      const user = await client.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE id = $1 AND rol = 'ORGANIZADOR' AND activo FOR UPDATE", [usuarioId]);
      if (!user.rowCount) throw new NotFoundException('Organizador no encontrado');
      const lines = await client.query<{ id: number }>(
        'SELECT id FROM lineas WHERE activa AND id = ANY($1::int[])', [ids]);
      if (lines.rowCount !== ids.length) throw new NotFoundException('Una o más líneas no existen o están inactivas');
      await client.query('DELETE FROM organizador_lineas WHERE usuario_id = $1', [usuarioId]);
      await client.query(
        `INSERT INTO organizador_lineas (usuario_id, linea_id, asignado_por)
         SELECT $1, unnest($2::int[]), $3`, [usuarioId, ids, adminId]);
      return { usuarioId, lineaIds: ids };
    });
  }
}
