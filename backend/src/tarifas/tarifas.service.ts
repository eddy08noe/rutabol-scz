import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CrearTarifaDto } from './dto/crear-tarifa.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class TarifasService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  listar(lineaId?: number, categoria?: string, usuarioId?: number, rol?: Rol) {
    return this.db.query(
      `SELECT t.id, t.linea_id AS "lineaId", l.nombre AS linea, t.categoria,
              t.importe, t.moneda, t.vigente_desde AS "vigenteDesde",
              t.vigente_hasta AS "vigenteHasta", t.activa
         FROM tarifas t JOIN lineas l ON l.id = t.linea_id
        WHERE ($1::int IS NULL OR t.linea_id = $1)
          AND ($2::text IS NULL OR t.categoria = $2)
          AND t.activa AND CURRENT_DATE >= t.vigente_desde
          AND (t.vigente_hasta IS NULL OR CURRENT_DATE <= t.vigente_hasta)
          AND ($4::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
            (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $3 AND ol.linea_id = t.linea_id))
        ORDER BY l.nombre, t.categoria`, [lineaId ?? null, categoria ?? null, usuarioId ?? null, rol ?? null]
    );
  }

  async crear(dto: CrearTarifaDto, adminId: number, rol: Rol = 'ADMIN') {
    await this.permisos.verificarLinea(adminId, rol, dto.lineaId);
    if (dto.vigenteHasta && dto.vigenteHasta < dto.vigenteDesde) {
      throw new BadRequestException('vigenteHasta no puede ser anterior a vigenteDesde');
    }
    const overlap = await this.db.query(
      `SELECT id FROM tarifas
        WHERE linea_id = $1 AND categoria = $2 AND activa
          AND daterange(vigente_desde, COALESCE(vigente_hasta + 1, 'infinity'::date), '[)')
              && daterange($3::date, COALESCE($4::date + 1, 'infinity'::date), '[)')`,
      [dto.lineaId, dto.categoria, dto.vigenteDesde, dto.vigenteHasta ?? null]
    );
    if (overlap.length) throw new ConflictException('Ya existe una tarifa activa con fechas que se superponen');
    try {
      const rows = await this.db.query(
        `INSERT INTO tarifas (linea_id, categoria, importe, vigente_desde, vigente_hasta, creada_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, linea_id AS "lineaId", categoria, importe, moneda,
                   vigente_desde AS "vigenteDesde", vigente_hasta AS "vigenteHasta", activa`,
        [dto.lineaId, dto.categoria, dto.importe, dto.vigenteDesde, dto.vigenteHasta ?? null, adminId]
      );
      return rows[0];
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23503') throw new BadRequestException('La línea indicada no existe');
      if (code === '23505') throw new ConflictException('Ya existe una tarifa con esa fecha de inicio');
      throw error;
    }
  }

  async desactivar(id: number, usuarioId: number, rol: Rol) {
    const tarifa = await this.db.query<{ linea_id: number }>('SELECT linea_id FROM tarifas WHERE id = $1', [id]);
    if (!tarifa[0]) throw new NotFoundException('Tarifa no encontrada');
    await this.permisos.verificarLinea(usuarioId, rol, tarifa[0].linea_id);
    const rows = await this.db.query('UPDATE tarifas SET activa = FALSE WHERE id = $1 RETURNING id', [id]);
    if (!rows[0]) throw new NotFoundException('Tarifa no encontrada');
    return { mensaje: 'Tarifa desactivada' };
  }
}
