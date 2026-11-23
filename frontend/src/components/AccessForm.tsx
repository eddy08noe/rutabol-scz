'use client';

// Aquí está el inicio de sesión único y el registro exclusivo para clientes.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Alert, Badge, Button, Card, FormField } from '@/components/ui';
import TransitMapArt from '@/components/TransitMapArt';
import { ApiError, api } from '@/lib/api';
import type { RolUsuario, Usuario } from '@/lib/types';

type Audience = 'general' | 'cliente';

// Cada botón corresponde a un rol y a un panel diferente.
const rolPorAcceso: Record<Audience, RolUsuario> = {
  general: 'PASAJERO',
  cliente: 'PASAJERO',
};

// Después de ingresar, cada persona vuelve al espacio que le corresponde.
const rutaPorAcceso: Record<Audience, string> = {
  general: '/acceso',
  cliente: '/cliente',
};

// Este nombre solo se usa para explicar qué sesión está abierta.
const nombreRol: Record<RolUsuario, string> = {
  ADMIN: 'administrador',
  ORGANIZADOR: 'organizador',
  PASAJERO: 'cliente',
  CHOFER: 'conductor',
};

const rutaPorRol: Record<RolUsuario, string> = {
  ADMIN: '/administracion',
  ORGANIZADOR: '/organizador',
  CHOFER: '/chofer',
  PASAJERO: '/cliente',
};

function fuerzaContrasena(password: string) {
  // La indicación cambia según el largo y la variedad de la contraseña escrita.
  const puntos = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const level = password ? Math.max(1, puntos) : 0;
  return { level, label: level < 2 ? 'Débil' : level < 4 ? 'Media' : 'Fuerte' };
}

