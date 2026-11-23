import type { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';

// Todas las páginas de esta carpeta requieren una sesión con rol de pasajero.
export default function ClienteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard role="PASAJERO">{children}</RoleGuard>;
}
