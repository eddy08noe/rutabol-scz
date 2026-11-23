'use client';

// Protege las páginas privadas y evita mostrar un panel a una cuenta sin el rol esperado.
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import type { RolUsuario, Usuario } from '@/lib/types';

// Guarda la persona ya validada para que los componentes del panel puedan usar sus datos.
const PortalSessionContext = createContext<Usuario | null>(null);

// Permite que cualquier componente dentro del portal consulte la sesión validada.
export function usePortalSession() {
  const usuario = useContext(PortalSessionContext);
  if (!usuario) throw new Error('La sesión del portal no está disponible.');
  return usuario;
}

// Confirma la sesión y el rol antes de mostrar el contenido privado.
export default function RoleGuard({ role, children }: { role: Extract<RolUsuario, 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO'>; children: React.ReactNode }) {
  const router = useRouter();
  // El usuario solo deja de ser nulo cuando el servidor confirma la cuenta.
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  // Estos valores permiten mostrar un error o volver a intentar la comprobación.
  const [error, setError] = useState('');
  const [reintentos, setReintentos] = useState(0);

  // Se consulta al servidor al entrar y cada vez que la persona solicita reintentar.
  useEffect(() => {
    let vigente = true;
    setError('');
    api.usuarioActual()
      .then((actual) => {
        if (!vigente) return;
        // Si el rol no coincide, se envía a la pantalla de acceso correspondiente.
        if (actual.rol !== role) {
          router.replace('/acceso');
          return;
        }
        setUsuario(actual);
      })
      .catch((cause: unknown) => {
        if (!vigente) return;
        // Una sesión vencida vuelve al acceso; otros errores se explican en la pantalla.
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/acceso');
          return;
        }
        setError(cause instanceof Error ? cause.message : 'No se pudo verificar la sesión.');
      });
    // Evita actualizar la pantalla si la persona salió antes de terminar la consulta.
    return () => { vigente = false; };
  }, [reintentos, role, router]);

  // Si falla la consulta por un motivo distinto, se ofrece volver a intentarlo.
  if (error) {
    return (
      <main className="guard-state">
        <div className="guard-card">
          <h1>No pudimos validar tu sesión</h1>
          <p role="alert">{error}</p>
          <button className="button button-primary" type="button" onClick={() => { setUsuario(null); setReintentos((actual) => actual + 1); }}>Reintentar</button>
        </div>
      </main>
    );
  }

  // Mientras se comprueba el rol, el panel privado permanece oculto.
  if (!usuario || usuario.rol !== role) {
    return <main className="guard-state" role="status"><div className="access-loading">Verificando acceso…</div></main>;
  }

  // Solo una sesión confirmada puede acceder a las páginas protegidas.
  return <PortalSessionContext.Provider value={usuario}>{children}</PortalSessionContext.Provider>;
}
