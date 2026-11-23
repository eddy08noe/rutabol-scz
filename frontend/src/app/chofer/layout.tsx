import type { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';

export default function ChoferLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard role="CHOFER">{children}</RoleGuard>;
}
