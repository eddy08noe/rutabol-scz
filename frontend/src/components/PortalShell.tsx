'use client';

// Esta parte mantiene a mano el nombre de la persona y las opciones de su cuenta.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { LogOut, Route, ShieldCheck, UserRound } from 'lucide-react';
import { Alert, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { usePortalSession } from './RoleGuard';

export default function PortalShell({
  audience,
  children,
}: {
  audience: 'cliente' | 'administrativo' | 'organizador' | 'chofer';
  children: ReactNode;
}) {
  const router = useRouter();
  // La persona y su rol llegan desde la verificación hecha por RoleGuard.
  const usuario = usePortalSession();
  // Estos estados informan si la salida está en curso o si ocurrió un error.
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(false);
  // El mismo marco visual se usa en los dos paneles y cambia según el rol.
  const esCliente = audience === 'cliente';
  const nombre = usuario.nombre_completo?.trim() || usuario.username;
  const esOrganizador = audience === 'organizador';
  const esChofer = audience === 'chofer';
  const IconoRol = esCliente ? UserRound : ShieldCheck;

  // El botón de salida termina la sesión y vuelve a la portada.
  async function cerrarSesion() {
    setError('');
    setCerrando(true);
    try {
      await api.logout();
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.');
      setCerrando(false);
    }
  }

  return (
    <div className={`portal-page portal-page--${audience}`}>
      {/* Aquí la persona ve su nombre y puede cerrar su sesión. */}
      <header className="portal-header">
        <Link className="brand" href="/" aria-label="RUTABOL-SCZ, inicio">
          <span className="brand-mark"><Route aria-hidden="true" /></span>
          <span><strong>RUTABOL-SCZ</strong><small>{esCliente ? 'Espacio cliente' : esOrganizador ? 'Organización de líneas' : esChofer ? 'Espacio de conducción' : 'Administración'}</small></span>
        </Link>
        <div className="portal-user">
          <Badge className="portal-user__badge"><IconoRol aria-hidden="true" />{esCliente ? 'CLIENTE' : esOrganizador ? 'ORGANIZADOR' : esChofer ? 'CHOFER' : 'ADMINISTRADOR'}</Badge>
          <span className="portal-user__name">{nombre}</span>
          <Button variant="ghost" type="button" onClick={() => void cerrarSesion()} disabled={cerrando}>
            <LogOut aria-hidden="true" /> <span>{cerrando ? 'Saliendo…' : 'Cerrar sesión'}</span>
          </Button>
        </div>
      </header>
      {/* Si falla el cierre, el aviso queda visible sin quitar el panel. */}
      {error && <div className="portal-shell-alert"><Alert>{error}</Alert></div>}
      {/* El contenido de cliente o administrador se inserta en este espacio. */}
      {children}
      {/* El pie conserva la marca y recuerda que la información es de demostración. */}
      <footer className="portal-footer">
        <Link className="brand brand--footer" href="/">
          <span className="brand-mark"><Route aria-hidden="true" /></span>
          <span><strong>RUTABOL-SCZ</strong><small>Movilidad que conecta</small></span>
        </Link>
        <span>Plataforma de demostración · datos ficticios</span>
      </footer>
    </div>
  );
}
