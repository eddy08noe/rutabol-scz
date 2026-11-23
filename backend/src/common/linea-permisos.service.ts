import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Rol } from './roles.decorator';

@Injectable()
export class LineaPermisosService {
  constructor(private readonly db: DatabaseService) {}

  async verificarLinea(usuarioId: number, rol: Rol, lineaId: number) {
    if (rol === 'ADMIN') return;
    const rows = await this.db.query(
      `SELECT 1 FROM organizador_lineas ol JOIN lineas l ON l.id = ol.linea_id
        WHERE ol.usuario_id = $1 AND ol.linea_id = $2 AND l.activa`, [usuarioId, lineaId]);
    if (!rows.length) throw new ForbiddenException('No tienes asignada esta línea');
  }

  async verificarRecurso(usuarioId: number, rol: Rol, tabla: 'micros' | 'conductores' | 'viajes', id: number) {
    if (rol === 'ADMIN') return;
    const sql = tabla === 'conductores'
      ? 'SELECT 1 FROM conductor_lineas cl JOIN lineas l ON l.id = cl.linea_id AND l.activa JOIN organizador_lineas ol ON ol.linea_id = cl.linea_id WHERE cl.conductor_id = $2 AND ol.usuario_id = $1'
      : `SELECT 1 FROM ${tabla} r JOIN lineas l ON l.id = r.linea_id AND l.activa JOIN organizador_lineas ol ON ol.linea_id = r.linea_id WHERE r.id = $2 AND ol.usuario_id = $1`;
    const rows = await this.db.query(sql, [usuarioId, id]);
    if (!rows.length) throw new ForbiddenException('El recurso no pertenece a una línea asignada');
  }
}
