import { SetMetadata } from '@nestjs/common';

export type Rol = 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO';
export const ROLES_KEY = 'rutabol:roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
