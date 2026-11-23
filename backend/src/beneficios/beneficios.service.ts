import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SolicitudBeneficioDto } from './dto/solicitud-beneficio.dto';
import { RevisarEstudianteDto } from '../estudiantes/dto/revisar-estudiante.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class BeneficiosService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  async solicitar(usuarioId: number, dto: SolicitudBeneficioDto) {
    const linea = await this.db.query('SELECT id FROM lineas WHERE id = $1 AND activa', [dto.lineaId]);
    if (!linea.length) throw new BadRequestException('La línea seleccionada no existe o está inactiva');
    if (dto.categoria === 'MENOR_12') {
      if (!dto.fechaNacimiento) throw new BadRequestException('Para la tarifa de menor de 12 años se requiere fecha de nacimiento');
      const nacimiento = new Date(`${dto.fechaNacimiento}T00:00:00`);
      const limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setFullYear(limite.getFullYear() - 12);
      if (nacimiento <= limite || nacimiento > new Date()) {
        throw new BadRequestException('La fecha indicada no corresponde a una persona menor de 12 años');
      }
    } else if (dto.fechaNacimiento) {
      throw new BadRequestException('La fecha de nacimiento solo se solicita para la categoría MENOR_12');
    }
    try {
      const rows = await this.db.query(
        `INSERT INTO beneficios_tarifarios (usuario_id, linea_id, categoria, evidencia_ref, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id, categoria, linea_id) DO UPDATE SET
           evidencia_ref = EXCLUDED.evidencia_ref, fecha_nacimiento = EXCLUDED.fecha_nacimiento,
           estado_validacion = 'PENDIENTE', revisado_por = NULL, revisado_en = NULL, motivo_rechazo = NULL
         RETURNING id, linea_id AS "lineaId", categoria, estado_validacion AS "estadoValidacion", creado_en AS "creadoEn"`,
        [usuarioId, dto.lineaId, dto.categoria, dto.evidenciaRef.trim(), dto.fechaNacimiento ?? null]
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Ya existe esa validación tarifaria para tu cuenta');
      throw error;
    }
  }

  mio(usuarioId: number) {
    return this.db.query(
      `SELECT id, linea_id AS "lineaId", categoria, evidencia_ref AS "evidenciaRef", fecha_nacimiento AS "fechaNacimiento",
              estado_validacion AS "estadoValidacion", revisado_en AS "revisadoEn", motivo_rechazo AS "motivoRechazo"
         FROM beneficios_tarifarios WHERE usuario_id = $1 ORDER BY creado_en DESC`, [usuarioId]
    );
  }

  pendientes(usuarioId: number, rol: Rol) {
    return this.db.query(
      `SELECT b.id, b.linea_id AS "lineaId", b.usuario_id AS "usuarioId", u.username, u.nombre_completo AS "nombreCompleto",
              b.categoria, b.evidencia_ref AS "evidenciaRef", b.fecha_nacimiento AS "fechaNacimiento",
              b.creado_en AS "creadoEn"
         FROM beneficios_tarifarios b JOIN usuarios u ON u.id = b.usuario_id
        WHERE b.estado_validacion = 'PENDIENTE' AND ($1::text = 'ADMIN' OR EXISTS
          (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $2 AND ol.linea_id = b.linea_id))
        ORDER BY b.creado_en`, [rol, usuarioId]
    );
  }

  async revisar(id: number, actorId: number, rol: Rol, dto: RevisarEstudianteDto) {
    if (dto.estado === 'RECHAZADO' && !dto.motivoRechazo?.trim()) {
      throw new BadRequestException('Indica el motivo del rechazo');
    }
    const solicitud = await this.db.query<{ linea_id: number | null }>('SELECT linea_id FROM beneficios_tarifarios WHERE id = $1', [id]);
    if (!solicitud[0]) throw new NotFoundException('Solicitud de beneficio no encontrada');
    if (solicitud[0].linea_id) await this.permisos.verificarLinea(actorId, rol, solicitud[0].linea_id);
    else if (rol !== 'ADMIN') throw new NotFoundException('La solicitud aún no está asignada a una línea');
    const rows = await this.db.query(
      `UPDATE beneficios_tarifarios SET estado_validacion = $2, revisado_por = $3,
              revisado_en = NOW(), motivo_rechazo = $4
        WHERE id = $1
        RETURNING id, categoria, estado_validacion AS "estadoValidacion",
                  revisado_por AS "revisadoPor", revisado_en AS "revisadoEn", motivo_rechazo AS "motivoRechazo"`,
      [id, dto.estado, actorId, dto.estado === 'RECHAZADO' ? dto.motivoRechazo?.trim() : null]
    );
    if (!rows[0]) throw new NotFoundException('Solicitud de beneficio no encontrada');
    return rows[0];
  }
}
