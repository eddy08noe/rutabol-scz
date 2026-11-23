import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CrearParadaDto } from './dto/crear-parada.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class ParadasService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  listar(lineaId?: number, usuarioId?: number, rol?: Rol) {
    return this.db.query(
      `SELECT p.id, p.nombre, p.latitud, p.longitud, lp.linea_id AS "lineaId", lp.orden
         FROM paradas p LEFT JOIN linea_paradas lp ON lp.parada_id = p.id
        WHERE p.activa AND ($1::int IS NULL OR lp.linea_id = $1)
          AND ($3::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
            (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $2 AND ol.linea_id = lp.linea_id))
        ORDER BY lp.linea_id NULLS LAST, lp.orden NULLS LAST, p.nombre`, [lineaId ?? null, usuarioId ?? null, rol ?? null]
    );
  }

  async crear(dto: CrearParadaDto, usuarioId: number, rol: Rol) {
    await this.permisos.verificarLinea(usuarioId, rol, dto.lineaId);
    try {
      return await this.db.transaction(async client => {
        const rows = await client.query<{ id: number }>(
          `INSERT INTO paradas (nombre, latitud, longitud) VALUES ($1, $2, $3) RETURNING id`,
          [dto.nombre.trim(), dto.latitud ?? null, dto.longitud ?? null]
        );
        await client.query('INSERT INTO linea_paradas (linea_id, parada_id, orden) VALUES ($1, $2, $3)',
          [dto.lineaId, rows.rows[0].id, dto.orden]);
        return { id: rows.rows[0].id, ...dto };
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23503') throw new BadRequestException('La línea indicada no existe');
      if (code === '23505') throw new ConflictException('La parada o el orden ya están asignados a esa línea');
      throw error;
    }
  }

  async desactivar(id: number, usuarioId: number, rol: Rol) {
    const lineas = await this.db.query<{ linea_id: number }>('SELECT linea_id FROM linea_paradas WHERE parada_id = $1', [id]);
    if (!lineas.length) throw new NotFoundException('Parada no encontrada o sin línea asignada');
    for (const linea of lineas) await this.permisos.verificarLinea(usuarioId, rol, linea.linea_id);
    const rows = await this.db.query('UPDATE paradas SET activa = FALSE WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('Parada no encontrada');
    return { mensaje: 'Parada desactivada' };
  }
}
