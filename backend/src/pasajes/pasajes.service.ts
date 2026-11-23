import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CrearPasajeDto } from './dto/crear-pasaje.dto';
import { CATEGORIAS_BENEFICIO, CATEGORIAS_ESTUDIANTE } from '../common/categorias-tarifa';

@Injectable()
export class PasajesService {
  constructor(private readonly db: DatabaseService) {}

  async crear(usuarioId: number, dto: CrearPasajeDto) {
    return this.db.transaction(async client => {
      const trip = await client.query<{ linea_id: number; estado: string }>(
        'SELECT linea_id, estado FROM viajes WHERE id = $1', [dto.viajeId]
      );
      if (!trip.rowCount) throw new NotFoundException('Viaje no encontrado');
      if (!['PROGRAMADO', 'EN_CURSO'].includes(trip.rows[0].estado)) {
        throw new BadRequestException('Solo se pueden comprar pasajes para un viaje programado o en curso');
      }
      if ((CATEGORIAS_ESTUDIANTE as readonly string[]).includes(dto.categoria)) {
        const student = await client.query(
          `SELECT 1 FROM estudiantes WHERE usuario_id = $1 AND estado_validacion = 'APROBADO'
            AND tipo = $2 AND (linea_id IS NULL OR linea_id = $3)`, [usuarioId, dto.categoria, trip.rows[0].linea_id]
        );
        if (!student.rowCount) throw new ForbiddenException('Tu categoría estudiantil aún no está aprobada');
      } else if ((CATEGORIAS_BENEFICIO as readonly string[]).includes(dto.categoria)) {
        const benefit = await client.query(
          `SELECT 1 FROM beneficios_tarifarios
            WHERE usuario_id = $1 AND categoria = $2 AND estado_validacion = 'APROBADO'
              AND (linea_id IS NULL OR linea_id = $3)
              AND ($2 <> 'MENOR_12' OR fecha_nacimiento > (CURRENT_DATE - INTERVAL '12 years')::date)`,
          [usuarioId, dto.categoria, trip.rows[0].linea_id]
        );
        if (!benefit.rowCount) throw new ForbiddenException('El beneficio tarifario no está aprobado o ya venció');
      }
      const fare = await client.query<{ id: number; importe: string }>(
        `SELECT id, importe FROM tarifas
          WHERE linea_id = $1 AND categoria = $2 AND activa
            AND CURRENT_DATE >= vigente_desde
            AND (vigente_hasta IS NULL OR CURRENT_DATE <= vigente_hasta)
          ORDER BY vigente_desde DESC LIMIT 1`, [trip.rows[0].linea_id, dto.categoria]
      );
      if (!fare.rowCount) throw new BadRequestException('No hay tarifa vigente para esa línea y categoría');

      const ticket = await client.query(
        `INSERT INTO pasajes (usuario_id, linea_id, viaje_inicial_id, viaje_actual_id,
             parada_origen_id, parada_destino_id, tarifa_id, categoria_tarifa, importe_cobrado)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
         RETURNING id, codigo, usuario_id AS "usuarioId", linea_id AS "lineaId",
           viaje_inicial_id AS "viajeInicialId", viaje_actual_id AS "viajeActualId",
           categoria_tarifa AS categoria, importe_cobrado AS importe, moneda, estado, creado_en AS "creadoEn"`,
        [usuarioId, trip.rows[0].linea_id, dto.viajeId, dto.paradaOrigenId ?? null,
          dto.paradaDestinoId ?? null, fare.rows[0].id, dto.categoria, fare.rows[0].importe]
      );
      if (Number(fare.rows[0].importe) === 0) {
        const key = randomUUID();
        await client.query(
          `INSERT INTO pagos (pasaje_id, viaje_id, proveedor, referencia_proveedor, clave_idempotencia, importe, metodo, estado)
           VALUES ($1, $2, 'EXENCION', $3, $4, 0, 'EXENTO', 'APROBADO')`,
          [ticket.rows[0].id, dto.viajeId, `exento_${key}`, key]
        );
        await client.query("UPDATE pasajes SET estado = 'PAGADO' WHERE id = $1", [ticket.rows[0].id]);
        return { ...ticket.rows[0], estado: 'PAGADO', pagoExento: true };
      }
      return { ...ticket.rows[0], pagoExento: false };
    });
  }

  mios(usuarioId: number) {
    return this.db.query(
      `SELECT p.id, p.codigo, COALESCE(v.linea_id, p.linea_id) AS "lineaId", l.nombre AS linea,
              p.viaje_inicial_id AS "viajeInicialId", m.interno, m.placa,
              p.viaje_actual_id AS "viajeActualId", p.categoria_tarifa AS categoria,
              p.importe_cobrado AS importe, p.moneda, p.estado, p.creado_en AS "creadoEn",
              p.finalizado_en AS "finalizadoEn", p.cancelado_en AS "canceladoEn"
         FROM pasajes p LEFT JOIN viajes v ON v.id = COALESCE(p.viaje_actual_id, p.viaje_inicial_id)
         LEFT JOIN micros m ON m.id = v.micro_id JOIN lineas l ON l.id = COALESCE(v.linea_id, p.linea_id)
        WHERE p.usuario_id = $1 ORDER BY p.creado_en DESC`, [usuarioId]
    );
  }

  async porCodigo(codigo: string, usuarioId: number, rol: string) {
    const rows = await this.db.query(
      `SELECT p.id, p.codigo, p.usuario_id AS "usuarioId", p.linea_id AS "lineaId",
              p.viaje_inicial_id AS "viajeInicialId", p.viaje_actual_id AS "viajeActualId",
              p.categoria_tarifa AS categoria, p.importe_cobrado AS importe, p.moneda, p.estado,
              p.creado_en AS "creadoEn"
         FROM pasajes p WHERE p.codigo = $1 AND ($2 = 'ADMIN' OR p.usuario_id = $3)`,
      [codigo, rol, usuarioId]
    );
    if (!rows[0]) throw new NotFoundException('Pasaje no encontrado');
    return rows[0];
  }
}
