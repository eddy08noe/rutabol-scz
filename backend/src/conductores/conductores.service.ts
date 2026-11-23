import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CrearConductorDto } from './dto/crear-conductor.dto';
import { ActualizarConductorDto } from './dto/actualizar-conductor.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class ConductoresService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  listar(usuarioId: number, rol: Rol): Promise<object[]> {
    return this.db.query(
      `SELECT c.id, c.usuario_id AS "usuarioId", u.username, u.correo, c.nombres, c.apellidos,
              c.licencia, c.activo, c.creado_en AS "creadoEn"
         FROM conductores c LEFT JOIN usuarios u ON u.id = c.usuario_id
        WHERE ($1::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
          (SELECT 1 FROM conductor_lineas cl JOIN organizador_lineas ol ON ol.linea_id = cl.linea_id
            WHERE cl.conductor_id = c.id AND ol.usuario_id = $2))
         ORDER BY c.apellidos, c.nombres`, [rol, usuarioId]);
  }

  async buscar(id: number, usuarioId: number, rol: Rol): Promise<object> {
    await this.permisos.verificarRecurso(usuarioId, rol, 'conductores', id);
    const rows = await this.db.query(
      `SELECT c.id, c.usuario_id AS "usuarioId", u.username, u.correo, c.nombres, c.apellidos,
              c.licencia, c.activo, c.creado_en AS "creadoEn"
         FROM conductores c LEFT JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Conductor no encontrado');
    return rows[0];
  }

  async crear(dto: CrearConductorDto, actorId: number, rol: Rol) {
    if (rol === 'ORGANIZADOR' && !dto.lineaId) throw new BadRequestException('Indica la línea del conductor');
    if (dto.lineaId) await this.permisos.verificarLinea(actorId, rol, dto.lineaId);
    if ((dto.username && !dto.password) || (!dto.username && dto.password)) {
      throw new BadRequestException('Para crear acceso de chofer indica username y password juntos');
    }
    if (dto.username && !dto.correo?.trim()) {
      throw new BadRequestException('Indica el correo electrónico de la cuenta del chofer');
    }
    if (!dto.usuarioId && !dto.username) throw new BadRequestException('Vincula una cuenta existente o crea una cuenta de chofer');
    const correo = dto.correo?.trim().toLowerCase() ?? null;
    try {
      return await this.db.transaction(async client => {
        let usuarioId = dto.usuarioId;
        if (dto.username && dto.password) {
          const passwordHash = await hash(dto.password, 12);
          const users = await client.query<{ id: number }>(
            `INSERT INTO usuarios (username, password_hash, rol, nombre_completo, correo)
             VALUES ($1, $2, 'CHOFER', $3, $4) RETURNING id`,
            [dto.username.trim(), passwordHash, `${dto.nombres.trim()} ${dto.apellidos.trim()}`, correo]
          );
          usuarioId = users.rows[0].id;
        } else {
          const valid = await client.query('SELECT id FROM usuarios WHERE id = $1 AND rol = \'CHOFER\' AND activo', [usuarioId]);
          if (!valid.rowCount) throw new BadRequestException('La cuenta debe existir y tener rol CHOFER');
        }
        const rows = await client.query(
          `INSERT INTO conductores (usuario_id, nombres, apellidos, licencia)
           VALUES ($1, $2, $3, $4)
           RETURNING id, usuario_id AS "usuarioId", nombres, apellidos, licencia, activo`,
          [usuarioId, dto.nombres.trim(), dto.apellidos.trim(), dto.licencia.trim()]
        );
        if (dto.lineaId) await client.query(
          `INSERT INTO conductor_lineas (conductor_id, linea_id, asignado_por) VALUES ($1, $2, $3)
           ON CONFLICT (conductor_id, linea_id) DO NOTHING`, [rows.rows[0].id, dto.lineaId, actorId]);
        const driver = await client.query(
          `SELECT c.id, c.usuario_id AS "usuarioId", u.username, u.correo, c.nombres,
                  c.apellidos, c.licencia, c.activo
             FROM conductores c LEFT JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = $1`,
          [rows.rows[0].id]
        );
        return driver.rows[0];
      });
    } catch (error) {
      const dbError = error as { code?: string; constraint?: string };
      if (dbError.code === '23505' && dbError.constraint === 'usuarios_correo_lower_uq') {
        throw new ConflictException('Ese correo ya está registrado');
      }
      if (dbError.code === '23505') throw new ConflictException('La licencia, cuenta o usuario ya está registrado');
      throw error;
    }
  }

  async actualizar(id: number, dto: ActualizarConductorDto, usuarioId: number, rol: Rol) {
    await this.permisos.verificarRecurso(usuarioId, rol, 'conductores', id);
    const rows = await this.db.query(
      `UPDATE conductores SET nombres = COALESCE($2, nombres), apellidos = COALESCE($3, apellidos),
              licencia = COALESCE($4, licencia), activo = COALESCE($5, activo)
        WHERE id = $1
        RETURNING id, usuario_id AS "usuarioId", nombres, apellidos, licencia, activo`,
      [id, dto.nombres?.trim(), dto.apellidos?.trim(), dto.licencia?.trim(), dto.activo]
    );
    if (!rows[0]) throw new NotFoundException('Conductor no encontrado');
    return rows[0];
  }

  async desactivar(id: number, usuarioId: number, rol: Rol) {
    await this.permisos.verificarRecurso(usuarioId, rol, 'conductores', id);
    const rows = await this.db.query('UPDATE conductores SET activo = FALSE WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('Conductor no encontrado');
    return { mensaje: 'Conductor desactivado' };
  }
}
