import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ResultadoReembolsoDto } from './dto/resultado-reembolso.dto';

@Injectable()
export class PagosService {
  constructor(private readonly db: DatabaseService) {}

  async reporteIngresos(query: {
    desde?: string;
    hasta?: string;
    agrupacion?: string;
    lineaId?: string;
    conductorId?: string;
    microId?: string;
  }) {
    const dateOnly = (value: string | undefined, field: string) => {
      if (!value) return null;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`${field} debe tener formato YYYY-MM-DD`);
      }
      return value;
    };
    const positiveId = (value: string | undefined, field: string) => {
      if (!value) return null;
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException(`${field} no es válido`);
      return id;
    };

    const desde = dateOnly(query.desde, 'La fecha desde');
    const hasta = dateOnly(query.hasta, 'La fecha hasta');
    if (desde && hasta && desde > hasta) throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta');
    const agrupacion = query.agrupacion || 'DIA';
    if (!['DIA', 'SEMANA', 'MES'].includes(agrupacion)) throw new BadRequestException('La agrupación debe ser DIA, SEMANA o MES');
    const lineaId = positiveId(query.lineaId, 'La línea');
    const conductorId = positiveId(query.conductorId, 'El chofer');
    const microId = positiveId(query.microId, 'El micro');
    const eventos = `WITH movimientos AS (
      SELECT p.creado_en AS fecha, l.id AS "lineaId", l.nombre AS linea,
             m.id AS "microId", m.interno, m.placa,
             c.id AS "conductorId", CONCAT_WS(' ', c.nombres, c.apellidos) AS conductor,
             p.importe AS cobrado, 0::numeric AS devuelto, 'COBRO'::text AS tipo
        FROM pagos p
        JOIN pasajes t ON t.id = p.pasaje_id
        JOIN viajes v ON v.id = COALESCE(p.viaje_id, t.viaje_inicial_id)
        JOIN lineas l ON l.id = v.linea_id
        JOIN micros m ON m.id = v.micro_id
        JOIN conductores c ON c.id = v.conductor_id
       WHERE p.estado IN ('APROBADO', 'REEMBOLSO_PARCIAL', 'REEMBOLSADO') AND p.metodo <> 'EXENTO'
      UNION ALL
      SELECT r.confirmado_en AS fecha, l.id AS "lineaId", l.nombre AS linea,
             m.id AS "microId", m.interno, m.placa,
             c.id AS "conductorId", CONCAT_WS(' ', c.nombres, c.apellidos) AS conductor,
             0::numeric AS cobrado, r.importe AS devuelto, 'REEMBOLSO'::text AS tipo
        FROM reembolsos r
        JOIN pagos p ON p.id = r.pago_id
        JOIN pasajes t ON t.id = p.pasaje_id
        JOIN viajes v ON v.id = COALESCE(p.viaje_id, t.viaje_inicial_id)
        JOIN lineas l ON l.id = v.linea_id
        JOIN micros m ON m.id = v.micro_id
        JOIN conductores c ON c.id = v.conductor_id
       WHERE r.estado = 'CONFIRMADO' AND r.confirmado_en IS NOT NULL
    ), filtrado AS (
      SELECT * FROM movimientos
       WHERE ($1::date IS NULL OR fecha >= ($1::date::timestamp AT TIME ZONE 'America/La_Paz'))
         AND ($2::date IS NULL OR fecha < (($2::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'))
         AND $3::text IS NOT NULL
         AND ($4::int IS NULL OR "lineaId" = $4)
         AND ($5::bigint IS NULL OR "conductorId" = $5)
         AND ($6::int IS NULL OR "microId" = $6)
    )`;
    const parametros = [desde, hasta, agrupacion, lineaId, conductorId, microId];
    const resumen = await this.db.query<{ cobrado: string; devuelto: string; pagos: number; devoluciones: number }>(
      `${eventos}
       SELECT COALESCE(SUM(cobrado), 0)::numeric(12,2)::text AS cobrado,
              COALESCE(SUM(devuelto), 0)::numeric(12,2)::text AS devuelto,
              COUNT(*) FILTER (WHERE tipo = 'COBRO')::int AS pagos,
              COUNT(*) FILTER (WHERE tipo = 'REEMBOLSO')::int AS devoluciones
         FROM filtrado`, parametros,
    );
    const filas = await this.db.query<{
      periodo: string; lineaId: number; linea: string; microId: number; interno: string; placa: string;
      conductorId: number; conductor: string; cobrado: string; devuelto: string; pagos: number; devoluciones: number;
    }>(
      `${eventos}
       SELECT TO_CHAR(DATE_TRUNC(
                CASE $3::text WHEN 'SEMANA' THEN 'week' WHEN 'MES' THEN 'month' ELSE 'day' END,
                fecha AT TIME ZONE 'America/La_Paz'),
                CASE $3::text WHEN 'MES' THEN 'YYYY-MM' WHEN 'SEMANA' THEN 'IYYY-"S"IW' ELSE 'YYYY-MM-DD' END) AS periodo,
              "lineaId", linea, "microId", interno, placa, "conductorId", conductor,
              SUM(cobrado)::numeric(12,2)::text AS cobrado,
              SUM(devuelto)::numeric(12,2)::text AS devuelto,
              COUNT(*) FILTER (WHERE tipo = 'COBRO')::int AS pagos,
              COUNT(*) FILTER (WHERE tipo = 'REEMBOLSO')::int AS devoluciones
         FROM filtrado
        GROUP BY DATE_TRUNC(CASE $3::text WHEN 'SEMANA' THEN 'week' WHEN 'MES' THEN 'month' ELSE 'day' END,
                            fecha AT TIME ZONE 'America/La_Paz'),
                 "lineaId", linea, "microId", interno, placa, "conductorId", conductor
        ORDER BY DATE_TRUNC(CASE $3::text WHEN 'SEMANA' THEN 'week' WHEN 'MES' THEN 'month' ELSE 'day' END,
                            fecha AT TIME ZONE 'America/La_Paz') DESC, linea, interno`, parametros,
    );

    return {
      desde,
      hasta,
      agrupacion,
      resumen: resumen[0] ?? { cobrado: '0.00', devuelto: '0.00', pagos: 0, devoluciones: 0 },
      filas,
    };
  }

  async iniciarCheckout(pasajeId: number, usuarioId: number, rol: string) {
    const mode = process.env.PAYMENT_MODE || 'disabled';
    if (mode !== 'mock' || process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('La pasarela no está configurada. No se recibió ni almacenó información de tarjeta.');
    }
    return this.db.transaction(async client => {
      const ticket = await client.query<{ usuario_id: number; importe_cobrado: string; estado: string; viaje_inicial_id: number }>(
        'SELECT usuario_id, importe_cobrado, estado, viaje_inicial_id FROM pasajes WHERE id = $1 FOR UPDATE', [pasajeId]
      );
      if (!ticket.rowCount) throw new NotFoundException('Pasaje no encontrado');
      if (rol !== 'ADMIN' && ticket.rows[0].usuario_id !== usuarioId) throw new ForbiddenException('Ese pasaje no pertenece a tu cuenta');
      if (ticket.rows[0].estado !== 'PENDIENTE_PAGO') throw new ConflictException('El pasaje no está pendiente de pago');

      const existing = await client.query<{ id: number; estado: string }>(
        `SELECT id, estado FROM pagos WHERE pasaje_id = $1 AND estado = 'APROBADO'`, [pasajeId]
      );
      if (existing.rowCount) throw new ConflictException('El pasaje ya tiene un pago aprobado');

      const key = randomUUID();
      const payment = await client.query<{ id: number }>(
        `INSERT INTO pagos (pasaje_id, viaje_id, proveedor, referencia_proveedor, clave_idempotencia, importe, metodo, estado)
         VALUES ($1, $2, 'MOCK_LOCAL', $3, $4, $5, 'TARJETA_SIMULADA', 'APROBADO') RETURNING id`,
        [pasajeId, ticket.rows[0].viaje_inicial_id, `demo_${key}`, key, ticket.rows[0].importe_cobrado]
      );
      await client.query("UPDATE pasajes SET estado = 'PAGADO' WHERE id = $1", [pasajeId]);
      return { pagoId: payment.rows[0].id, pasajeId, estado: 'APROBADO', modo: 'DEMO_LOCAL' };
    });
  }

  listar(usuarioId: number, rol: string): Promise<object[]> {
    return this.db.query(
      `SELECT p.id, p.pasaje_id AS "pasajeId", p.proveedor,
              p.referencia_proveedor AS "referenciaProveedor", p.importe, p.moneda,
              p.metodo, p.estado, p.creado_en AS "creadoEn"
         FROM pagos p JOIN pasajes t ON t.id = p.pasaje_id
        WHERE ($1 = 'ADMIN' OR t.usuario_id = $2)
        ORDER BY p.creado_en DESC`, [rol, usuarioId]
    );
  }

  reembolsos(usuarioId: number, rol: string): Promise<object[]> {
    return this.db.query(
      `SELECT r.id, r.pago_id AS "pagoId", p.pasaje_id AS "pasajeId", p.metodo AS "metodoPago", r.importe, r.motivo,
              r.estado, r.solicitado_en AS "solicitadoEn", r.confirmado_en AS "confirmadoEn",
              r.detalle_error AS "detalleError"
         FROM reembolsos r JOIN pagos p ON p.id = r.pago_id
         JOIN pasajes t ON t.id = p.pasaje_id
        WHERE ($1 = 'ADMIN' OR t.usuario_id = $2)
        ORDER BY r.solicitado_en DESC`, [rol, usuarioId]
    );
  }

  async detalle(id: number, usuarioId: number, rol: string) {
    const rows = await this.db.query(
      `SELECT p.id, p.pasaje_id AS "pasajeId", p.proveedor,
              p.referencia_proveedor AS "referenciaProveedor", p.importe, p.moneda,
              p.metodo, p.estado, p.creado_en AS "creadoEn"
         FROM pagos p JOIN pasajes t ON t.id = p.pasaje_id
        WHERE p.id = $1 AND ($2 = 'ADMIN' OR t.usuario_id = $3)`, [id, rol, usuarioId]
    );
    if (!rows[0]) throw new NotFoundException('Pago no encontrado');
    return rows[0];
  }

  async registrarResultadoReembolso(id: number, dto: ResultadoReembolsoDto) {
    if (dto.estado === 'FALLIDO' && !dto.detalleError?.trim()) {
      throw new BadRequestException('Indica por qué falló el reembolso');
    }
    return this.db.transaction(async client => {
      const rows = await client.query(
        `UPDATE reembolsos
            SET estado = $2, referencia_proveedor = $3, detalle_error = $4,
                confirmado_en = CASE WHEN $2 = 'CONFIRMADO' THEN NOW() ELSE NULL END
          WHERE id = $1 AND estado IN ('SOLICITADO', 'EN_PROCESO')
          RETURNING id, pago_id AS "pagoId", importe, estado,
                    referencia_proveedor AS "referenciaProveedor",
                    confirmado_en AS "confirmadoEn", detalle_error AS "detalleError"`,
        [id, dto.estado, dto.referenciaProveedor?.trim() || null,
          dto.estado === 'FALLIDO' ? dto.detalleError?.trim() : null]
      );
      if (rows.rows[0]) return rows.rows[0];
      const exists = await client.query('SELECT id FROM reembolsos WHERE id = $1', [id]);
      if (!exists.rowCount) throw new NotFoundException('Solicitud de reembolso no encontrada');
      throw new ConflictException('La solicitud de reembolso ya fue resuelta');
    });
  }
}