// El formulario ofrece un acceso único y un registro exclusivo para clientes.
export default function AccessForm({ audience, registering = false }: { audience: Audience; registering?: boolean }) {
  const router = useRouter();
  // Estos datos permiten mostrar el estado del formulario y de la sesión actual.
  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [sesionExistente, setSesionExistente] = useState<Usuario | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmacion, setPasswordConfirmacion] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  // El contenido y el destino dependen del tipo de acceso que abrió esta pantalla.
  const rolEsperado = rolPorAcceso[audience];
  const esCliente = audience === 'cliente';
  const esGeneral = audience === 'general';
  const titulo = registering ? 'Crea tu cuenta' : esGeneral ? 'Inicia sesión' : 'Qué bueno verte';
  const subtitulo = registering
    ? 'Regístrate para empezar a usar los servicios de pasajero.'
    : esGeneral ? 'Inicia sesión y te llevaremos al panel que corresponde a tu rol.' : 'Ingresa a tu cuenta y continúa tu viaje.';

  // Si ya hay una sesión, se comprueba que corresponda a este acceso.
  useEffect(() => {
    let vigente = true;
    api.usuarioActual()
      .then((usuario) => {
        if (!vigente) return;
        if (esGeneral) router.replace(rutaPorRol[usuario.rol]);
        else if (usuario.rol === rolEsperado) router.replace(rutaPorAcceso[audience]);
        else setSesionExistente(usuario);
      })
      .catch((cause: unknown) => {
        if (!vigente || (cause instanceof ApiError && cause.status === 401)) return;
        // Los errores distintos a una sesión cerrada se muestran para que la persona pueda actuar.
        setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la sesión.');
      })
      .finally(() => { if (vigente) setRevisandoSesion(false); });
    return () => { vigente = false; };
  }, [audience, esGeneral, rolEsperado, router]);

  // Se cierra la sesión anterior antes de cambiar entre cliente y administrador.
  async function cerrarSesionExistente() {
    setError('');
    setProcesando(true);
    try {
      await api.logout();
      setSesionExistente(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión actual.');
    } finally {
      setProcesando(false);
    }
  }

  // Este botón inicia sesión o crea la cuenta de pasajero, según la pantalla.
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (registering && password !== passwordConfirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setProcesando(true);
    try {
      const usuario = registering
        ? await api.registrarPasajero({ username, password, nombreCompleto, correo })
        : await api.login(username, password);

      if (!esGeneral && usuario.rol !== rolEsperado) {
        await api.logout();
        setError(esCliente
          ? 'Esta cuenta no tiene acceso al espacio de clientes.'
          : audience === 'organizador' ? 'Esta cuenta no tiene acceso al espacio de organizadores.' : 'Esta cuenta no tiene permisos de administración.');
        return;
      }

      router.replace(esGeneral ? rutaPorRol[usuario.rol] : rutaPorAcceso[audience]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar el acceso.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <main className={`auth-page auth-page--${audience}`}>
      {/* La cabecera permite volver al inicio sin perder la marca. */}
      <header className="auth-header">
        <Link className="brand" href="/" aria-label="RUTABOL-SCZ, inicio">
          <span className="brand-mark"><span className="brand-route-mark">R</span></span>
          <span><strong>RUTABOL-SCZ</strong><small>Movilidad que conecta</small></span>
        </Link>
        <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true" /> Volver al inicio</Link>
      </header>

      <div className="auth-layout">
        {/* La ilustración acompaña el acceso y no representa un mapa real. */}
        <aside className={`auth-visual auth-visual--${audience}`}>
          <div className="auth-visual__content">
            <Badge className="auth-kicker"><span className="status-dot" /> {registering ? 'REGISTRO DE CLIENTE' : esGeneral ? 'ACCESO RUTABOL-SCZ' : esCliente ? 'ESPACIO CLIENTE' : 'ACCESO RESTRINGIDO'}</Badge>
            <h1>{esCliente || esGeneral ? 'Muévete a tu ritmo.' : 'Control claro. Ciudad conectada.'}</h1>
            <p>{esCliente
              ? 'Gestiona tus viajes en un espacio pensado para acompañarte por la ciudad.'
              : esGeneral ? 'Un solo inicio de sesión para clientes y personal autorizado. Tu rol abre el panel que te corresponde.'
              : 'Herramientas de movilidad disponibles para personal autorizado.'}</p>
            <div className="auth-art"><TransitMapArt variant="hero" /></div>
            <div className="auth-assurance"><BadgeCheck aria-hidden="true" /><span>Sesiones protegidas por tu cuenta RUTABOL-SCZ</span></div>
          </div>
          <span className="auth-glow" aria-hidden="true" />
        </aside>

        {/* En este lado aparece el formulario de acceso o el aviso de sesión existente. */}
        <section className="auth-content">
          <div className="auth-form-wrap">
            <Badge className="auth-role-badge"><UserRound aria-hidden="true" />{registering ? ' REGISTRO DE CLIENTE' : esGeneral ? ' INICIO DE SESIÓN' : ' ACCESO CLIENTE'}</Badge>
            <h2>{titulo}</h2>
            <p className="auth-subtitle">{subtitulo}</p>

            {error && <Alert>{error}</Alert>}

            {/* Se muestra la sesión, el formulario o el aviso de carga según corresponda. */}
            {revisandoSesion ? (
              <Card className="auth-state" role="status"><span className="loading-spinner" /> Comprobando sesión…</Card>
            ) : sesionExistente ? (
              <Card className="auth-session-card">
                <span className="auth-session-card__icon"><LockKeyhole aria-hidden="true" /></span>
                <h3>Ya hay una sesión activa</h3>
                <p>La cuenta <strong>{sesionExistente.username}</strong> ingresó como {nombreRol[sesionExistente.rol]}. Cierra esa sesión para cambiar de acceso.</p>
                <Button type="button" onClick={() => void cerrarSesionExistente()} disabled={procesando}>
                  {procesando ? 'Cerrando sesión…' : 'Cerrar sesión'} <ArrowRight aria-hidden="true" />
                </Button>
              </Card>
            ) : (
              <Card className="auth-form-card">
                <form className="access-form" onSubmit={(event) => void enviar(event)}>
                  {/* Nombre y correo solo se piden al crear una cuenta de pasajero. */}
                  {registering && (
                    <>
                      <FormField id="nombre-completo" label="Nombre completo" icon={UserRound} autoComplete="name" required maxLength={160} value={nombreCompleto} onChange={(event) => setNombreCompleto(event.target.value)} />
                      <FormField id="correo" label="Correo electrónico" icon={Mail} type="email" autoComplete="email" required maxLength={254} value={correo} onChange={(event) => setCorreo(event.target.value)} />
                    </>
                  )}
                  <FormField id="username" label="Usuario" icon={UserRound} autoComplete="username" required maxLength={80} value={username} onChange={(event) => setUsername(event.target.value)} />
                  {/* Para entrar se conserva la contraseña existente; al registrarse se limita a 30 caracteres. */}
                  <FormField
                    id="password"
                    label="Contraseña"
                    icon={LockKeyhole}
                    type="password"
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    required
                    minLength={registering ? 12 : undefined}
                    maxLength={registering ? 30 : 128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    strength={registering && password ? fuerzaContrasena(password) : undefined}
                  />
                  {registering && (
                    <FormField id="password-confirmacion" label="Confirmar contraseña" icon={LockKeyhole} type="password" autoComplete="new-password" required minLength={12} maxLength={30} value={passwordConfirmacion} onChange={(event) => setPasswordConfirmacion(event.target.value)} />
                  )}
                  {registering && <p className="auth-password-note">La API actual requiere mínimo 12 caracteres; puedes usar hasta 30.</p>}
                  {/* El botón queda ocupado mientras el servidor responde. */}
                  <Button className="access-submit" type="submit" disabled={procesando}>
                    {procesando ? 'Procesando…' : registering ? 'Crear cuenta de cliente' : 'Iniciar sesión'} <ArrowRight aria-hidden="true" />
                  </Button>
                </form>
              </Card>
            )}

            {/* Solo el acceso de pasajero ofrece el enlace para crear una cuenta. */}
            {(esCliente || esGeneral) && !registering && !revisandoSesion && !sesionExistente && (
              <p className="auth-switch">
                ¿Primera vez por aquí? <Link href="/acceso/cliente/registro">Crea una cuenta de cliente</Link>
              </p>
            )}
            {registering && <p className="auth-switch">¿Ya tienes cuenta? <Link href="/acceso">Inicia sesión</Link></p>}
            <p className="auth-fiction">Plataforma de demostración. Los datos son ficticios.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
