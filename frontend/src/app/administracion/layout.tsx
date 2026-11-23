import type { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';

// Todas las páginas de esta carpeta requieren una sesión con rol de administrador.
export default function AdministracionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard role="ADMIN">{children}</RoleGuard>;
}
