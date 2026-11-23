'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BusFront, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import PortalShell from '@/components/PortalShell';
import { api, type Abordaje } from '@/lib/api';
import type { AforoViaje, Parada, Viaje } from '@/lib/types';

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function Status({ value }: { value: string }) {
  const good = ['EN_CURSO', 'FINALIZADO'].includes(value);
  return <Badge className={`state-badge ${good ? 'state-badge--success' : 'state-badge--pending'}`}>{value.replaceAll('_', ' ')}</Badge>;
}

export default function DriverDashboard() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajeId, setViajeId] = useState<number | null>(null);
  const [aforo, setAforo] = useState<AforoViaje | null>(null);
  const [abordajes, setAbordajes] = useState<Abordaje[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [paradaBajadaId, setParadaBajadaId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recargar, setRecargar] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api.viajes()
      .then((items) => {
        if (!vigente) return;
        const asignados = items.filter((viaje) => ['PROGRAMADO', 'EN_CURSO', 'EMERGENCIA'].includes(viaje.estado));
        setViajes(asignados);
        const principal = asignados.find((viaje) => ['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado)) ?? asignados[0];
        setViajeId((actual) => actual && asignados.some((viaje) => Number(viaje.id) === Number(actual))
          ? actual
          : principal?.id ?? null);
        if (recargar === 0 && principal) void cargarActividad(principal);
      })
      .catch((cause: unknown) => { if (vigente) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus viajes.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [recargar]);

  const viajeSeleccionado = useMemo(() => viajes.find((viaje) => Number(viaje.id) === Number(viajeId)) ?? null, [viajes, viajeId]);

  async function cargarActividad(viaje: Viaje) {
    setViajeId(viaje.id);
    setError('');
    setCargandoActividad(true);
    try {
      const [ocupacion, personas, paradasViaje] = await Promise.all([
        api.aforoViaje(viaje.id), api.abordajesViaje(viaje.id), api.paradas(viaje.lineaId),
      ]);
      setAforo(ocupacion);
      setAbordajes(personas);
      setParadas(paradasViaje);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la actividad del viaje.');
    } finally {
      setCargandoActividad(false);
    }
  }

  async function ejecutar(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMensaje('');
    try {
      await action();
      setMensaje(success);
      setRecargar((value) => value + 1);
      if (viajeSeleccionado) await cargarActividad(viajeSeleccionado);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function registrarUbicacion() {
    if (!viajeSeleccionado) return;
    if (!navigator.geolocation) {
      setError('Este navegador no ofrece acceso a la ubicación.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void ejecutar(() => api.registrarUbicacion({
          viajeId: Number(viajeSeleccionado.id),
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        }), 'Ubicación registrada.');
      },
      () => { setBusy(false); setError('No se pudo obtener tu ubicación. Revisa el permiso del navegador.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function reportarEmergencia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viajeSeleccionado) return;
    const form = new FormData(event.currentTarget);
    const tipo = String(form.get('tipo')) as 'FALLA_MECANICA' | 'EMERGENCIA_CONDUCTOR' | 'OTRA';
    const descripcion = String(form.get('descripcion') ?? '').trim();
    await ejecutar(() => api.reportarIncidente(viajeSeleccionado.id, { tipo, descripcion }), 'Emergencia reportada.');
  }

  async function registrarAbordaje(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viajeSeleccionado) return;
    const form = new FormData(event.currentTarget);
    const codigo = String(form.get('codigo') ?? '').trim();
    const paradaSubidaId = String(form.get('paradaSubidaId') ?? '');
    const metodoPago = form.get('metodoPago') === 'EFECTIVO' ? 'EFECTIVO' as const : undefined;
    const done = await ejecutar(() => api.registrarAbordaje({
      codigo,
      viajeId: Number(viajeSeleccionado.id),
      ...(paradaSubidaId ? { paradaSubidaId: Number(paradaSubidaId) } : {}),
      ...(metodoPago ? { metodoPago } : {}),
    }), 'Abordaje registrado.');
    if (done) event.currentTarget.reset();
  }

  return (
    <PortalShell audience="chofer">
      <div className="workspace">
        <main className="workspace-main">
          <div className="workspace-heading">
            <div><Badge className="portal-eyebrow"><span className="status-dot" />OPERACIÓN DE VIAJES</Badge><h1>Panel <span>de chofer</span>.</h1><p>Consulta tus viajes, registra ubicación y controla los abordajes.</p></div>
            <Button variant="ghost" type="button" disabled={cargando} onClick={() => setRecargar((value) => value + 1)}>Actualizar viajes</Button>
          </div>
          {error && <Alert>{error}</Alert>}
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {cargando ? <div className="workspace-loading" role="status"><span className="loading-spinner" />Cargando tus viajes…</div> : viajes.length === 0 ? (
            <EmptyState icon={BusFront} title="No tienes viajes asignados" description="Cuando un organizador te asigne un viaje, aparecerá aquí." />
          ) : (
            <div className="workspace-grid workspace-grid--two">
              <section className="workspace-card">
                <div className="workspace-card__heading"><div><Badge className="section-kicker">ASIGNADOS A TU CUENTA</Badge><h2>Mis viajes</h2></div></div>
                <div className="workspace-list">{viajes.map((viaje) => <article className="workspace-admin-item" key={viaje.id}>
                  <div className="workspace-admin-item__head"><div><strong>Viaje #{viaje.id} · {viaje.linea}</strong><small>Micro {viaje.interno} · {viaje.placa} · {viaje.conductor}</small></div><Status value={viaje.estado} /></div>
                  <small>Inicio {formatDate(viaje.iniciadoEn)}</small>
                  <div className="workspace-row-actions">
                    <Button type="button" variant="ghost" onClick={() => void cargarActividad(viaje)}>Ver actividad</Button>
                    {viaje.estado === 'PROGRAMADO' && <Button type="button" disabled={busy} onClick={() => void ejecutar(() => api.iniciarViaje(viaje.id), 'Viaje iniciado.')}>Iniciar viaje</Button>}
                    {['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado) && <Button type="button" disabled={busy} onClick={() => void ejecutar(() => api.finalizarViaje(viaje.id), 'Viaje finalizado.')}>Finalizar viaje</Button>}
                  </div>
                </article>)}</div>
              </section>

              <section className="workspace-card">
                <div className="workspace-card__heading"><div><Badge className="section-kicker">VIAJE SELECCIONADO</Badge><h2>{viajeSeleccionado ? `#${viajeSeleccionado.id} · ${viajeSeleccionado.linea}` : 'Elige un viaje'}</h2></div></div>
                {!viajeSeleccionado ? <p className="workspace-note">Selecciona “Ver actividad” en uno de tus viajes.</p> : <>
                  <div className="workspace-row-actions"><Button type="button" variant="ghost" disabled={busy || viajeSeleccionado.estado !== 'EN_CURSO'} onClick={registrarUbicacion}>Registrar mi ubicación</Button><Button type="button" variant="ghost" disabled={cargandoActividad} onClick={() => void cargarActividad(viajeSeleccionado)}>Actualizar aforo</Button></div>
                  {aforo && <div className="workspace-stats workspace-stats--compact"><div><strong>{aforo.ocupacion}</strong><span>A bordo</span></div><div><strong>{aforo.disponibles ?? '—'}</strong><span>Lugares libres</span></div><div><strong>{aforo.capacidad ?? aforo.capacidadAutorizada}</strong><span>Capacidad</span></div></div>}
                  <form className="workspace-form workspace-form--compact" onSubmit={(event) => void registrarAbordaje(event)}>
                    <label className="workspace-field"><span>Código del pasaje</span><input className="workspace-input" name="codigo" type="text" placeholder="Pega el código que muestra el pasajero" maxLength={36} autoComplete="off" spellCheck={false} required /></label>
                    <label className="workspace-field"><span>Parada de subida</span><select className="workspace-select" name="paradaSubidaId" defaultValue=""><option value="">Sin especificar</option>{paradas.map((parada) => <option key={parada.id} value={parada.id}>{parada.nombre}</option>)}</select></label>
                    <label className="workspace-field"><span>Estado del pago</span><select className="workspace-select" name="metodoPago" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option value="PAGADO">Ya pagado o exento</option><option value="EFECTIVO">Cobrar en efectivo</option></select></label>
                    <div className="workspace-form__full"><Button type="submit" disabled={busy || viajeSeleccionado.estado !== 'EN_CURSO'}>Registrar abordaje</Button></div>
                  </form>
                  <p className="workspace-note">Pide al pasajero que muestre el código de su pasaje. Si está pendiente, cobra en efectivo aquí; si ya está pagado o exento, marca esa opción.</p>
                  <form className="workspace-form workspace-form--compact" onSubmit={(event) => void reportarEmergencia(event)}>
                    <label className="workspace-field"><span>Tipo de emergencia</span><select className="workspace-select" name="tipo" defaultValue="FALLA_MECANICA"><option value="FALLA_MECANICA">Falla mecánica</option><option value="EMERGENCIA_CONDUCTOR">Emergencia del conductor</option><option value="OTRA">Otra</option></select></label>
                    <label className="workspace-field"><span>Descripción</span><input className="workspace-input" name="descripcion" maxLength={2000} required /></label>
                    <div className="workspace-form__full"><Button type="submit" variant="ghost" disabled={busy || !['EN_CURSO', 'EMERGENCIA'].includes(viajeSeleccionado.estado)}>Reportar emergencia</Button></div>
                  </form>
                  <div className="workspace-section-heading workspace-section-heading--spaced"><div><Badge className="section-kicker">PASAJEROS</Badge><h2>Abordajes activos</h2></div></div>
                  <label className="workspace-field"><span>Parada de descenso</span><select className="workspace-select" value={paradaBajadaId} onChange={(event) => setParadaBajadaId(event.target.value)}><option value="">Sin especificar</option>{paradas.map((parada) => <option key={parada.id} value={parada.id}>{parada.nombre}</option>)}</select></label>
                  {abordajes.length ? <div className="workspace-list">{abordajes.map((abordaje) => <div className="workspace-list__row" key={abordaje.id}><span><strong>{abordaje.codigo ?? `Pasaje #${abordaje.pasajeId}`}</strong><small>{abordaje.categoria?.replaceAll('_', ' ') ?? 'Pasajero a bordo'}</small></span><Button type="button" variant="ghost" disabled={busy} onClick={() => void ejecutar(() => api.registrarDescenso(Number(abordaje.id), paradaBajadaId ? { paradaBajadaId: Number(paradaBajadaId) } : {}), 'Descenso registrado.')}>Registrar descenso</Button></div>)}</div> : <EmptyState icon={Users} title="Sin pasajeros a bordo" description="Los abordajes activos aparecerán aquí." />}
                </>}
              </section>
            </div>
          )}
        </main>
      </div>
    </PortalShell>
  );
}
