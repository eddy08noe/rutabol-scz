'use client';

// Este espacio reúne lo que el pasajero necesita para sus viajes.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity, BusFront, Check, CircleDollarSign, Clock3, CreditCard, FileCheck2, LocateFixed,
  MapPin, RefreshCw, Route, Ticket, UserRound, Wallet,
} from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import PortalShell from '@/components/PortalShell';
import { api } from '@/lib/api';
import type {
  CategoriaBeneficio, CategoriaTarifa, Linea, Micro, MicroCercano, Pago, Parada, Pasaje, Reembolso,
  SolicitudBeneficio, SolicitudEstudiante, Tarifa, Viaje,
} from '@/lib/types';
import { usePortalSession } from '@/components/RoleGuard';

// Identificadores usados para cambiar entre las secciones del cliente.
type ClientTab = 'inicio' | 'lineas' | 'tarifas' | 'pasajes' | 'pagos' | 'beneficios' | 'perfil';

// Datos que el panel reúne para construir las secciones del cliente.
interface ClientData {
  lineas: Linea[];
  micros: Micro[];
  paradas: Parada[];
  tarifas: Tarifa[];
  viajes: Viaje[];
  pasajes: Pasaje[];
  pagos: Pago[];
  reembolsos: Reembolso[];
  beneficios: SolicitudBeneficio[];
  estudiantes: SolicitudEstudiante[];
}

const TABS: Array<{ id: ClientTab; label: string }> = [
  { id: 'inicio', label: 'Resumen' },
  { id: 'lineas', label: 'Líneas y paradas' },
  { id: 'tarifas', label: 'Tarifas' },
  { id: 'pasajes', label: 'Mis pasajes' },
  { id: 'pagos', label: 'Mis pagos' },
  { id: 'beneficios', label: 'Beneficios' },
  { id: 'perfil', label: 'Mi perfil' },
];

// Convierte las categorías recibidas del sistema en nombres fáciles de reconocer.
const CATEGORY_LABELS: Record<CategoriaTarifa, string> = {
  GENERAL: 'General',
  MENOR_12: 'Menor de 12 años',
  ESCOLAR_PRIMARIA: 'Escolar primaria',
  ESCOLAR_SECUNDARIA: 'Escolar secundaria',
  UNIVERSITARIO: 'Universitario',
  ADULTO_MAYOR: 'Adulto mayor',
  DISCAPACIDAD: 'Persona con discapacidad',
  BENEMERITO: 'Benemérito',
  POLICIA_UNIFORMADO: 'Policía uniformado',
};

const STUDENT_CATEGORIES = new Set<CategoriaTarifa>(['ESCOLAR_PRIMARIA', 'ESCOLAR_SECUNDARIA', 'UNIVERSITARIO']);
const BENEFIT_CATEGORIES = new Set<CategoriaTarifa>(['MENOR_12', 'ADULTO_MAYOR', 'DISCAPACIDAD', 'BENEMERITO', 'POLICIA_UNIFORMADO']);

// Ayudan a enviar cada solicitud al tipo de beneficio que corresponde.
function isStudentCategory(category: CategoriaTarifa): category is SolicitudEstudiante['tipo'] {
  return STUDENT_CATEGORIES.has(category);
}

function isBenefitCategory(category: CategoriaTarifa): category is CategoriaBeneficio {
  return BENEFIT_CATEGORIES.has(category);
}

