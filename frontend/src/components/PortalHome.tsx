'use client';

// Pantalla de bienvenida con el nombre, el tipo de cuenta y un acceso a la portada.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, LogOut, Route, ShieldCheck, UserRound } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { usePortalSession } from './RoleGuard';

export default function PortalHome({ audience }: { audience: 'cliente' | 'administrativo' }) {
  const router = useRouter();
  // La persona viene de una sesión que RoleGuard ya verificó.
  const usuario = usePortalSession();
  // El estado controla el mensaje de error y evita repetir el cierre de sesión.
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(false);
  // Se muestra el nombre completo si existe; de lo contrario, se usa el nombre de usuario.
  const nombre = usuario.nombre_completo?.trim() || usuario.username;
  // El mismo diseño cambia el texto y el icono según el tipo de cuenta.
  const esCliente = audience === 'cliente';
  const IconoRol = esCliente ? UserRound : ShieldCheck;

  // Cierra la sesión en el servidor y vuelve a la portada.
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
    <main className={`portal-page portal-page--${audience}`}>
      {/* Cabecera con la marca y la información básica de la cuenta activa. */}
      <header className="portal-header">
        <Link className="brand" href="/" aria-label="RUTABOL-SCZ, inicio">
          <span className="brand-mark"><Route aria-hidden="true" /></span>
          <span><strong>RUTABOL-SCZ</strong><small>{esCliente ? 'Espacio cliente' : 'Administración'}</small></span>
        </Link>
        <div className="portal-user">
          <Badge className="portal-user__badge"><IconoRol aria-hidden="true" />{esCliente ? 'CLIENTE' : 'ADMINISTRADOR'}</Badge>
          <span className="portal-user__name">{nombre}</span>
          <Button variant="ghost" type="button" onClick={() => void cerrarSesion()} disabled={cerrando}>
            <LogOut aria-hidden="true" /> <span>{cerrando ? 'Saliendo…' : 'Cerrar sesión'}</span>
          </Button>
        </div>
      </header>

      {/* Mensaje de bienvenida, enlace principal y aviso sobre los datos ficticios. */}
      <section className="portal-content">
        <Badge className="portal-eyebrow"><span className="status-dot" />{esCliente ? 'TU ESPACIO PERSONAL' : 'ACCESO SEGURO'}</Badge>
        <h1>Hola, <span>{nombre}</span>.</h1>
        <p className="portal-intro">{esCliente
          ? 'Bienvenido a RUTABOL-SCZ. Tu experiencia de movilidad comienza aquí.'
          : 'Bienvenido al espacio administrativo de RUTABOL-SCZ.'}</p>
        {error && <Alert>{error}</Alert>}
        <Card className="portal-feature">
          <span className="portal-feature__icon"><IconoRol aria-hidden="true" /></span>
          <div className="portal-feature__copy">
            <span className="portal-feature__eyebrow">{esCliente ? 'PANEL CLIENTE' : 'PANEL ADMINISTRATIVO'}</span>
            <h2>{esCliente ? 'Todo tu viaje, más claro.' : 'Una ciudad mejor conectada.'}</h2>
            <p>{esCliente
              ? 'Accede a las líneas, paradas, tarifas y micros cercanos disponibles en la portada.'
              : 'Consulta la información pública del sistema mientras preparas tu espacio de trabajo.'}</p>
          </div>
          <ButtonLink href="/">{esCliente ? 'Explorar movilidad' : 'Ver portada'} <ArrowRight aria-hidden="true" /></ButtonLink>
        </Card>
        <p className="portal-disclaimer">Sesión activa para <strong>{usuario.username}</strong>. Los datos de demostración son ficticios.</p>
      </section>
      {/* Pie de página compartido por los dos tipos de cuenta. */}
      <footer className="portal-footer"><Link className="brand brand--footer" href="/"><span className="brand-mark"><Route aria-hidden="true" /></span><span><strong>RUTABOL-SCZ</strong><small>Movilidad que conecta</small></span></Link><span>Plataforma de demostración · datos ficticios</span></footer>
    </main>
  );
}
