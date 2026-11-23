import type { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';

export default function OrganizadorLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard role="ORGANIZADOR">{children}</RoleGuard>;
}
