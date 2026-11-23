import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Rol } from '../common/roles.decorator';
import { CrearTrasbordoDto } from './dto/crear-trasbordo.dto';

@Injectable()
export class TrasbordosService {
  constructor(private readonly db: DatabaseService) {}

  async crear(usuarioId: number, rol: Rol, dto: CrearTrasbordoDto) {
    if (dto.viajeOrigenId === dto.viajeDestinoId) throw new BadRequestException('Origen y destino deben ser viajes distintos');
    if (dto.tipo === 'NORMAL' && dto.motivo !== 'FIN_TURNO') throw new BadRequestException('El trasbordo normal debe ser por FIN_TURNO');
    if (dto.tipo === 'EMERGENCIA' && dto.motivo === 'FIN_TURNO') throw new BadRequestException('Indica el motivo de la emergencia');
    if (dto.tipo === 'EMERGENCIA' && !dto.descripcionIncidente?.trim()) throw new BadRequestException('Describe el incidente');

    return this.db.transaction(async client => {
      const trips = await client.query<{ id: number; estado: string; linea_id: number }>(
        `SELECT id, estado, linea_id FROM viajes WHERE id = ANY($1::bigint[]) FOR UPDATE`,
        [[dto.viajeOrigenId, dto.viajeDestinoId]]
      );
      const source = trips.rows.find(v => Number(v.id) === dto.viajeOrigenId);
      const target = trips.rows.find(v => Number(v.id) === dto.viajeDestinoId);
      if (!source || !target) throw new NotFoundException('Viaje de origen o destino no encontrado');
      await this.verificarResponsable(client, dto.viajeOrigenId, usuarioId, rol);
      if (rol === 'ORGANIZADOR') await this.verificarResponsable(client, dto.viajeDestinoId, usuarioId, rol);
      if (dto.tipo === 'NORMAL' && source.linea_id !== target.linea_id) {
        throw new BadRequestException('El trasbordo normal solo puede realizarse dentro de la misma línea');
      }
      const openTransfer = await client.query(
        "SELECT id FROM trasbordos WHERE viaje_origen_id = $1 AND estado = 'ABIERTO' FOR UPDATE",
        [dto.viajeOrigenId]
      );
      if (openTransfer.rowCount) throw new ConflictException('El viaje ya tiene un trasbordo abierto');
      if (!['EN_CURSO', 'EMERGENCIA'].includes(source.estado)) throw new ConflictException('El viaje de origen no está activo');
      if (target.estado !== 'EN_CURSO') throw new ConflictException('El viaje de destino debe estar EN_CURSO para recibir pasajeros');
      if (dto.tipo === 'NORMAL' && source.estado !== 'EN_CURSO') throw new ConflictException('El trasbordo normal requiere un viaje en curso');

      let incidenteId: number | null = null;
      if (dto.tipo === 'EMERGENCIA') {
        const incidentType = dto.motivo === 'FALLA_MECANICA' ? 'FALLA_MECANICA'
          : dto.motivo === 'EMERGENCIA_CONDUCTOR' ? 'EMERGENCIA_CONDUCTOR' : 'OTRA';
        const incident = await client.query<{ id: number }>(
          `INSERT INTO incidentes (viaje_id, reportado_por, tipo, descripcion, latitud, longitud)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [dto.viajeOrigenId, usuarioId, incidentType, dto.descripcionIncidente!.trim(), dto.latitud ?? null, dto.longitud ?? null]
        );
        incidenteId = incident.rows[0].id;
        await client.query("UPDATE viajes SET estado = 'EMERGENCIA' WHERE id = $1", [dto.viajeOrigenId]);
      }

      try {
        const rows = await client.query(
          `INSERT INTO trasbordos (viaje_origen_id, viaje_destino_id, incidente_id, tipo, motivo, registrado_por, nota)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, viaje_origen_id AS "viajeOrigenId", viaje_destino_id AS "viajeDestinoId",
             incidente_id AS "incidenteId", tipo, motivo, estado, creado_en AS "creadoEn"`,
          [dto.viajeOrigenId, dto.viajeDestinoId, incidenteId, dto.tipo, dto.motivo, usuarioId, dto.nota?.trim() ?? null]
        );
        return rows.rows[0];
      } catch (error) {
        if ((error as { code?: string }).code === 'P0001') throw new BadRequestException((error as Error).message);
        if ((error as { code?: string }).code === '23505') throw new ConflictException('Ya existe un trasbordo abierto para este viaje de origen');
        throw error;
      }
    });
  }

  listar(rol: Rol, usuarioId: number) {
    return this.db.query(
      `SELECT DISTINCT t.id, t.viaje_origen_id AS "viajeOrigenId", t.viaje_destino_id AS "viajeDestinoId",
              t.incidente_id AS "incidenteId", t.tipo, t.motivo, t.estado, t.creado_en AS "creadoEn"
         FROM trasbordos t
         LEFT JOIN trasbordo_pasajes tp ON tp.trasbordo_id = t.id
         LEFT JOIN pasajes p ON p.id = tp.pasaje_id
        WHERE ($1 IN ('ADMIN', 'CHOFER') OR p.usuario_id = $2 OR ($1 = 'ORGANIZADOR' AND EXISTS (
          SELECT 1 FROM viajes v JOIN organizador_lineas ol ON ol.linea_id = v.linea_id
           WHERE v.id = t.viaje_origen_id AND ol.usuario_id = $2)))
        ORDER BY t.creado_en DESC`, [rol, usuarioId]
    );
  }

  async continuar(id: number, pasajeId: number, actorId: number, rol: Rol) {
    return this.db.transaction(async client => {
      const transfer = await client.query<{ viaje_origen_id: number; viaje_destino_id: number; tipo: string; estado: string }>(
        'SELECT viaje_origen_id, viaje_destino_id, tipo, estado FROM trasbordos WHERE id = $1 FOR UPDATE', [id]
      );
      if (!transfer.rowCount) throw new NotFoundException('Trasbordo no encontrado');
      if (transfer.rows[0].estado !== 'ABIERTO') throw new ConflictException('El trasbordo ya fue resuelto');
      await this.verificarResponsable(client, transfer.rows[0].viaje_origen_id, actorId, rol);

      const ticket = await client.query<{ usuario_id: number; estado: string }>(
        'SELECT usuario_id, estado FROM pasajes WHERE id = $1 FOR UPDATE', [pasajeId]
      );
      if (!ticket.rowCount) throw new NotFoundException('Pasaje no encontrado');
      if (rol === 'PASAJERO' && Number(ticket.rows[0].usuario_id) !== actorId) throw new ForbiddenException('Ese pasaje no pertenece a tu cuenta');
      const link = await client.query(
        'SELECT id FROM trasbordo_pasajes WHERE trasbordo_id = $1 AND pasaje_id = $2', [id, pasajeId]
      );
      if (link.rowCount) throw new ConflictException('Ese pasaje ya fue procesado para este trasbordo');

      const boarding = await client.query<{ id: number }>(
        'SELECT id FROM abordajes WHERE pasaje_id = $1 AND viaje_id = $2 AND bajo_en IS NULL FOR UPDATE',
        [pasajeId, transfer.rows[0].viaje_origen_id]
      );
      if (!boarding.rowCount) throw new ConflictException('El pasajero no está actualmente en el micro de origen');
      await client.query('UPDATE abordajes SET bajo_en = NOW() WHERE id = $1', [boarding.rows[0].id]);
      await client.query("UPDATE pasajes SET estado = 'TRANSFERIDO' WHERE id = $1", [pasajeId]);
      await client.query(
        `INSERT INTO trasbordo_pasajes (trasbordo_id, pasaje_id, resultado) VALUES ($1, $2, 'CONTINUAR')`, [id, pasajeId]
      );
      const boardingResult = await client.query<{ id: string }>(
        'SELECT registrar_abordaje($1, $2, NULL)::text AS id', [pasajeId, transfer.rows[0].viaje_destino_id]
      );
      await this.completarSiVacio(client, id, transfer.rows[0].viaje_origen_id);
      return { trasbordoId: id, pasajeId, nuevoAbordajeId: boardingResult.rows[0].id, pagoDuplicado: false };
    });
  }

  async rechazar(id: number, pasajeId: number, actorId: number, rol: Rol) {
    return this.db.transaction(async client => {
      const transfer = await client.query<{ viaje_origen_id: number; tipo: string; estado: string }>(
        'SELECT viaje_origen_id, tipo, estado FROM trasbordos WHERE id = $1 FOR UPDATE', [id]
      );
      if (!transfer.rowCount) throw new NotFoundException('Trasbordo no encontrado');
      if (transfer.rows[0].tipo !== 'EMERGENCIA') throw new BadRequestException('Solo se puede rechazar un trasbordo de emergencia');
      if (transfer.rows[0].estado !== 'ABIERTO') throw new ConflictException('El trasbordo ya fue resuelto');
      await this.verificarResponsable(client, transfer.rows[0].viaje_origen_id, actorId, rol);

      const ticket = await client.query<{ usuario_id: number }>(
        'SELECT usuario_id FROM pasajes WHERE id = $1 FOR UPDATE', [pasajeId]
      );
      if (!ticket.rowCount) throw new NotFoundException('Pasaje no encontrado');
      if (rol === 'PASAJERO' && Number(ticket.rows[0].usuario_id) !== actorId) throw new ForbiddenException('Ese pasaje no pertenece a tu cuenta');
      const processed = await client.query('SELECT id FROM trasbordo_pasajes WHERE trasbordo_id = $1 AND pasaje_id = $2', [id, pasajeId]);
      if (processed.rowCount) throw new ConflictException('Ese pasaje ya fue procesado para este trasbordo');
      const boarding = await client.query<{ id: number }>(
        'SELECT id FROM abordajes WHERE pasaje_id = $1 AND viaje_id = $2 AND bajo_en IS NULL FOR UPDATE',
        [pasajeId, transfer.rows[0].viaje_origen_id]
      );
      if (!boarding.rowCount) throw new ConflictException('No se encontró un abordaje activo para este pasajero');
      const payment = await client.query<{ id: number; importe: string; estado: string; metodo: string }>(
        `SELECT id, importe, estado, metodo FROM pagos WHERE pasaje_id = $1
          AND estado IN ('APROBADO', 'REEMBOLSO_PARCIAL') ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`, [pasajeId]
      );
      if (!payment.rowCount) throw new ConflictException('No existe un pago aprobable para reembolsar');

      await client.query('UPDATE abordajes SET bajo_en = NOW() WHERE id = $1', [boarding.rows[0].id]);
      const debeReembolsar = Number(payment.rows[0].importe) > 0;
      await client.query(
        `UPDATE pasajes SET estado = $2, viaje_actual_id = NULL, cancelado_en = NOW() WHERE id = $1`,
        [pasajeId, debeReembolsar ? 'REEMBOLSO_PENDIENTE' : 'CANCELADO']
      );
      await client.query(
        `INSERT INTO trasbordo_pasajes (trasbordo_id, pasaje_id, resultado)
         VALUES ($1, $2, $3)`, [id, pasajeId,
          Number(payment.rows[0].importe) > 0 ? 'CANCELAR_Y_SOLICITAR_REEMBOLSO' : 'CANCELAR_SIN_REEMBOLSO']
      );
      let refund: { rows: object[] } | null = null;
      if (debeReembolsar) {
        const refundKey = randomUUID();
        refund = await client.query(
          `INSERT INTO reembolsos (pago_id, clave_idempotencia, importe, motivo, estado, solicitado_por)
           VALUES ($1, $2, $3, 'EMERGENCIA', 'SOLICITADO', $4)
           RETURNING id, pago_id AS "pagoId", importe, estado, solicitado_en AS "solicitadoEn"`,
          [payment.rows[0].id, refundKey, payment.rows[0].importe, actorId]
        );
      }
      await this.completarSiVacio(client, id, transfer.rows[0].viaje_origen_id);
      return {
        trasbordoId: id, pasajeId, reembolso: refund?.rows[0] ?? null,
        metodoDevolucion: debeReembolsar ? payment.rows[0].metodo : null,
        cobroNuevo: false,
      };
    });
  }

  private async completarSiVacio(client: import('pg').PoolClient, id: number, sourceTripId: number) {
    const remaining = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM abordajes WHERE viaje_id = $1 AND bajo_en IS NULL', [sourceTripId]
    );
    if (Number(remaining.rows[0].count) === 0) {
      await client.query("UPDATE trasbordos SET estado = 'COMPLETADO' WHERE id = $1", [id]);
      await client.query(
        "UPDATE viajes SET estado = 'FINALIZADO', finalizado_en = NOW() WHERE id = $1 AND estado IN ('EN_CURSO', 'EMERGENCIA')",
        [sourceTripId]
      );
    }
  }

  private async verificarResponsable(client: import('pg').PoolClient, viajeId: number, actorId: number, rol: Rol) {
    if (rol === 'ADMIN') return;
    if (rol === 'PASAJERO') return;
    if (rol === 'ORGANIZADOR') {
      const access = await client.query(
        `SELECT 1 FROM viajes v JOIN organizador_lineas ol ON ol.linea_id = v.linea_id
          WHERE v.id = $1 AND ol.usuario_id = $2`, [viajeId, actorId]);
      if (!access.rowCount) throw new ForbiddenException('El viaje no pertenece a una línea asignada');
      return;
    }
    const rows = await client.query(
      `SELECT 1 FROM viajes v JOIN conductores c ON c.id = v.conductor_id
        WHERE v.id = $1 AND c.usuario_id = $2 AND c.activo`, [viajeId, actorId]
    );
    if (!rows.rowCount) throw new ForbiddenException('No estás asignado al viaje de origen');
  }
}
