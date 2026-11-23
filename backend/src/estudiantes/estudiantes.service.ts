import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SolicitudEstudianteDto } from './dto/solicitud-estudiante.dto';
import { RevisarEstudianteDto } from './dto/revisar-estudiante.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class EstudiantesService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  async solicitar(usuarioId: number, dto: SolicitudEstudianteDto) {
    const linea = await this.db.query('SELECT id FROM lineas WHERE id = $1 AND activa', [dto.lineaId]);
    if (!linea.length) throw new BadRequestException('La línea seleccionada no existe o está inactiva');
    const codigoRude = dto.codigoRude?.trim() || null;
    const codigoUniversitario = dto.codigoUniversitario?.trim() || null;
    const correo = dto.correoInstitucional?.trim().toLowerCase() || null;
    const tipoEscolar = dto.tipo === 'ESCOLAR_PRIMARIA' || dto.tipo === 'ESCOLAR_SECUNDARIA';
    if (tipoEscolar && (!codigoRude || codigoUniversitario || correo)) {
      throw new BadRequestException('Para primaria/secundaria se requiere solo el código RUDE');
    }
    if (dto.tipo === 'UNIVERSITARIO' && (!codigoUniversitario || codigoRude || !correo || !correo.endsWith('@upds.edu.bo'))) {
      throw new BadRequestException('Para universitarios se requiere código y correo @upds.edu.bo');
    }
    try {
      const rows = await this.db.query(
        `INSERT INTO estudiantes (usuario_id, linea_id, tipo, codigo_rude, codigo_universitario, correo_institucional, evidencia_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (usuario_id, linea_id) DO UPDATE SET
           tipo = EXCLUDED.tipo, codigo_rude = EXCLUDED.codigo_rude,
           codigo_universitario = EXCLUDED.codigo_universitario,
           correo_institucional = EXCLUDED.correo_institucional,
           evidencia_ref = EXCLUDED.evidencia_ref, estado_validacion = 'PENDIENTE',
           revisado_por = NULL, revisado_en = NULL, motivo_rechazo = NULL
         RETURNING id, usuario_id AS "usuarioId", linea_id AS "lineaId", tipo, codigo_rude AS "codigoRude",
           codigo_universitario AS "codigoUniversitario", correo_institucional AS "correoInstitucional",
           estado_validacion AS "estadoValidacion", creado_en AS "creadoEn"`,
        [usuarioId, dto.lineaId, dto.tipo, codigoRude, codigoUniversitario, correo, dto.evidenciaRef.trim()]
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Ese código estudiantil ya está registrado');
      throw error;
    }
  }

  async mio(usuarioId: number) {
    const rows = await this.db.query(
      `SELECT id, linea_id AS "lineaId", tipo, codigo_rude AS "codigoRude", codigo_universitario AS "codigoUniversitario",
              correo_institucional AS "correoInstitucional", evidencia_ref AS "evidenciaRef",
              estado_validacion AS "estadoValidacion", revisado_en AS "revisadoEn", motivo_rechazo AS "motivoRechazo"
         FROM estudiantes WHERE usuario_id = $1`, [usuarioId]
    );
    return rows;
  }

  pendientes(usuarioId: number, rol: Rol) {
    return this.db.query(
      `SELECT e.id, e.linea_id AS "lineaId", e.usuario_id AS "usuarioId", u.username, u.nombre_completo AS "nombreCompleto",
              e.tipo, e.codigo_rude AS "codigoRude", e.codigo_universitario AS "codigoUniversitario",
              e.correo_institucional AS "correoInstitucional", e.evidencia_ref AS "evidenciaRef", e.creado_en AS "creadoEn"
         FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
        WHERE e.estado_validacion = 'PENDIENTE' AND ($1::text = 'ADMIN' OR EXISTS
          (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $2 AND ol.linea_id = e.linea_id))
        ORDER BY e.creado_en`, [rol, usuarioId]);
  }

  async revisar(id: number, actorId: number, rol: Rol, dto: RevisarEstudianteDto) {
    if (dto.estado === 'RECHAZADO' && !dto.motivoRechazo?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }
    const solicitud = await this.db.query<{ linea_id: number | null }>('SELECT linea_id FROM estudiantes WHERE id = $1', [id]);
    if (!solicitud[0]) throw new NotFoundException('Solicitud estudiantil no encontrada');
    if (solicitud[0].linea_id) await this.permisos.verificarLinea(actorId, rol, solicitud[0].linea_id);
    else if (rol !== 'ADMIN') throw new NotFoundException('La solicitud aún no está asignada a una línea');
    const rows = await this.db.query(
      `UPDATE estudiantes SET estado_validacion = $2, revisado_por = $3, revisado_en = NOW(),
              motivo_rechazo = $4
        WHERE id = $1
        RETURNING id, usuario_id AS "usuarioId", estado_validacion AS "estadoValidacion",
                  revisado_por AS "revisadoPor", revisado_en AS "revisadoEn", motivo_rechazo AS "motivoRechazo"`,
      [id, dto.estado, actorId, dto.estado === 'RECHAZADO' ? dto.motivoRechazo?.trim() : null]
    );
    if (!rows[0]) throw new NotFoundException('Solicitud estudiantil no encontrada');
    return rows[0];
  }
}
