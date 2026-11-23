import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';

export interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  rol: 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO';
  nombre_completo: string | null;
  correo: string | null;
}

export type UsuarioPublico = Omit<UsuarioRow, 'password_hash'>;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password || password.length < 12) {
      throw new Error('Configura ADMIN_USERNAME y ADMIN_PASSWORD (12 caracteres como mínimo) en backend/.env');
    }
    const hashSeguro = await hash(password, 12);
    await this.db.query(
      `INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (username) DO NOTHING`,
      [username, hashSeguro]
    );
  }

  async registrar(dto: RegisterDto): Promise<UsuarioPublico> {
    const passwordHash = await hash(dto.password, 12);
    try {
      const rows = await this.db.query<UsuarioRow>(
        `INSERT INTO usuarios (username, password_hash, rol, nombre_completo, correo)
         VALUES ($1, $2, 'PASAJERO', $3, LOWER($4))
         RETURNING id, username, password_hash, rol, nombre_completo, correo`,
        [dto.username.trim(), passwordHash, dto.nombreCompleto.trim(), dto.correo.trim()]
      );
      return this.publico(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('El nombre de usuario o correo ya está registrado');
      }
      throw error;
    }
  }

  async validar(username: string, password: string): Promise<UsuarioPublico> {
    const rows = await this.db.query<UsuarioRow>(
      `SELECT id, username, password_hash, rol, nombre_completo, correo
         FROM usuarios WHERE username = $1 AND activo = TRUE`,
      [username]
    );
    const usuario = rows[0];
    if (!usuario || !(await compare(password, usuario.password_hash))) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    return this.publico(usuario);
  }

  async buscarPublico(id: number): Promise<UsuarioPublico | null> {
    const rows = await this.db.query<UsuarioRow>(
      `SELECT id, username, password_hash, rol, nombre_completo, correo
         FROM usuarios WHERE id = $1 AND activo = TRUE`, [id]
    );
    return rows[0] ? this.publico(rows[0]) : null;
  }

  private publico(usuario: UsuarioRow): UsuarioPublico {
    const { password_hash: _passwordHash, ...rest } = usuario;
    return rest;
  }
}
