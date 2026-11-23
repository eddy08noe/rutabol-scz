import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CrearViajeDto } from './dto/crear-viaje.dto';
import { CrearIncidenteDto } from './dto/crear-incidente.dto';
import { Rol } from '../common/roles.decorator';
import { LineaPermisosService } from '../common/linea-permisos.service';

@Injectable()
export class ViajesService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  listar(lineaId?: number, estado?: string, usuarioId?: number, rol?: Rol) {
    return this.db.query(
      `SELECT v.id, v.linea_id AS "lineaId", l.nombre AS linea, v.micro_id AS "microId",
              m.placa, m.interno, v.conductor_id AS "conductorId",
              c.nombres || ' ' || c.apellidos AS conductor, v.estado,
              v.iniciado_en AS "iniciadoEn", v.finalizado_en AS "finalizadoEn"
         FROM viajes v JOIN lineas l ON l.id = v.linea_id
         JOIN micros m ON m.id = v.micro_id
         JOIN conductores c ON c.id = v.conductor_id
        WHERE ($1::int IS NULL OR v.linea_id = $1)
          AND ($2::text IS NULL OR v.estado = $2)
          AND ($4::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
            (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $3 AND ol.linea_id = v.linea_id))
          AND ($4::text IS DISTINCT FROM 'CHOFER' OR EXISTS
            (SELECT 1 FROM conductores c WHERE c.id = v.conductor_id AND c.usuario_id = $3 AND c.activo))
        ORDER BY v.creado_en DESC`, [lineaId ?? null, estado ?? null, usuarioId ?? null, rol ?? null]
    );
  }

  async crear(dto: CrearViajeDto, usuarioId: number, rol: Rol) {
    await this.permisos.verificarLinea(usuarioId, rol, dto.lineaId);
    await this.permisos.verificarLinea(usuarioId, rol, (await this.db.query<{ linea_id: number }>('SELECT linea_id FROM micros WHERE id = $1', [dto.microId]))[0]?.linea_id ?? -1);
    if (rol === 'ORGANIZADOR') {
      const conductor = await this.db.query('SELECT 1 FROM conductor_lineas WHERE conductor_id = $1 AND linea_id = $2', [dto.conductorId, dto.lineaId]);
      if (!conductor.length) throw new BadRequestException('El conductor no está asignado a esta línea');
    }
    try {
      const rows = await this.db.query(
        `INSERT INTO viajes (linea_id, micro_id, conductor_id)
         VALUES ($1, $2, $3)
         RETURNING id, linea_id AS "lineaId", micro_id AS "microId", conductor_id AS "conductorId", estado, creado_en AS "creadoEn"`,
        [dto.lineaId, dto.microId, dto.conductorId]
      );
      return rows[0];
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23503') throw new BadRequestException('La línea, micro o conductor no existe');
      if (code === '23505') throw new ConflictException('El micro o conductor ya tiene un viaje en curso');
      throw error;
    }
  }

  async iniciar(id: number, usuarioId: number, rol: Rol) {
    await this.verificarResponsable(id, usuarioId, rol);
    const rows = await this.db.query(
      `UPDATE viajes SET estado = 'EN_CURSO', iniciado_en = NOW()
        WHERE id = $1 AND estado = 'PROGRAMADO'
        RETURNING id, estado, iniciado_en AS "iniciadoEn"`, [id]
    );
    if (!rows[0]) throw new ConflictException('El viaje no existe o ya no está PROGRAMADO');
    return rows[0];
  }

  async finalizar(id: number, usuarioId: number, rol: Rol) {
    await this.verificarResponsable(id, usuarioId, rol);
    const ocupacion = await this.db.query<{ cantidad: string }>(
      'SELECT COUNT(*)::text AS cantidad FROM abordajes WHERE viaje_id = $1 AND bajo_en IS NULL', [id]
    );
    if (Number(ocupacion[0]?.cantidad ?? 0) > 0) throw new ConflictException('Registra el descenso de los pasajeros antes de finalizar el viaje');
    const rows = await this.db.query(
      `UPDATE viajes SET estado = 'FINALIZADO', finalizado_en = NOW()
        WHERE id = $1 AND estado IN ('EN_CURSO', 'EMERGENCIA')
        RETURNING id, estado, finalizado_en AS "finalizadoEn"`, [id]
    );
    if (!rows[0]) throw new ConflictException('El viaje no está activo');
    return rows[0];
  }

  async reportarIncidente(id: number, usuarioId: number, rol: Rol, dto: CrearIncidenteDto) {
    await this.verificarResponsable(id, usuarioId, rol);
    if (!dto.descripcion.trim()) throw new BadRequestException('Describe la emergencia');
    return this.db.transaction(async client => {
      const viaje = await client.query('SELECT id, estado FROM viajes WHERE id = $1 FOR UPDATE', [id]);
      if (!viaje.rowCount || !['EN_CURSO', 'EMERGENCIA'].includes(viaje.rows[0].estado)) {
        throw new ConflictException('Solo se puede reportar una emergencia en un viaje activo');
      }
      const incident = await client.query(
        `INSERT INTO incidentes (viaje_id, reportado_por, tipo, descripcion, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, viaje_id AS "viajeId", tipo, descripcion, latitud, longitud, estado, ocurrido_en AS "ocurridoEn"`,
        [id, usuarioId, dto.tipo, dto.descripcion.trim(), dto.latitud ?? null, dto.longitud ?? null]
      );
      await client.query("UPDATE viajes SET estado = 'EMERGENCIA' WHERE id = $1", [id]);
      return incident.rows[0];
    });
  }

  async aforo(id: number) {
    const rows = await this.db.query(
      `SELECT v.id AS "viajeId", v.estado, m.id AS "microId", m.placa, m.interno,
              m.capacidad_operativa AS capacidad,
              m.capacidad AS "capacidadAutorizada",
              m.capacidad_sentados AS "capacidadSentados",
              m.capacidad_sentados AS "capacidadSugeridaSentados",
              m.capacidad_parados_autorizada AS "capacidadParadosAutorizada",
              COUNT(a.id)::int AS ocupacion,
              GREATEST(m.capacidad_operativa - COUNT(a.id)::int, 0) AS disponibles
         FROM viajes v JOIN micros m ON m.id = v.micro_id
         LEFT JOIN abordajes a ON a.viaje_id = v.id AND a.bajo_en IS NULL
        WHERE v.id = $1 GROUP BY v.id, m.id`, [id]
    );
    if (!rows[0]) throw new NotFoundException('Viaje no encontrado');
    return rows[0];
  }

  private async verificarResponsable(viajeId: number, usuarioId: number, rol: Rol) {
    if (rol === 'ADMIN') return;
    if (rol === 'ORGANIZADOR') {
      await this.permisos.verificarRecurso(usuarioId, rol, 'viajes', viajeId);
      return;
    }
    const rows = await this.db.query(
      `SELECT 1 FROM viajes v JOIN conductores c ON c.id = v.conductor_id
        WHERE v.id = $1 AND c.usuario_id = $2 AND c.activo`, [viajeId, usuarioId]
    );
    if (!rows.length) throw new ForbiddenException('El viaje no está asignado a tu cuenta de chofer');
  }
}