// Muestra importes con el formato de moneda local.
function formatAmount(amount: number | string, currency: string) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${currency}`;
  }
}

// Presenta las fechas de forma corta y comprensible para la persona.
function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(parsed);
}

// Prepara la fecha de hoy para los campos de fecha del formulario.
function localDateString() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// El color de la etiqueta ayuda a reconocer el estado del trámite.
function StateBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const className = ['APROBADO', 'PAGADO', 'FINALIZADO', 'CONFIRMADO', 'ACTIVO', 'REEMBOLSO_PARCIAL'].includes(normalized)
    ? 'state-badge state-badge--success'
    : ['RECHAZADO', 'FALLIDO', 'CANCELADO', 'INACTIVO', 'ERROR'].includes(normalized)
      ? 'state-badge state-badge--error'
      : 'state-badge state-badge--pending';
  return <Badge className={className}>{value.replaceAll('_', ' ')}</Badge>;
}

function LoadingPanel() {
  return <div className="workspace-loading" role="status"><span className="loading-spinner" />Cargando tus datos…</div>;
}

export default function ClientDashboard() {
  const usuario = usePortalSession();
  const [tab, setTab] = useState<ClientTab>('inicio');
  // Aquí se guarda la información y los mensajes que aparecen en el portal.
  const [data, setData] = useState<ClientData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recargar, setRecargar] = useState(0);
  // Estados de la búsqueda cercana, los formularios y las selecciones de la persona.
  const [microsCercanos, setMicrosCercanos] = useState<MicroCercano[] | null>(null);
  const [ubicacionError, setUbicacionError] = useState('');
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [lineaSeleccionada, setLineaSeleccionada] = useState('todas');
  const [buscarPasajes, setBuscarPasajes] = useState('');
  const [ordenPasajes, setOrdenPasajes] = useState<'recientes' | 'menor' | 'mayor'>('recientes');
  const [viajeSeleccionado, setViajeSeleccionado] = useState('');
  const [categoriaPasaje, setCategoriaPasaje] = useState<CategoriaTarifa>('GENERAL');
  const [categoriaBeneficio, setCategoriaBeneficio] = useState<CategoriaTarifa>('ADULTO_MAYOR');
  const [evidenciaRef, setEvidenciaRef] = useState('');
  // Datos adicionales que se piden según el beneficio elegido.
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [codigoRude, setCodigoRude] = useState('');
  const [codigoUniversitario, setCodigoUniversitario] = useState('');
  const [correoInstitucional, setCorreoInstitucional] = useState('');

  // Al entrar, se consultan los datos personales y la información pública disponible.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    async function cargar() {
      try {
        const [lineas, micros, paradas, tarifas, viajes, pasajes, pagos, reembolsos, beneficios, estudiantes] = await Promise.all([
          api.lineas(), api.micros(), api.paradas(), api.tarifas(), api.viajes(),
          api.pasajesMios(), api.pagos(), api.reembolsos(), api.beneficiosMios(), api.estudianteMio(),
        ]);
        if (!vigente) return;
        setData({ lineas, micros, paradas, tarifas, viajes, pasajes, pagos, reembolsos, beneficios, estudiantes });
        setViajeSeleccionado((actual) => actual || String(viajes.find((viaje) => ['PROGRAMADO', 'EN_CURSO'].includes(viaje.estado))?.id ?? ''));
      } catch (cause) {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos del portal.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [recargar]);

  // Estas listas dejan solo viajes y tarifas que el cliente puede usar en el formulario.
  const nombre = usuario.nombre_completo?.trim() || usuario.username;
  const viajesDisponibles = useMemo(
    () => data?.viajes.filter((viaje) => ['PROGRAMADO', 'EN_CURSO'].includes(viaje.estado)) ?? [],
    [data],
  );
  const viajeActual = viajesDisponibles.find((viaje) => String(viaje.id) === viajeSeleccionado);
  const lineasVisibles = data?.lineas.filter((linea) => lineaSeleccionada === 'todas' || String(linea.id) === lineaSeleccionada) ?? [];
  const tarifasDeViaje = data?.tarifas.filter((tarifa) => tarifa.lineaId === viajeActual?.lineaId) ?? [];
  const pasajesFiltrados = useMemo(() => {
    const query = buscarPasajes.trim().toLocaleLowerCase('es');
    const items = (data?.pasajes ?? []).filter((pasaje) => [
      pasaje.codigo, pasaje.linea, pasaje.interno, pasaje.placa, pasaje.importe,
      CATEGORY_LABELS[pasaje.categoria],
    ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(query)));
    if (ordenPasajes === 'menor') items.sort((a, b) => Number(a.importe) - Number(b.importe));
    if (ordenPasajes === 'mayor') items.sort((a, b) => Number(b.importe) - Number(a.importe));
    return items;
  }, [buscarPasajes, data, ordenPasajes]);
  const categoriasAprobadas = new Set<CategoriaTarifa>([
    ...((data?.beneficios ?? []).filter((solicitud) => solicitud.estadoValidacion === 'APROBADO'
      && (solicitud.lineaId == null || solicitud.lineaId === viajeActual?.lineaId)).map((solicitud) => solicitud.categoria)),
    ...(data?.estudiantes.filter((solicitud) => solicitud.estadoValidacion === 'APROBADO'
      && (solicitud.lineaId == null || solicitud.lineaId === viajeActual?.lineaId)).map((solicitud) => solicitud.tipo) ?? []),
  ]);
  const categoriasDisponibles = tarifasDeViaje
    .map((tarifa) => tarifa.categoria)
    .filter((categoria): categoria is CategoriaTarifa => categoria in CATEGORY_LABELS)
    .filter((categoria) => categoria === 'GENERAL' || categoriasAprobadas.has(categoria));

  // Solicita permiso al navegador y consulta al sistema solo cuando la persona lo pide.
  async function buscarMicrosCercanos() {
    setUbicacionError('');
    if (!navigator.geolocation) {
      setUbicacionError('Este navegador no permite consultar la ubicación.');
      return;
    }
    setBuscandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void api.microsCercanos(position.coords.latitude, position.coords.longitude)
          .then(setMicrosCercanos)
          .catch((cause: unknown) => setUbicacionError(cause instanceof Error ? cause.message : 'No se pudieron consultar micros cercanos.'))
          .finally(() => setBuscandoUbicacion(false));
      },
      (cause) => {
        setUbicacionError(cause.code === cause.PERMISSION_DENIED
          ? 'No tenemos permiso para usar tu ubicación. Puedes habilitarlo en los ajustes del navegador.'
          : 'No se pudo obtener tu ubicación. Intenta nuevamente en un lugar con mejor señal.');
        setBuscandoUbicacion(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Se solicita un pasaje para un viaje y una categoría disponibles.
  async function solicitarPasaje(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje('');
    setError('');
    setEnviando(true);
    try {
      const pasaje = await api.crearPasaje({
        viajeId: Number(viajeSeleccionado),
        categoria: categoriaPasaje,
      });
      setMensaje(pasaje.estado === 'PAGADO'
        ? `Pasaje ${pasaje.codigo} creado y exento según la tarifa vigente.`
        : `Pasaje ${pasaje.codigo} creado. Muéstrale este código al chofer y paga en efectivo al abordar.`);
      setTab('pasajes');
      setRecargar((actual) => actual + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el pasaje.');
    } finally {
      setEnviando(false);
    }
  }

  // La solicitud se envía al grupo de validación que corresponde a la categoría.
  async function solicitarBeneficio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lineaId = Number(form.get('lineaId'));
    setMensaje('');
    setError('');
    setEnviando(true);
    try {
      if (isStudentCategory(categoriaBeneficio)) {
        await api.solicitarEstudiante({
          lineaId,
          tipo: categoriaBeneficio,
          ...(categoriaBeneficio === 'UNIVERSITARIO'
            ? { codigoUniversitario, correoInstitucional }
            : { codigoRude }),
          evidenciaRef: evidenciaRef.trim(),
        });
      } else if (isBenefitCategory(categoriaBeneficio)) {
        await api.solicitarBeneficio({
          lineaId,
          categoria: categoriaBeneficio,
          evidenciaRef: evidenciaRef.trim(),
          ...(categoriaBeneficio === 'MENOR_12' ? { fechaNacimiento } : {}),
        });
      } else {
        throw new Error('Selecciona una categoría válida para la solicitud.');
      }
      setMensaje('Solicitud enviada. Podrás consultar su estado en esta sección.');
      setEvidenciaRef('');
      setFechaNacimiento('');
      setCodigoRude('');
      setCodigoUniversitario('');
      setCorreoInstitucional('');
      setRecargar((actual) => actual + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PortalShell audience="cliente">
      <div className="workspace">
        {/* Estas opciones cambian la sección visible sin salir del panel. */}
        <nav className="workspace-nav" aria-label="Secciones del portal cliente">
          {TABS.map((item) => (
            <button
              aria-current={tab === item.id ? 'page' : undefined}
              className={tab === item.id ? 'workspace-nav__item is-active' : 'workspace-nav__item'}
              key={item.id}
              onClick={() => { setTab(item.id); setError(''); setMensaje(''); }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="workspace-main">
          {/* Bienvenida, actualización de datos y mensajes de la operación seleccionada. */}
          <div className="workspace-heading">
            <div>
              <Badge className="portal-eyebrow"><span className="status-dot" />TU ESPACIO PERSONAL</Badge>
              <h1>Hola, <span>{nombre}</span>.</h1>
              <p>Tu movilidad en Santa Cruz, organizada en un solo lugar.</p>
            </div>
            <Button className="workspace-refresh" onClick={() => setRecargar((actual) => actual + 1)} type="button" variant="ghost" disabled={cargando}>
              <RefreshCw aria-hidden="true" />Actualizar
            </Button>
          </div>

          {error && <Alert>{error}</Alert>}
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {cargando && <LoadingPanel />}

          {/* Aquí el cliente consulta un resumen y busca micros cercanos si quiere. */}
          {!cargando && data && tab === 'inicio' && (
            <div className="workspace-view">
              {/* Contadores de la cuenta y actividad más reciente. */}
              <section className="workspace-stats" aria-label="Resumen de tu cuenta">
                <Card className="workspace-stat"><span className="workspace-stat__icon"><Ticket aria-hidden="true" /></span><span className="workspace-stat__value">{data.pasajes.length}</span><span className="workspace-stat__label">Pasajes</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--amber"><Wallet aria-hidden="true" /></span><span className="workspace-stat__value">{data.pagos.length}</span><span className="workspace-stat__label">Pagos registrados</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--green"><FileCheck2 aria-hidden="true" /></span><span className="workspace-stat__value">{data.beneficios.filter((solicitud) => solicitud.estadoValidacion === 'APROBADO').length + data.estudiantes.filter((solicitud) => solicitud.estadoValidacion === 'APROBADO').length}</span><span className="workspace-stat__label">Beneficios aprobados</span></Card>
              </section>

              <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-card">
                  {/* Consulta cercana bajo demanda: no se pide la ubicación al entrar. */}
                  <div className="workspace-card__heading"><div><Badge className="section-kicker">EN MOVIMIENTO</Badge><h2>Micros cercanos</h2></div><span className="workspace-card__icon"><LocateFixed aria-hidden="true" /></span></div>
                  <p className="workspace-card__intro">Comparte tu ubicación para ver micros activos dentro de un radio de 5 km.</p>
                  <Button onClick={() => void buscarMicrosCercanos()} type="button" disabled={buscandoUbicacion}><MapPin aria-hidden="true" />{buscandoUbicacion ? 'Buscando…' : 'Buscar con mi ubicación'}</Button>
                  {ubicacionError && <p className="workspace-inline-error" role="alert">{ubicacionError}</p>}
                  {microsCercanos && (microsCercanos.length
                    ? <div className="workspace-list">{microsCercanos.map((micro) => <div className="workspace-list__row" key={micro.id}><span className="workspace-list__icon"><BusFront aria-hidden="true" /></span><span><strong>Línea {micro.linea}</strong><small>Micro {micro.interno} · {micro.distanciaKm.toFixed(1)} km</small></span><StateBadge value={micro.estado} /></div>)}</div>
                    : <EmptyState icon={BusFront} title="No hay micros cercanos" description="No se encontraron micros activos con ubicación reciente cerca de ti." />)}
                  <p className="workspace-note">La ubicación solo se consulta cuando presionas el botón; no se guarda en tu perfil.</p>
                </Card>

                <Card className="workspace-card">
                  {/* Muestra algunos pasajes recientes para dar acceso rápido al historial. */}
                  <div className="workspace-card__heading"><div><Badge className="section-kicker">TU ACTIVIDAD</Badge><h2>Pasajes recientes</h2></div><span className="workspace-card__icon"><Activity aria-hidden="true" /></span></div>
                  {data.pasajes.length
                    ? <div className="workspace-list">{data.pasajes.slice(0, 4).map((pasaje) => <div className="workspace-list__row" key={pasaje.id}><span className="workspace-list__icon"><Ticket aria-hidden="true" /></span><span><strong>{pasaje.codigo}</strong><small>{CATEGORY_LABELS[pasaje.categoria]} · {formatDate(pasaje.creadoEn)}</small></span><StateBadge value={pasaje.estado} /></div>)}</div>
                    : <EmptyState icon={Ticket} title="Aún no tienes pasajes" description="Cuando generes un pasaje, aparecerá aquí junto con su estado." />}
                </Card>
              </div>
            </div>
          )}

          {/* Aquí se muestran las líneas y las paradas de cada recorrido. */}
          {!cargando && data && tab === 'lineas' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">RECORRIDOS</Badge><h2>Líneas y paradas</h2></div><label className="workspace-select-label">Filtrar paradas <select className="workspace-select" value={lineaSeleccionada} onChange={(event) => setLineaSeleccionada(event.target.value)}><option value="todas">Todas las líneas</option>{data.lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></label></div>
              {lineasVisibles.length === 0 ? <EmptyState icon={Route} title="No hay líneas disponibles" description="Los recorridos aparecerán aquí cuando estén publicados." /> : <div className="workspace-grid workspace-grid--two">{lineasVisibles.map((linea) => {
                const paradas = data.paradas.filter((parada) => parada.lineaId === linea.id);
                return <Card className="workspace-line-card" key={linea.id} style={{ borderTopColor: linea.color }}><div className="workspace-line-card__title"><span className="workspace-line-dot" style={{ backgroundColor: linea.color }} /><div><h3>{linea.nombre}</h3><span>{linea.zona}</span></div></div><p>{linea.descripcion || 'Recorrido disponible en el sistema.'}</p><div className="workspace-stops">{paradas.length ? paradas.map((parada) => <span className="workspace-stop" key={parada.id}><MapPin aria-hidden="true" />{parada.nombre}</span>) : <span className="workspace-muted">Aún no hay paradas registradas.</span>}</div></Card>;
              })}</div>}
              <p className="workspace-note">Las ubicaciones de las paradas dependen de los datos publicados por el operador.</p>
            </section>
          )}

          {/* Aquí el cliente compara los precios que están vigentes. */}
          {!cargando && data && tab === 'tarifas' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">TARIFAS VIGENTES</Badge><h2>Precios por línea</h2></div></div>
              {data.tarifas.length === 0 ? <EmptyState icon={CircleDollarSign} title="No hay tarifas vigentes" description="Consulta más adelante o contacta al operador para obtener información." /> : <div className="workspace-grid workspace-grid--three">{data.tarifas.map((tarifa) => <Card className="workspace-fare-card" key={tarifa.id}><span>{tarifa.linea}</span><h3>{CATEGORY_LABELS[tarifa.categoria as CategoriaTarifa] ?? tarifa.categoria}</h3><strong>{formatAmount(tarifa.importe, tarifa.moneda)}</strong><small>Vigente desde {formatDate(tarifa.vigenteDesde)}</small></Card>)}</div>}
              <p className="workspace-note">El importe final se calcula según la tarifa vigente al crear el pasaje.</p>
            </section>
          )}

          {/* Aquí puede pedir un pasaje y revisar los que ya tiene. */}
          {!cargando && data && tab === 'pasajes' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">VIAJES DISPONIBLES</Badge><h2>Solicitar un pasaje</h2></div></div>
              {viajesDisponibles.length === 0
                ? <EmptyState icon={Ticket} title="No hay viajes disponibles" description="No se encontraron viajes programados o en curso para generar un pasaje." />
                : <Card className="workspace-form-card"><form className="workspace-form" onSubmit={(event) => void solicitarPasaje(event)}>
                  <label className="workspace-field"><span>Viaje</span><select className="workspace-select" required value={viajeSeleccionado} onChange={(event) => { setViajeSeleccionado(event.target.value); setCategoriaPasaje('GENERAL'); }}><option value="">Selecciona un viaje</option>{viajesDisponibles.map((viaje) => <option key={viaje.id} value={viaje.id}>#{viaje.id} · {viaje.linea} · Micro {viaje.interno} · {viaje.estado.replaceAll('_', ' ')}</option>)}</select></label>
                  <label className="workspace-field"><span>Categoría tarifaria</span><select className="workspace-select" required value={categoriaPasaje} onChange={(event) => setCategoriaPasaje(event.target.value as CategoriaTarifa)}><option value="">Selecciona una categoría</option>{categoriasDisponibles.map((categoria) => <option key={categoria} value={categoria}>{CATEGORY_LABELS[categoria]}</option>)}</select></label>
                  <div className="workspace-form__full"><Button type="submit" disabled={enviando || !viajeActual || categoriasDisponibles.length === 0}><Ticket aria-hidden="true" />{enviando ? 'Creando pasaje…' : 'Crear pasaje'}</Button></div>
                </form><p className="workspace-note">Solo aparecen las categorías vigentes y los beneficios aprobados. En esta demostración no hay pago con tarjeta: si el pasaje queda pendiente, muéstrale el código al chofer y paga en efectivo al subir.</p></Card>}

              <div className="workspace-section-heading workspace-section-heading--spaced"><div><Badge className="section-kicker">HISTORIAL</Badge><h2>Mis pasajes</h2></div></div>
              {data.pasajes.length === 0 ? <EmptyState icon={Ticket} title="Aún no tienes pasajes" description="Tus pasajes aparecerán aquí después de solicitarlos." /> : <>
                <div className="workspace-form workspace-form--compact">
                  <label className="workspace-field"><span>Buscar por código, línea, micro, placa o precio</span><input className="workspace-input" value={buscarPasajes} onChange={(event) => setBuscarPasajes(event.target.value)} placeholder="Ej. Línea Roja, 3.50 o ABC-123" /></label>
                  <label className="workspace-field"><span>Ordenar pasajes</span><select className="workspace-select" value={ordenPasajes} onChange={(event) => setOrdenPasajes(event.target.value as typeof ordenPasajes)}><option value="recientes">Más recientes</option><option value="menor">Menor precio primero</option><option value="mayor">Mayor precio primero</option></select></label>
                </div>
                {pasajesFiltrados.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Código</th><th>Línea</th><th>Micro</th><th>Categoría</th><th>Importe</th><th>Estado</th><th>Creado</th></tr></thead><tbody>{pasajesFiltrados.map((pasaje) => <tr key={pasaje.id}><td><strong>{pasaje.codigo}</strong></td><td>{pasaje.linea ?? `#${pasaje.lineaId}`}</td><td>{pasaje.interno ? `${pasaje.interno} · ${pasaje.placa ?? ''}` : `Viaje #${pasaje.viajeInicialId}`}</td><td>{CATEGORY_LABELS[pasaje.categoria]}</td><td>{formatAmount(pasaje.importe, pasaje.moneda)}</td><td><StateBadge value={pasaje.estado} /></td><td>{formatDate(pasaje.creadoEn)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Ticket} title="Sin resultados" description="Prueba otra búsqueda o cambia el orden." />}
              </>}
            </section>
          )}

          {/* Aquí consulta los pagos y reembolsos registrados en su cuenta. */}
          {!cargando && data && tab === 'pagos' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">MOVIMIENTOS</Badge><h2>Mis pagos y reembolsos</h2></div></div>
              <Alert tone="info">La pasarela de tarjeta no está configurada. Esta sección muestra únicamente los movimientos que la API ya registra.</Alert>
              <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">PAGOS</Badge><h2>Historial de pagos</h2></div><CreditCard aria-hidden="true" /></div>{data.pagos.length ? <div className="workspace-list">{data.pagos.map((pago) => <div className="workspace-list__row" key={pago.id}><span className="workspace-list__icon"><Wallet aria-hidden="true" /></span><span><strong>Pasaje #{pago.pasajeId} · {formatAmount(pago.importe, pago.moneda)}</strong><small>{pago.metodo} · {formatDate(pago.creadoEn)}</small></span><StateBadge value={pago.estado} /></div>)}</div> : <EmptyState icon={Wallet} title="Sin pagos registrados" description="Cuando el sistema registre un pago, podrás consultarlo aquí." />}</Card>
                <Card className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">DEVOLUCIONES</Badge><h2>Reembolsos</h2></div><Clock3 aria-hidden="true" /></div>{data.reembolsos.length ? <div className="workspace-list">{data.reembolsos.map((reembolso) => <div className="workspace-list__row" key={reembolso.id}><span className="workspace-list__icon"><CircleDollarSign aria-hidden="true" /></span><span><strong>Pasaje #{reembolso.pasajeId} · {formatAmount(reembolso.importe, 'BOB')}</strong><small>{reembolso.motivo} · {formatDate(reembolso.solicitadoEn)}</small></span><StateBadge value={reembolso.estado} /></div>)}</div> : <EmptyState icon={CircleDollarSign} title="Sin solicitudes de reembolso" description="No hay reembolsos asociados a tus pagos." />}</Card>
              </div>
            </section>
          )}

          {/* Aquí solicita beneficios y revisa cómo va la validación. */}
          {!cargando && data && tab === 'beneficios' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">VALIDACIÓN DE TARIFA</Badge><h2>Solicitar un beneficio</h2></div></div>
              <Card className="workspace-form-card">
                <form className="workspace-form" onSubmit={(event) => void solicitarBeneficio(event)}>
                  <label className="workspace-field"><span>Línea</span><select className="workspace-select" name="lineaId" required defaultValue=""><option value="" disabled>Selecciona la línea</option>{data.lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></label>
                  <label className="workspace-field"><span>Categoría</span><select className="workspace-select" value={categoriaBeneficio} onChange={(event) => setCategoriaBeneficio(event.target.value as CategoriaTarifa)}>{[...STUDENT_CATEGORIES, ...BENEFIT_CATEGORIES].map((categoria) => <option key={categoria} value={categoria}>{CATEGORY_LABELS[categoria]}</option>)}</select></label>
                  {isStudentCategory(categoriaBeneficio) && categoriaBeneficio === 'UNIVERSITARIO' ? <>
                    <label className="workspace-field"><span>Código universitario</span><input className="workspace-input" required maxLength={40} value={codigoUniversitario} onChange={(event) => setCodigoUniversitario(event.target.value)} /></label>
                    <label className="workspace-field"><span>Correo institucional (@upds.edu.bo)</span><input className="workspace-input" type="email" required maxLength={254} value={correoInstitucional} onChange={(event) => setCorreoInstitucional(event.target.value)} /></label>
                  </> : isStudentCategory(categoriaBeneficio) ? <label className="workspace-field"><span>Código RUDE</span><input className="workspace-input" required maxLength={40} value={codigoRude} onChange={(event) => setCodigoRude(event.target.value)} /></label> : null}
                  {categoriaBeneficio === 'MENOR_12' && <label className="workspace-field"><span>Fecha de nacimiento</span><input className="workspace-input" required type="date" max={localDateString()} value={fechaNacimiento} onChange={(event) => setFechaNacimiento(event.target.value)} /></label>}
                  <label className="workspace-field workspace-form__full"><span>Referencia de evidencia</span><input className="workspace-input" required maxLength={1000} value={evidenciaRef} onChange={(event) => setEvidenciaRef(event.target.value)} placeholder="Referencia o descripción del documento" /></label>
                  <div className="workspace-form__full"><Button type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</Button></div>
                </form>
                <p className="workspace-note">La API recibe una referencia textual de evidencia, no archivos adjuntos. Usa una referencia no sensible; no introduzcas documentos personales completos.</p>
              </Card>
              <div className="workspace-section-heading workspace-section-heading--spaced"><div><Badge className="section-kicker">ESTADO</Badge><h2>Mis solicitudes</h2></div></div>
              <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-card"><h3>Beneficios tarifarios</h3>{data.beneficios.length ? <div className="workspace-list">{data.beneficios.map((item) => <div className="workspace-list__row" key={item.id}><span className="workspace-list__icon"><FileCheck2 aria-hidden="true" /></span><span><strong>{CATEGORY_LABELS[item.categoria]}</strong><small>{data.lineas.find((linea) => linea.id === item.lineaId)?.nombre ?? 'Todas las líneas'} · {item.motivoRechazo || (item.revisadoEn ? `Revisado ${formatDate(item.revisadoEn)}` : 'Pendiente de revisión')}</small></span><StateBadge value={item.estadoValidacion} /></div>)}</div> : <EmptyState icon={FileCheck2} title="Sin solicitudes" description="Todavía no has solicitado beneficios tarifarios." />}</Card>
                <Card className="workspace-card"><h3>Validación estudiantil</h3>{data.estudiantes.length ? <div className="workspace-list">{data.estudiantes.map((item) => <div className="workspace-list__row" key={item.id}><span className="workspace-list__icon"><Check aria-hidden="true" /></span><span><strong>{CATEGORY_LABELS[item.tipo]}</strong><small>{data.lineas.find((linea) => linea.id === item.lineaId)?.nombre ?? 'Todas las líneas'} · {item.motivoRechazo || (item.revisadoEn ? `Revisado ${formatDate(item.revisadoEn)}` : 'Pendiente de revisión')}</small></span><StateBadge value={item.estadoValidacion} /></div>)}</div> : <EmptyState icon={FileCheck2} title="Sin solicitud estudiantil" description="Si eres estudiante, puedes registrar su categoría para una línea." />}</Card>
              </div>
            </section>
          )}

          {/* Aquí puede consultar los datos de su cuenta. */}
          {!cargando && data && tab === 'perfil' && (
            <section className="workspace-view">
              <div className="workspace-section-heading"><div><Badge className="section-kicker">CUENTA</Badge><h2>Mi perfil</h2></div></div>
              {/* Datos que la API permite consultar; no hay edición disponible desde aquí. */}
              <Card className="workspace-profile-card"><span className="workspace-profile-icon"><UserRound aria-hidden="true" /></span><div className="workspace-profile-grid"><div><small>Nombre completo</small><strong>{usuario.nombre_completo || 'No registrado'}</strong></div><div><small>Usuario</small><strong>{usuario.username}</strong></div><div><small>Correo</small><strong>{usuario.correo || 'No registrado'}</strong></div><div><small>Tipo de cuenta</small><strong>Pasajero</strong></div></div></Card>
              <Alert tone="info">La API permite consultar tu perfil, pero no ofrece un endpoint para editar los datos de cuenta.</Alert>
              <p className="workspace-note">Los datos de demostración son ficticios. La ubicación se solicita bajo demanda y no se almacena en el perfil.</p>
            </section>
          )}

          {!cargando && !data && !error && <EmptyState icon={Activity} title="No hay datos disponibles" description="Intenta actualizar el portal en unos momentos." />}
        </main>
      </div>
    </PortalShell>
  );
}
