import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LineasService } from '../lineas/lineas.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { Micro } from './micro.interface';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

const COLUMNAS = `id, placa, interno, capacidad,
  capacidad_sentados AS "capacidadSentados",
  capacidad_parados_autorizada AS "capacidadParadosAutorizada",
  capacidad_sentados AS "capacidadSugerida",
  capacidad_operativa AS "capacidadOperativa", estado, linea_id AS "lineaId"`;

@Injectable()
export class MicrosService {
  constructor(private readonly db: DatabaseService, private readonly lineas: LineasService, private readonly permisos: LineaPermisosService) {}

  findAll(usuarioId?: number, rol?: Rol): Promise<Micro[]> {
    return this.db.query<Micro>(`SELECT ${COLUMNAS} FROM micros m
      WHERE ($1::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
        (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $2 AND ol.linea_id = m.linea_id)) ORDER BY id`, [rol ?? null, usuarioId ?? null]);
  }

  async cercanos(latitud: number, longitud: number): Promise<Array<Micro & { linea: string; latitud: number; longitud: number; distanciaKm: number }>> {
    return this.db.query<Micro & { linea: string; latitud: number; longitud: number; distanciaKm: number }>(
      `WITH ultima AS (
         SELECT DISTINCT ON (u.micro_id) u.micro_id, u.latitud, u.longitud, u.registrada_en
           FROM ubicaciones_micro u
          WHERE u.registrada_en >= NOW() - INTERVAL '2 minutes'
          ORDER BY u.micro_id, u.registrada_en DESC
       ), distancias AS (
         SELECT m.id, m.placa, m.interno, m.capacidad,
                m.capacidad_sentados AS "capacidadSentados",
                m.capacidad_parados_autorizada AS "capacidadParadosAutorizada",
                m.capacidad_sentados AS "capacidadSugerida",
                m.capacidad_operativa AS "capacidadOperativa", m.estado,
                m.linea_id AS "lineaId", l.nombre AS linea,
                u.latitud, u.longitud,
                6371 * 2 * ASIN(SQRT(
                  POWER(SIN(RADIANS(u.latitud::float8 - $1) / 2), 2) +
                  COS(RADIANS($1)) * COS(RADIANS(u.latitud::float8)) *
                  POWER(SIN(RADIANS(u.longitud::float8 - $2) / 2), 2)
                )) AS distancia
           FROM ultima u
           JOIN micros m ON m.id = u.micro_id
           JOIN lineas l ON l.id = m.linea_id AND l.activa
           JOIN viajes v ON v.micro_id = m.id AND v.estado = 'EN_CURSO'
          WHERE m.estado = 'ACTIVO'
       )
       SELECT id, placa, interno, capacidad, "capacidadSentados",
              "capacidadParadosAutorizada", "capacidadSugerida", "capacidadOperativa", estado,
              "lineaId", linea, latitud, longitud,
              ROUND(distancia::numeric, 2)::float8 AS "distanciaKm"
         FROM distancias WHERE distancia <= 5 ORDER BY distancia`,
      [latitud, longitud]
    );
  }

  async findOne(id: number): Promise<Micro> {
    const rows = await this.db.query<Micro>(`SELECT ${COLUMNAS} FROM micros WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('El micro no existe');
    return rows[0];
  }

  private mapearError(error: unknown): never {
    const codigo = (error as { code?: string })?.code;
    if (codigo === '23505') throw new ConflictException('La placa o el interno ya están registrados');
    if (codigo === '23503') throw new BadRequestException('La línea seleccionada no existe');
    if (codigo === '23514') throw new BadRequestException('Revisa que sentados + parados autorizados coincida con la capacidad total y que el aforo operativo no la supere');
    throw error;
  }

  async create(dto: CreateMicroDto, usuarioId: number, rol: Rol): Promise<Micro> {
    await this.permisos.verificarLinea(usuarioId, rol, dto.lineaId);
    await this.lineas.findOne(dto.lineaId);
    const parados = dto.capacidadParadosAutorizada ?? 0;
    if (dto.capacidadSentados + parados !== dto.capacidad) {
      throw new BadRequestException('La capacidad total debe coincidir con sentados + parados autorizados');
    }
    try {
      const rows = await this.db.query<Micro>(
        `INSERT INTO micros (placa, interno, capacidad, capacidad_sentados,
           capacidad_parados_autorizada, capacidad_operativa, estado, linea_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLUMNAS}`,
        [dto.placa.trim().toUpperCase(), dto.interno.trim(), dto.capacidad,
          dto.capacidadSentados, parados, dto.capacidadOperativa ?? null, dto.estado, dto.lineaId]
      );
      return rows[0];
    } catch (error) { return this.mapearError(error); }
  }

  async update(id: number, dto: UpdateMicroDto, usuarioId: number, rol: Rol): Promise<Micro> {
    const actual = await this.findOne(id);
    await this.permisos.verificarLinea(usuarioId, rol, actual.lineaId);
    const cambios = { ...actual, ...dto };
    const capacidadSentados = dto.capacidadSentados ?? actual.capacidadSentados;
    const capacidadParados = dto.capacidadParadosAutorizada ?? actual.capacidadParadosAutorizada;
    if ((capacidadSentados === null && capacidadParados > 0) ||
        (capacidadSentados !== null && capacidadSentados + capacidadParados !== cambios.capacidad)) {
      throw new BadRequestException('La capacidad total debe coincidir con sentados + parados autorizados');
    }
    await this.lineas.findOne(cambios.lineaId);
    await this.permisos.verificarLinea(usuarioId, rol, cambios.lineaId);
    try {
      const rows = await this.db.query<Micro>(
        `UPDATE micros SET placa = $1, interno = $2, capacidad = $3,
         capacidad_sentados = $4, capacidad_parados_autorizada = $5,
         capacidad_operativa = COALESCE($6, capacidad_operativa),
         estado = $7, linea_id = $8 WHERE id = $9 RETURNING ${COLUMNAS}`,
        [cambios.placa.trim().toUpperCase(), cambios.interno.trim(), cambios.capacidad,
          capacidadSentados, capacidadParados, dto.capacidadOperativa,
          cambios.estado, cambios.lineaId, id]
      );
      if (!rows[0]) throw new NotFoundException('El micro no existe');
      return rows[0];
    } catch (error) { return this.mapearError(error); }
  }

  async remove(id: number, usuarioId: number, rol: Rol): Promise<void> {
    const micro = await this.findOne(id);
    await this.permisos.verificarLinea(usuarioId, rol, micro.lineaId);
    const rows = await this.db.query<{ id: number }>(
      `UPDATE micros SET estado = 'INACTIVO' WHERE id = $1 AND estado <> 'INACTIVO' RETURNING id`, [id]
    );
    if (!rows[0]) throw new NotFoundException('El micro no existe o ya está inactivo');
  }
}
