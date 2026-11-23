import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import { Rol } from '../common/roles.decorator';
import { RegistrarAbordajeDto } from './dto/registrar-abordaje.dto';
import { RegistrarDescensoDto } from './dto/registrar-descenso.dto';
import { LineaPermisosService } from '../common/linea-permisos.service';

@Injectable()
export class AbordajesService {
  constructor(private readonly db: DatabaseService, private readonly permisos: LineaPermisosService) {}

  async registrar(usuarioId: number, rol: Rol, dto: RegistrarAbordajeDto) {
    await this.verificarResponsable(dto.viajeId, usuarioId, rol);
    try {
      return await this.db.transaction(async client => {
        const ticket = await client.query<{ id: number; estado: string; viaje_actual_id: number | null; importe_cobrado: string }>(
          'SELECT id, estado, viaje_actual_id, importe_cobrado FROM pasajes WHERE codigo = $1 FOR UPDATE', [dto.codigo]
        );
        if (!ticket.rowCount) throw new NotFoundException('Pasaje no encontrado');
        const pasajeId = ticket.rows[0].id;
        const abordajeActivo = await client.query<{ viaje_id: number }>(
          'SELECT viaje_id FROM abordajes WHERE pasaje_id = $1 AND bajo_en IS NULL LIMIT 1', [pasajeId]
        );
        if (abordajeActivo.rowCount) {
          throw new ConflictException(Number(abordajeActivo.rows[0].viaje_id) === dto.viajeId
            ? 'Este código ya fue usado: el pasajero ya está a bordo de este micro'
            : 'Este código ya está activo en otro viaje');
        }
        if (['FINALIZADO', 'CANCELADO', 'REEMBOLSO_PENDIENTE', 'REEMBOLSADO'].includes(ticket.rows[0].estado)) {
          throw new ConflictException('Este código ya fue utilizado y el pasaje ya no está vigente');
        }
        if (Number(ticket.rows[0].viaje_actual_id) !== dto.viajeId) {
          throw new ConflictException('El pasaje no corresponde al viaje indicado');
        }
        if (ticket.rows[0].estado === 'PENDIENTE_PAGO' && dto.metodoPago !== 'EFECTIVO') {
          throw new ConflictException('El pasaje sigue pendiente de pago; selecciona cobrar en efectivo para registrar la subida');
        }
        let pagoEfectivo: number | undefined;
        if (dto.metodoPago === 'EFECTIVO') {
          if (ticket.rows[0].estado !== 'PENDIENTE_PAGO') throw new ConflictException('El pasaje no está pendiente de pago en efectivo');
          if (Number(ticket.rows[0].importe_cobrado) <= 0) throw new ConflictException('Este pasaje está exento y no debe cobrarse');
          const key = randomUUID();
          const payment = await client.query<{ id: number }>(
            `INSERT INTO pagos (pasaje_id, viaje_id, proveedor, referencia_proveedor, clave_idempotencia, importe, metodo, estado)
             VALUES ($1, $2, 'EFECTIVO_LOCAL', $3, $4, $5, 'EFECTIVO', 'APROBADO') RETURNING id`,
            [pasajeId, dto.viajeId, `cash_${key}`, key, ticket.rows[0].importe_cobrado]
          );
          pagoEfectivo = payment.rows[0].id;
          await client.query("UPDATE pasajes SET estado = 'PAGADO' WHERE id = $1", [pasajeId]);
        }
        const boarding = await client.query<{ id: string }>(
          'SELECT registrar_abordaje($1, $2, $3)::text AS id',
          [pasajeId, dto.viajeId, dto.paradaSubidaId ?? null]
        );
        return { abordajeId: boarding.rows[0].id, pasajeId, viajeId: dto.viajeId, pagoEfectivoId: pagoEfectivo };
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') throw new ConflictException('El pasaje ya está abordado en ese viaje o en otro micro');
      if (code === '23503') throw new NotFoundException('Pasaje, viaje o parada no encontrada');
      if (code === 'P0001') throw new ConflictException((error as Error).message);
      throw error;
    }
  }

  async descender(id: number, usuarioId: number, rol: Rol, dto: RegistrarDescensoDto) {
    const rows = await this.db.query<{ viaje_id: number; pasaje_id: number }>(
      'SELECT viaje_id, pasaje_id FROM abordajes WHERE id = $1 AND bajo_en IS NULL', [id]
    );
    if (!rows[0]) throw new NotFoundException('Abordaje activo no encontrado');
    await this.verificarResponsable(rows[0].viaje_id, usuarioId, rol);
    return this.db.transaction(async client => {
      const updated = await client.query(
        `UPDATE abordajes SET bajo_en = NOW(), parada_bajada_id = $2
          WHERE id = $1 AND bajo_en IS NULL
          RETURNING id, pasaje_id AS "pasajeId", viaje_id AS "viajeId", bajo_en AS "bajoEn"`,
        [id, dto.paradaBajadaId ?? null]
      );
      if (!updated.rowCount) throw new ConflictException('El pasajero ya registró su descenso');
      await client.query(
        `UPDATE pasajes SET estado = 'FINALIZADO', viaje_actual_id = NULL, finalizado_en = NOW()
          WHERE id = $1 AND NOT EXISTS (
            SELECT 1 FROM abordajes WHERE pasaje_id = $1 AND bajo_en IS NULL
          )`, [rows[0].pasaje_id]
      );
      return updated.rows[0];
    });
  }

  async delViaje(viajeId: number, usuarioId: number, rol: Rol) {
    await this.verificarResponsable(viajeId, usuarioId, rol);
    return this.db.query(
      `SELECT a.id, a.pasaje_id AS "pasajeId", p.codigo, a.subio_en AS "subioEn",
              a.parada_subida_id AS "paradaSubidaId", p.categoria_tarifa AS categoria
         FROM abordajes a JOIN pasajes p ON p.id = a.pasaje_id
        WHERE a.viaje_id = $1 AND a.bajo_en IS NULL ORDER BY a.subio_en`, [viajeId]
    );
  }

  private async verificarResponsable(viajeId: number, usuarioId: number, rol: Rol) {
    if (rol === 'ADMIN') return;
    if (rol === 'ORGANIZADOR') return this.permisos.verificarRecurso(usuarioId, rol, 'viajes', viajeId);
    const rows = await this.db.query(
      `SELECT 1 FROM viajes v JOIN conductores c ON c.id = v.conductor_id
        WHERE v.id = $1 AND c.usuario_id = $2 AND c.activo`, [viajeId, usuarioId]
    );
    if (!rows.length) throw new ForbiddenException('El viaje no está asignado a tu cuenta de chofer');
  }
}
