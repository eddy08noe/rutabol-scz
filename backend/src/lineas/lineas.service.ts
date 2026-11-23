import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Linea } from './linea.interface';
import { CreateLineaDto } from './dto/create-linea.dto';
import { UpdateLineaDto } from './dto/update-linea.dto';
import { Rol } from '../common/roles.decorator';

@Injectable()
export class LineasService {
  constructor(private readonly db: DatabaseService) {}

  findAll(usuarioId?: number, rol?: Rol): Promise<Linea[]> {
    return this.db.query<Linea>(`SELECT l.id, l.nombre, l.zona, l.descripcion, l.color, l.activa FROM lineas l
      WHERE l.activa AND ($1::text IS DISTINCT FROM 'ORGANIZADOR' OR EXISTS
        (SELECT 1 FROM organizador_lineas ol WHERE ol.usuario_id = $2 AND ol.linea_id = l.id)) ORDER BY l.id`, [rol ?? null, usuarioId ?? null]);
  }

  async findOne(id: number): Promise<Linea> {
    const rows = await this.db.query<Linea>(
      'SELECT id, nombre, zona, descripcion, color, activa FROM lineas WHERE id = $1 AND activa', [id]
    );
    if (!rows[0]) throw new NotFoundException('La línea no existe');
    return rows[0];
  }

  async crear(dto: CreateLineaDto): Promise<Linea> {
    try {
      const rows = await this.db.query<Linea>(
        `INSERT INTO lineas (nombre, zona, descripcion, color)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nombre, zona, descripcion, color, activa`,
        [dto.nombre.trim(), dto.zona.trim(), dto.descripcion.trim(), dto.color]
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Ya existe una línea con ese nombre');
      throw error;
    }
  }

  async actualizar(id: number, dto: UpdateLineaDto): Promise<Linea> {
    const rows = await this.db.query<Linea>(
      `UPDATE lineas SET
         nombre = COALESCE($2, nombre), zona = COALESCE($3, zona),
         descripcion = COALESCE($4, descripcion), color = COALESCE($5, color),
         activa = COALESCE($6, activa)
       WHERE id = $1
       RETURNING id, nombre, zona, descripcion, color, activa`,
      [id, dto.nombre?.trim(), dto.zona?.trim(), dto.descripcion?.trim(), dto.color, dto.activa]
    );
    if (!rows[0]) throw new NotFoundException('La línea no existe');
    return rows[0];
  }

  async desactivar(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      'UPDATE lineas SET activa = FALSE WHERE id = $1 RETURNING id', [id]
    );
    if (!rows[0]) throw new NotFoundException('La línea no existe');
  }
}
