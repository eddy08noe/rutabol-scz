import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Rol } from '../common/roles.decorator';
import { CrearUbicacionDto } from './dto/crear-ubicacion.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';

@Injectable()
export class UbicacionesService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  async registrar(usuarioId: number, rol: Rol, dto: CrearUbicacionDto) {
    const rows = await this.db.query<{ micro_id: number }>(
      `SELECT v.micro_id FROM viajes v
        WHERE v.id = $1 AND v.estado = 'EN_CURSO'
          AND ($2::text = 'ADMIN' OR ($2::text = 'ORGANIZADOR' AND EXISTS (
            SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $3 AND ol.linea_id = v.linea_id
          )) OR EXISTS (
            SELECT 1 FROM conductores c WHERE c.id = v.conductor_id AND c.usuario_id = $3 AND c.activo
          ))`, [dto.viajeId, rol, usuarioId]
    );
    if (!rows[0]) throw new ForbiddenException('Viaje inactivo o no asignado a tu cuenta');
    const result = await this.db.query(
      `INSERT INTO ubicaciones_micro (micro_id, viaje_id, latitud, longitud)
       VALUES ($1, $2, $3, $4)
       RETURNING id, micro_id AS "microId", viaje_id AS "viajeId", latitud, longitud, registrada_en AS "registradaEn"`,
      [rows[0].micro_id, dto.viajeId, dto.latitud, dto.longitud]
    );
    return result[0];
  }

  async historialMicro(microId: number, usuarioId: number, rol: Rol, limit = 100) {
    const exists = await this.db.query('SELECT id FROM micros WHERE id = $1', [microId]);
    if (!exists.length) throw new NotFoundException('Micro no encontrado');
    await this.permisos.verificarRecurso(usuarioId, rol, 'micros', microId);
    return this.db.query(
      `SELECT id, viaje_id AS "viajeId", latitud, longitud, registrada_en AS "registradaEn"
         FROM ubicaciones_micro WHERE micro_id = $1 ORDER BY registrada_en DESC LIMIT $2`,
      [microId, Math.min(Math.max(limit, 1), 500)]
    );
  }
}
