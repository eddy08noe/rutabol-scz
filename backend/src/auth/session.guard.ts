import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.usuarioId) throw new UnauthorizedException('Debe iniciar sesión');
    const rows = await this.db.query<{ rol: NonNullable<Request['session']['rol']> }>(
      'SELECT rol FROM usuarios WHERE id = $1 AND activo = TRUE', [req.session.usuarioId],
    );
    if (!rows[0]) {
      await new Promise<void>(resolve => req.session.destroy(() => resolve()));
      throw new UnauthorizedException('La cuenta está inactiva o no existe');
    }
    // Los roles almacenados en una sesión pueden quedar obsoletos tras un cambio administrativo.
    req.session.rol = rows[0].rol;
    return true;
  }
}
