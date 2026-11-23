import 'express-session';
declare module 'express-session' {
  interface SessionData {
    usuarioId?: number;
    username?: string;
    rol?: 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO';
  }
}
