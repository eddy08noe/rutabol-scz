'use client';

// En este panel se organizan las tareas diarias de administración.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, BarChart3, BusFront, Check, CircleDollarSign, ClipboardList, CreditCard, FileCheck2, Gauge,
  MapPin, RefreshCw, Route, ShieldCheck, Ticket, Users, Wallet,
} from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import PortalShell from '@/components/PortalShell';
import {
  api,
  type Abordaje,
  type Conductor,
  type Organizador,
  type SolicitudBeneficioAdmin,
  type SolicitudEstudianteAdmin,
  type Trasbordo,
} from '@/lib/api';
import type {
  AforoViaje, CategoriaTarifa, EstadoMicro, Linea, Micro, Pago, Parada, Reembolso, ReporteIngresos,
  ReporteIngresosFila, Tarifa, Viaje,
} from '@/lib/types';

// Secciones a las que se puede entrar desde el menú administrativo.
type AdminTab =
  | 'inicio' | 'organizadores' | 'lineas' | 'micros' | 'conductores' | 'tarifas' | 'paradas'
  | 'solicitudes' | 'viajes' | 'trasbordos' | 'pagos' | 'reportes';

type ReportGrouping = 'DIA' | 'SEMANA' | 'MES';

interface ReportAggregate {
  key: string;
  label: string;
  cobrado: number;
  devuelto: number;
  neto: number;
  pagos: number;
  devoluciones: number;
}

interface ReportFilters {
  desde: string;
  hasta: string;
  agrupacion: ReportGrouping;
  lineaId: string;
  conductorId: string;
  microId: string;
}

// Conjunto de listados que se usa en las distintas secciones administrativas.
interface AdminData {
  lineas: Linea[];
  micros: Micro[];
  conductores: Conductor[];
  paradas: Parada[];
  tarifas: Tarifa[];
  viajes: Viaje[];
  pagos: Pago[];
  reembolsos: Reembolso[];
  beneficios: SolicitudBeneficioAdmin[];
  estudiantes: SolicitudEstudianteAdmin[];
  trasbordos: Trasbordo[];
  organizadores: Organizador[];
}

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'inicio', label: 'Resumen' },
  { id: 'organizadores', label: 'Organizadores' },
  { id: 'lineas', label: 'Líneas' },
  { id: 'micros', label: 'Micros' },
  { id: 'conductores', label: 'Conductores' },
  { id: 'tarifas', label: 'Tarifas' },
  { id: 'paradas', label: 'Paradas' },
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'viajes', label: 'Viajes y abordajes' },
  { id: 'trasbordos', label: 'Trasbordos' },
  { id: 'pagos', label: 'Pagos y reembolsos' },
  { id: 'reportes', label: 'Reportes de ingresos' },
];

// Categorías disponibles al ingresar una tarifa en el panel.
const CATEGORIAS: Array<{ value: CategoriaTarifa; label: string }> = [
  { value: 'GENERAL', label: 'General' },
  { value: 'MENOR_12', label: 'Menor de 12 años' },
  { value: 'ESCOLAR_PRIMARIA', label: 'Escolar primaria' },
  { value: 'ESCOLAR_SECUNDARIA', label: 'Escolar secundaria' },
  { value: 'UNIVERSITARIO', label: 'Universitario' },
  { value: 'ADULTO_MAYOR', label: 'Adulto mayor' },
  { value: 'DISCAPACIDAD', label: 'Persona con discapacidad' },
  { value: 'BENEMERITO', label: 'Benemérito' },
  { value: 'POLICIA_UNIFORMADO', label: 'Policía uniformado' },
];

// Convierte un importe a moneda local para mostrarlo en las tablas.
function formatAmount(amount: number | string, currency: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency }).format(parsed);
  } catch {
    return `${parsed.toFixed(2)} ${currency}`;
  }
}

// Presenta una fecha de forma corta y evita mostrar fechas inválidas.
function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(parsed);
}

// Devuelve la fecha de hoy en un formato que aceptan los campos de fecha.
function localDateString() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Usa un color distinto para los estados aprobados, rechazados o pendientes.
function StateBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const className = ['APROBADO', 'PAGADO', 'FINALIZADO', 'CONFIRMADO', 'ACTIVO', 'ACTIVA', 'REEMBOLSO_PARCIAL'].includes(normalized)
    ? 'state-badge state-badge--success'
    : ['RECHAZADO', 'FALLIDO', 'CANCELADO', 'INACTIVO', 'INACTIVA', 'ERROR'].includes(normalized)
      ? 'state-badge state-badge--error'
      : 'state-badge state-badge--pending';
  return <Badge className={className}>{value.replaceAll('_', ' ')}</Badge>;
}

// Etiqueta reutilizable que mantiene el mismo orden en todos los formularios.
function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`workspace-field${full ? ' workspace-form__full' : ''}`}><span>{label}</span>{children}</label>;
}

// Título común para que cada sección indique su grupo y nombre.
function PanelHeading({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return <div className="workspace-section-heading"><div><Badge className="section-kicker">{kicker}</Badge><h2>{title}</h2></div>{action}</div>;
}

// Aviso que se muestra mientras llegan los datos de la API.
function LoadingPanel() {
  return <div className="workspace-loading" role="status"><span className="loading-spinner" />Cargando datos administrativos…</div>;
}

// Lectura de valores de los formularios, limpiando espacios antes de enviarlos.
function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

function matchesSearch(search: string, ...values: Array<string | number | null | undefined>) {
  const query = search.trim().toLocaleLowerCase('es');
  return !query || values.some((value) => String(value ?? '').toLocaleLowerCase('es').includes(query));
}

// Convierte los campos numéricos antes de enviarlos al servicio.
function formNumber(form: FormData, key: string) {
  return Number(form.get(key));
}

// Los campos numéricos opcionales se envían solo cuando tienen un valor.
function optionalNumber(form: FormData, key: string) {
  const value = formText(form, key);
  return value ? Number(value) : undefined;
}

function aggregateReportRows(
  rows: ReporteIngresosFila[],
  getKey: (row: ReporteIngresosFila) => string | number,
  getLabel: (row: ReporteIngresosFila) => string,
): ReportAggregate[] {
  const groups = new Map<string, ReportAggregate>();
  rows.forEach((row) => {
    const key = String(getKey(row));
    const current = groups.get(key) ?? {
      key, label: getLabel(row), cobrado: 0, devuelto: 0, neto: 0, pagos: 0, devoluciones: 0,
    };
    current.cobrado += Number(row.cobrado);
    current.devuelto += Number(row.devuelto);
    current.pagos += row.pagos;
    current.devoluciones += row.devoluciones;
    current.neto = current.cobrado - current.devuelto;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => b.neto - a.neto || a.label.localeCompare(b.label, 'es'));
}

function ReportTable({ title, rows, period = false }: { title: string; rows: ReportAggregate[]; period?: boolean }) {
  const peak = Math.max(0, ...rows.map((row) => row.neto));
  return (
    <section className="workspace-card">
      <div className="workspace-card__heading"><div><Badge className="section-kicker">DESGLOSE</Badge><h2>{title}</h2></div><BarChart3 aria-hidden="true" /></div>
      {rows.length ? <div className="workspace-table-wrap"><table className="workspace-table">
        <thead><tr><th>{period ? 'Período' : 'Elemento'}</th><th>Cobrado</th><th>Reembolsos</th><th>Neto</th><th>Pagos</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.key}>
          <td><strong>{row.label}</strong>{period && <div className="workspace-report-track" aria-label={`Ingreso neto ${formatAmount(row.neto, 'BOB')}`}><span style={{ width: `${peak > 0 ? Math.max(0, row.neto) / peak * 100 : 0}%` }} /></div>}</td>
          <td>{formatAmount(row.cobrado, 'BOB')}</td><td>{formatAmount(row.devuelto, 'BOB')}</td><td><strong>{formatAmount(row.neto, 'BOB')}</strong></td><td>{row.pagos}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={BarChart3} title="Sin movimientos" description="No hay cobros o reembolsos confirmados para estos filtros." />}
    </section>
  );
}

export default function AdminDashboard({ mode = 'ADMIN' }: { mode?: 'ADMIN' | 'ORGANIZADOR' }) {
  const [tab, setTab] = useState<AdminTab>('inicio');
  // Datos, carga y mensajes que se muestran en el panel.
  const [data, setData] = useState<AdminData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busy, setBusy] = useState(false);
  const [recargar, setRecargar] = useState(0);
  const [buscarMicro, setBuscarMicro] = useState('');
  const [buscarConductor, setBuscarConductor] = useState('');
  const [buscarLinea, setBuscarLinea] = useState('');
  const [buscarParada, setBuscarParada] = useState('');
  const [buscarTarifa, setBuscarTarifa] = useState('');
  const [buscarViaje, setBuscarViaje] = useState('');
  const [buscarOrganizador, setBuscarOrganizador] = useState('');
  // Elemento seleccionado cuando se abre un formulario para editarlo.
  const [lineaEditando, setLineaEditando] = useState<Linea | null>(null);
  const [microEditando, setMicroEditando] = useState<Micro | null>(null);
  const [conductorEditando, setConductorEditando] = useState<Conductor | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  // Selecciones y resultados que se muestran al revisar un viaje.
  const [viajeSeleccionado, setViajeSeleccionado] = useState('');
  const [aforo, setAforo] = useState<AforoViaje | null>(null);
  const [abordajes, setAbordajes] = useState<Abordaje[]>([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [paradaBajadaId, setParadaBajadaId] = useState('');
  // Selecciones del formulario para programar viajes o crear trasbordos.
  const [tipoTrasbordo, setTipoTrasbordo] = useState<'NORMAL' | 'EMERGENCIA'>('NORMAL');
  const [lineaProgramada, setLineaProgramada] = useState('');
  const [microProgramado, setMicroProgramado] = useState('');
  const [viajeOrigenTrasbordo, setViajeOrigenTrasbordo] = useState('');
  const [viajeDestinoTrasbordo, setViajeDestinoTrasbordo] = useState('');
  const [reporte, setReporte] = useState<ReporteIngresos | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [filtrosReporte, setFiltrosReporte] = useState<ReportFilters>(() => {
    const hoy = localDateString();
    return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, agrupacion: 'DIA', lineaId: '', conductorId: '', microId: '' };
  });

  // Al abrir o actualizar el panel, se consultan los listados disponibles para administración.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    async function cargar() {
      try {
        const [lineas, micros, conductores, paradas, tarifas, viajes, pagos, reembolsos, beneficios, estudiantes, trasbordos, organizadores] =
          await Promise.all([
            api.lineas(), api.micros(), api.conductores(), api.paradas(), api.tarifas(), api.viajes(),
            mode === 'ADMIN' ? api.pagos() : Promise.resolve([]),
            mode === 'ADMIN' ? api.reembolsos() : Promise.resolve([]),
            api.beneficiosPendientes(), api.estudiantesPendientes(), api.trasbordos(),
            mode === 'ADMIN' ? api.organizadores() : Promise.resolve([]),
          ]);
        if (!vigente) return;
        setData({ lineas, micros, conductores, paradas, tarifas, viajes, pagos, reembolsos, beneficios, estudiantes, trasbordos, organizadores });
        setViajeSeleccionado((actual) => actual || String(viajes.find((viaje) => ['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado))?.id ?? ''));
      } catch (cause) {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos administrativos.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [recargar, mode]);

  useEffect(() => {
    if (mode !== 'ADMIN' || tab !== 'reportes') return;
    let vigente = true;
    setCargandoReporte(true);
    setError('');
    api.reporteIngresos(filtrosReporte)
      .then((result) => { if (vigente) setReporte(result); })
      .catch((cause: unknown) => { if (vigente) setError(cause instanceof Error ? cause.message : 'No se pudo generar el reporte.'); })
      .finally(() => { if (vigente) setCargandoReporte(false); });
    return () => { vigente = false; };
  }, [filtrosReporte, mode, tab]);

  // Estas listas filtran vehículos y viajes según el estado y la opción seleccionada.
  const viajesEnCurso = useMemo(
    () => data?.viajes.filter((viaje) => ['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado)) ?? [],
    [data],
  );
  const filasReporte = reporte?.filas ?? [];
  const microsFiltrados = data?.micros.filter((micro) => matchesSearch(buscarMicro, micro.interno, micro.placa, micro.estado,
    data.lineas.find((linea) => Number(linea.id) === Number(micro.lineaId))?.nombre)) ?? [];
  const conductoresFiltrados = data?.conductores.filter((conductor) => matchesSearch(buscarConductor,
    conductor.nombres, conductor.apellidos, conductor.username, conductor.correo, conductor.licencia, conductor.activo ? 'activo' : 'inactivo')) ?? [];
  const lineasFiltradas = data?.lineas.filter((linea) => matchesSearch(buscarLinea, linea.nombre, linea.zona, linea.activa ? 'activa' : 'inactiva')) ?? [];
  const paradasFiltradas = data?.paradas.filter((parada) => matchesSearch(buscarParada, parada.nombre,
    data.lineas.find((linea) => Number(linea.id) === Number(parada.lineaId))?.nombre, parada.orden)) ?? [];
  const tarifasFiltradas = data?.tarifas.filter((tarifa) => matchesSearch(buscarTarifa,
    tarifa.linea, tarifa.categoria, tarifa.importe, tarifa.moneda)) ?? [];
  const viajesFiltrados = data?.viajes.filter((viaje) => matchesSearch(buscarViaje,
    viaje.id, viaje.linea, viaje.interno, viaje.placa, viaje.conductor, viaje.estado)) ?? [];
  const organizadoresFiltrados = data?.organizadores.filter((organizador) => matchesSearch(buscarOrganizador,
    organizador.nombreCompleto, organizador.username, organizador.correo, ...organizador.lineas.map((linea) => linea.nombre))) ?? [];
  const reportePorPeriodo = useMemo(
    () => aggregateReportRows(filasReporte, (row) => row.periodo, (row) => row.periodo).sort((a, b) => a.key.localeCompare(b.key, 'es')),
    [filasReporte],
  );
  const reportePorLinea = useMemo(
    () => aggregateReportRows(filasReporte, (row) => row.lineaId, (row) => row.linea), [filasReporte],
  );
  const reportePorChofer = useMemo(
    () => aggregateReportRows(filasReporte, (row) => row.conductorId, (row) => row.conductor), [filasReporte],
  );
  const reportePorMicro = useMemo(
    () => aggregateReportRows(filasReporte, (row) => row.microId, (row) => `Micro ${row.interno} · ${row.placa}`), [filasReporte],
  );
  const selectedTrip = data?.viajes.find((viaje) => String(viaje.id) === viajeSeleccionado);
  const microOptions = data?.micros.filter((micro) =>
    micro.estado === 'ACTIVO' && (!lineaProgramada || String(micro.lineaId) === lineaProgramada),
  ) ?? [];
  const viajeOrigenSeleccionado = data?.viajes.find((viaje) => String(viaje.id) === viajeOrigenTrasbordo);
  const viajesOrigenDisponibles = data?.viajes.filter((viaje) =>
    tipoTrasbordo === 'NORMAL'
      ? viaje.estado === 'EN_CURSO'
      : ['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado),
  ) ?? [];
  const viajesDestinoDisponibles = data?.viajes.filter((viaje) =>
    viaje.estado === 'EN_CURSO'
      && String(viaje.id) !== viajeOrigenTrasbordo
      && (tipoTrasbordo === 'EMERGENCIA' || !viajeOrigenSeleccionado || viaje.lineaId === viajeOrigenSeleccionado.lineaId),
  ) ?? [];
  const microsDeLinea = (lineaId: number) => data?.micros.filter((micro) => micro.lineaId === lineaId && micro.estado !== 'INACTIVO') ?? [];
  const paradasDeLinea = (lineaId: number) => data?.paradas.filter((parada) => parada.lineaId === lineaId) ?? [];
  const tabs = mode === 'ADMIN' ? TABS : TABS.filter((item) => !['organizadores', 'pagos', 'reportes'].includes(item.id));

  // Operación común: muestra el resultado y vuelve a cargar los listados al guardar cambios.
  async function mutate(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setError('');
    setMensaje('');
    try {
      await action();
      setMensaje(successMessage);
      setRecargar((actual) => actual + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La operación no pudo completarse.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function generarReporte(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const desde = formText(form, 'desde');
    const hasta = formText(form, 'hasta');
    if (desde && hasta && desde > hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    setError('');
    setFiltrosReporte({
      desde,
      hasta,
      agrupacion: formText(form, 'agrupacion') as ReportGrouping,
      lineaId: formText(form, 'lineaId'),
      conductorId: formText(form, 'conductorId'),
      microId: formText(form, 'microId'),
    });
  }

  // Se consulta la ocupación y la lista de pasajeros de un viaje seleccionado.
  async function cargarActividad(viajeId: number) {
    setError('');
    setCargandoActividad(true);
    setViajeSeleccionado(String(viajeId));
    try {
      const [aforoActual, abordajesActivos] = await Promise.all([api.aforoViaje(viajeId), api.abordajesViaje(viajeId)]);
      setAforo(aforoActual);
      setAbordajes(abordajesActivos);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la actividad del viaje.');
    } finally {
      setCargandoActividad(false);
    }
  }

  // Los siguientes formularios guardan o actualizan los datos de líneas, micros y choferes.
  async function submitCreateLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.crearLinea({
      nombre: formText(form, 'nombre'),
      zona: formText(form, 'zona'),
      descripcion: formText(form, 'descripcion'),
      color: formText(form, 'color'),
    }), 'Línea creada.');
  }

  async function submitUpdateLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lineaEditando) return;
    const form = new FormData(event.currentTarget);
    const ok = await mutate(() => api.actualizarLinea(lineaEditando.id, {
      nombre: formText(form, 'nombre'),
      zona: formText(form, 'zona'),
      descripcion: formText(form, 'descripcion'),
      color: formText(form, 'color'),
    }), 'Línea actualizada.');
    if (ok) setLineaEditando(null);
  }

  async function submitCreateOrganizer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.crearOrganizador({
      username: formText(form, 'username'),
      password: formText(form, 'password'),
      nombreCompleto: formText(form, 'nombreCompleto'),
      correo: formText(form, 'correo').toLowerCase(),
      lineaIds: form.getAll('lineaIds').map(Number),
    }), 'Organizador creado y líneas asignadas.');
  }

  async function submitAssignOrganizerLines(event: FormEvent<HTMLFormElement>, organizador: Organizador) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.asignarLineasOrganizador(
      organizador.usuarioId, form.getAll('lineaIds').map(Number),
    ), `Líneas actualizadas para ${organizador.username}.`);
  }

  async function submitCreateMicro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.crearMicro({
      placa: formText(form, 'placa'),
      interno: formText(form, 'interno'),
      capacidad: formNumber(form, 'capacidad'),
      capacidadSentados: formNumber(form, 'capacidadSentados'),
      capacidadParadosAutorizada: optionalNumber(form, 'capacidadParadosAutorizada') ?? 0,
      capacidadOperativa: optionalNumber(form, 'capacidadOperativa'),
      estado: formText(form, 'estado') as EstadoMicro,
      lineaId: formNumber(form, 'lineaId'),
    }), 'Micro creado.');
  }

  async function submitUpdateMicro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!microEditando) return;
    const form = new FormData(event.currentTarget);
    const ok = await mutate(() => api.actualizarMicro(microEditando.id, {
      placa: formText(form, 'placa'),
      interno: formText(form, 'interno'),
      capacidad: formNumber(form, 'capacidad'),
      capacidadSentados: formNumber(form, 'capacidadSentados'),
      capacidadParadosAutorizada: optionalNumber(form, 'capacidadParadosAutorizada') ?? 0,
      capacidadOperativa: optionalNumber(form, 'capacidadOperativa'),
      estado: formText(form, 'estado') as EstadoMicro,
      lineaId: formNumber(form, 'lineaId'),
    }), 'Micro actualizado.');
    if (ok) setMicroEditando(null);
  }

  async function submitCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.crearConductor({
      nombres: formText(form, 'nombres'),
      apellidos: formText(form, 'apellidos'),
      licencia: formText(form, 'licencia'),
      username: formText(form, 'username'),
      password: formText(form, 'password'),
      correo: formText(form, 'correo').toLowerCase(),
      lineaId: formNumber(form, 'lineaId'),
    }), 'Conductor creado con una cuenta de chofer.');
  }

  async function submitUpdateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conductorEditando) return;
    const form = new FormData(event.currentTarget);
    const ok = await mutate(() => api.actualizarConductor(conductorEditando.id, {
      nombres: formText(form, 'nombres'),
      apellidos: formText(form, 'apellidos'),
      licencia: formText(form, 'licencia'),
      activo: form.get('activo') === 'true',
    }), 'Conductor actualizado.');
    if (ok) setConductorEditando(null);
  }

  // Las tarifas y las paradas se crean con los datos ingresados en sus formularios.
  async function submitCreateFare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vigenteHasta = formText(form, 'vigenteHasta');
    await mutate(() => api.crearTarifa({
      lineaId: formNumber(form, 'lineaId'),
      categoria: formText(form, 'categoria') as CategoriaTarifa,
      importe: formNumber(form, 'importe'),
      vigenteDesde: formText(form, 'vigenteDesde'),
      ...(vigenteHasta ? { vigenteHasta } : {}),
    }), 'Tarifa creada.');
  }

  async function submitCreateStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const latitud = optionalNumber(form, 'latitud');
    const longitud = optionalNumber(form, 'longitud');
    await mutate(() => api.crearParada({
      nombre: formText(form, 'nombre'),
      lineaId: formNumber(form, 'lineaId'),
      orden: formNumber(form, 'orden'),
      ...(latitud !== undefined ? { latitud } : {}),
      ...(longitud !== undefined ? { longitud } : {}),
    }), 'Parada creada y asignada a la línea.');
  }

  // Aquí se programan viajes, se registran abordajes y se cambia su estado.
  async function submitCreateTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(() => api.crearViaje({
      lineaId: formNumber(form, 'lineaId'),
      microId: formNumber(form, 'microId'),
      conductorId: formNumber(form, 'conductorId'),
    }), 'Viaje programado.');
  }

  async function submitBoarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const viajeId = formNumber(form, 'viajeId');
    const paradaSubidaId = optionalNumber(form, 'paradaSubidaId');
    const ok = await mutate(() => api.registrarAbordaje({
      codigo: formText(form, 'codigo'),
      viajeId,
      ...(paradaSubidaId !== undefined ? { paradaSubidaId } : {}),
      ...(form.get('metodoPago') === 'EFECTIVO' ? { metodoPago: 'EFECTIVO' as const } : {}),
    }), 'Abordaje registrado.');
    if (ok) await cargarActividad(viajeId);
  }

  // El trasbordo puede ser normal o de emergencia, según la opción seleccionada.
  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tipo = formText(form, 'tipo') as 'NORMAL' | 'EMERGENCIA';
    await mutate(() => api.crearTrasbordo({
      viajeOrigenId: formNumber(form, 'viajeOrigenId'),
      viajeDestinoId: formNumber(form, 'viajeDestinoId'),
      tipo,
      motivo: (tipo === 'NORMAL' ? 'FIN_TURNO' : formText(form, 'motivo')) as
        'FIN_TURNO' | 'FALLA_MECANICA' | 'EMERGENCIA_CONDUCTOR' | 'OTRA_EMERGENCIA',
      nota: formText(form, 'nota'),
      ...(tipo === 'EMERGENCIA' ? { descripcionIncidente: formText(form, 'descripcionIncidente') } : {}),
    }), 'Trasbordo creado.');
  }

  // El administrador registra si una devolución existente se confirmó o falló.
  async function resolveRefund(refund: Reembolso, formElement: HTMLFormElement, estado: 'CONFIRMADO' | 'FALLIDO') {
    const form = new FormData(formElement);
    const detalleError = formText(form, 'detalleError');
    if (estado === 'FALLIDO' && !detalleError) {
      setError('Para registrar un fallo, indica el detalle del error.');
      return;
    }
    await mutate(() => api.resolverReembolso(refund.id, {
      estado,
      referenciaProveedor: formText(form, 'referenciaProveedor'),
      ...(estado === 'FALLIDO' ? { detalleError } : {}),
    }), estado === 'CONFIRMADO' ? 'Resultado del reembolso registrado.' : 'Fallo del reembolso registrado.');
  }

  // La persona administradora decide si aprueba o rechaza cada solicitud pendiente.
  async function reviewBenefit(item: SolicitudBeneficioAdmin, estado: 'APROBADO' | 'RECHAZADO') {
    const motivoRechazo = motivos[`beneficio-${item.id}`]?.trim();
    if (estado === 'RECHAZADO' && !motivoRechazo) {
      setError('Para rechazar una solicitud, indica el motivo.');
      return;
    }
    await mutate(() => api.revisarBeneficio(item.id, {
      estado,
      ...(estado === 'RECHAZADO' && motivoRechazo ? { motivoRechazo } : {}),
    }), `Solicitud de ${item.username} ${estado === 'APROBADO' ? 'aprobada' : 'rechazada'}.`);
  }

  async function reviewStudent(item: SolicitudEstudianteAdmin, estado: 'APROBADO' | 'RECHAZADO') {
    const motivoRechazo = motivos[`estudiante-${item.id}`]?.trim();
    if (estado === 'RECHAZADO' && !motivoRechazo) {
      setError('Para rechazar una solicitud, indica el motivo.');
      return;
    }
    await mutate(() => api.revisarEstudiante(item.id, {
      estado,
      ...(estado === 'RECHAZADO' && motivoRechazo ? { motivoRechazo } : {}),
    }), `Solicitud estudiantil de ${item.username} ${estado === 'APROBADO' ? 'aprobada' : 'rechazada'}.`);
  }

  // Registra si un pasajero continúa al otro viaje o si se rechaza su trasbordo.
  async function actOnTransfer(item: Trasbordo, formElement: HTMLFormElement, action: 'continuar' | 'rechazar') {
    const form = new FormData(formElement);
    const pasajeId = formNumber(form, 'pasajeId');
    const ok = await mutate(
      () => action === 'continuar' ? api.continuarTrasbordo(item.id, pasajeId) : api.rechazarTrasbordo(item.id, pasajeId),
      action === 'continuar' ? 'Pasajero transferido al viaje de destino.' : 'Pasajero cancelado y solicitud procesada.',
    );
    if (ok && viajeSeleccionado) await cargarActividad(Number(viajeSeleccionado));
  }

  return (
    <PortalShell audience={mode === 'ADMIN' ? 'administrativo' : 'organizador'}>
      <div className="workspace">
        <nav className="workspace-nav" aria-label="Secciones de administración">
          {tabs.map((item) => <button
            aria-current={tab === item.id ? 'page' : undefined}
            className={tab === item.id ? 'workspace-nav__item is-active' : 'workspace-nav__item'}
            key={item.id}
            onClick={() => { setTab(item.id); setError(''); setMensaje(''); }}
            type="button"
          >{item.label}</button>)}
        </nav>

        <main className="workspace-main">
          <div className="workspace-heading">
            <div><Badge className="portal-eyebrow"><span className="status-dot" />CENTRO DE OPERACIONES</Badge><h1>Panel <span>{mode === 'ADMIN' ? 'administrativo' : 'organizador'}</span>.</h1><p>{mode === 'ADMIN' ? 'Gestiona el sistema y asigna líneas a sus organizadores.' : 'Gestiona las operaciones de tus líneas asignadas.'}</p></div>
            <Button className="workspace-refresh" onClick={() => setRecargar((actual) => actual + 1)} type="button" variant="ghost" disabled={cargando}><RefreshCw aria-hidden="true" />Actualizar</Button>
          </div>
          {error && <Alert>{error}</Alert>}
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {cargando && <LoadingPanel />}

          {/* Aquí se reúne el estado general de la operación. */}
          {!cargando && data && tab === 'inicio' && (
            <div className="workspace-view">
              {/* Cantidades principales de la flota, el personal y las solicitudes. */}
              <section className="workspace-stats" aria-label="Resumen administrativo">
                <Card className="workspace-stat"><span className="workspace-stat__icon"><Route aria-hidden="true" /></span><span className="workspace-stat__value">{data.lineas.length}</span><span className="workspace-stat__label">Líneas activas</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--amber"><BusFront aria-hidden="true" /></span><span className="workspace-stat__value">{data.micros.filter((micro) => micro.estado === 'ACTIVO').length}</span><span className="workspace-stat__label">Micros activos</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--green"><Activity aria-hidden="true" /></span><span className="workspace-stat__value">{viajesEnCurso.length}</span><span className="workspace-stat__label">Viajes en curso</span></Card>
              </section>
              <section className="workspace-stats">
                <Card className="workspace-stat"><span className="workspace-stat__icon"><Users aria-hidden="true" /></span><span className="workspace-stat__value">{data.conductores.filter((conductor) => conductor.activo).length}</span><span className="workspace-stat__label">Conductores activos</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--amber"><FileCheck2 aria-hidden="true" /></span><span className="workspace-stat__value">{data.beneficios.length + data.estudiantes.length}</span><span className="workspace-stat__label">Solicitudes pendientes</span></Card>
                <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--green"><Wallet aria-hidden="true" /></span><span className="workspace-stat__value">{data.reembolsos.filter((item) => ['SOLICITADO', 'EN_PROCESO'].includes(item.estado)).length}</span><span className="workspace-stat__label">Reembolsos por revisar</span></Card>
              </section>
              {/* Últimos viajes activos y solicitudes que esperan revisión. */}
              <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">OPERACIONES</Badge><h2>Viajes en curso</h2></div><Gauge aria-hidden="true" /></div>{viajesEnCurso.length ? <div className="workspace-list">{viajesEnCurso.slice(0, 5).map((viaje) => <div className="workspace-list__row" key={viaje.id}><span className="workspace-list__icon"><BusFront aria-hidden="true" /></span><span><strong>Viaje #{viaje.id} · {viaje.linea}</strong><small>Micro {viaje.interno} · {viaje.conductor}</small></span><StateBadge value={viaje.estado} /></div>)}</div> : <EmptyState icon={BusFront} title="No hay viajes activos" description="Los viajes en curso aparecerán aquí." />}</Card>
                <Card className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">VALIDACIONES</Badge><h2>Solicitudes pendientes</h2></div><ClipboardList aria-hidden="true" /></div>{data.beneficios.length + data.estudiantes.length ? <div className="workspace-list">{[...data.beneficios.map((item) => ({ key: `B-${item.id}`, label: `${item.nombreCompleto || item.username} · ${item.categoria}` })), ...data.estudiantes.map((item) => ({ key: `E-${item.id}`, label: `${item.nombreCompleto || item.username} · ${item.tipo}` }))].slice(0, 6).map((item) => <div className="workspace-list__row" key={item.key}><span className="workspace-list__icon"><FileCheck2 aria-hidden="true" /></span><span><strong>{item.label}</strong><small>En espera de revisión</small></span><StateBadge value="PENDIENTE" /></div>)}</div> : <EmptyState icon={Check} title="Sin solicitudes pendientes" description="No hay validaciones pendientes por revisar." />}</Card>
              </div>
              <Alert tone="info">El resumen se calcula desde los listados disponibles; la API no ofrece un endpoint agregado de métricas.</Alert>
            </div>
          )}

          {!cargando && data && mode === 'ADMIN' && tab === 'organizadores' && (
            <div className="workspace-view">
              <PanelHeading kicker="ASIGNACIÓN DE OPERACIONES" title="Organizadores y líneas" />
              <Field label="Buscar organizador por nombre, usuario o línea"><input className="workspace-input" value={buscarOrganizador} onChange={(event) => setBuscarOrganizador(event.target.value)} placeholder="Ej. usuario o línea roja" /></Field>
              <div className="workspace-section-heading workspace-section-heading--spaced"><div><Badge className="section-kicker">EQUIPO</Badge><h2>Organizadores activos</h2></div></div>
              {organizadoresFiltrados.length ? <div className="workspace-admin-list">{organizadoresFiltrados.map((organizador) => <article className="workspace-admin-item" key={organizador.usuarioId}>
                <div className="workspace-admin-item__head"><div><strong>{organizador.nombreCompleto || organizador.username}</strong><small>{organizador.username} · {organizador.correo || 'Sin correo'}</small></div><StateBadge value="ACTIVO" /></div>
                <form className="workspace-form" onSubmit={(event) => void submitAssignOrganizerLines(event, organizador)}>
                  <Field label="Líneas asignadas"><select className="workspace-select" name="lineaIds" multiple required defaultValue={organizador.lineas.map((linea) => String(linea.id))} size={Math.min(Math.max(data.lineas.length, 2), 6)}>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <div className="workspace-form__full"><Button type="submit" variant="ghost" disabled={busy}>Actualizar asignaciones</Button></div>
                </form>
              </article>)}</div> : data.organizadores.length ? <EmptyState icon={Users} title="Sin resultados" description="No hay organizadores que coincidan con la búsqueda." /> : <EmptyState icon={Users} title="Sin organizadores" description="Crea una cuenta y asígnale una o más líneas." />}
              <Card className="workspace-form-card"><h3>Crear organizador</h3>
                <form className="workspace-form" onSubmit={(event) => void submitCreateOrganizer(event)}>
                  <Field label="Nombre completo"><input className="workspace-input" name="nombreCompleto" required maxLength={160} /></Field>
                  <Field label="Usuario"><input className="workspace-input" name="username" required maxLength={80} /></Field>
                  <Field label="Correo electrónico"><input className="workspace-input" name="correo" type="email" required maxLength={254} autoComplete="email" /></Field>
                  <Field label="Contraseña inicial"><input className="workspace-input" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></Field>
                  <Field label="Líneas asignadas"><select className="workspace-select" name="lineaIds" multiple required size={Math.min(Math.max(data.lineas.length, 2), 6)}>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy || data.lineas.length === 0}>Crear organizador</Button></div>
                </form>
              </Card>
              <p className="workspace-note">Una persona organizadora solo puede operar líneas asignadas por administración. Usa Ctrl o Cmd para elegir varias líneas.</p>
            </div>
          )}

          {/* Aquí se crean, editan y desactivan las líneas. */}
          {!cargando && data && tab === 'lineas' && (
            <div className="workspace-view">
              <PanelHeading kicker="CATÁLOGO" title={mode === 'ADMIN' ? 'Gestión de líneas' : 'Mis líneas asignadas'} />
              <Field label="Buscar línea por nombre, zona o estado"><input className="workspace-input" value={buscarLinea} onChange={(event) => setBuscarLinea(event.target.value)} placeholder="Ej. línea roja" /></Field>
              {lineasFiltradas.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Línea</th><th>Zona</th><th>Color</th><th>Estado</th>{mode === 'ADMIN' && <th>Acciones</th>}</tr></thead><tbody>{lineasFiltradas.map((linea) => <tr key={linea.id}><td><strong>{linea.nombre}</strong></td><td>{linea.zona}</td><td><span className="workspace-color-chip" style={{ backgroundColor: linea.color }} />{linea.color}</td><td><StateBadge value={linea.activa ? 'ACTIVA' : 'INACTIVA'} /></td>{mode === 'ADMIN' && <td><div className="workspace-row-actions"><Button type="button" variant="ghost" onClick={() => setLineaEditando(linea)}>Editar</Button>{linea.activa && <Button type="button" variant="ghost" disabled={busy} onClick={() => void mutate(() => api.desactivarLinea(linea.id), 'Línea desactivada.')}>Desactivar</Button>}</div></td>}</tr>)}</tbody></table></div> : data.lineas.length ? <EmptyState icon={Route} title="Sin resultados" description="No hay líneas que coincidan con la búsqueda." /> : <EmptyState icon={Route} title="No hay líneas" description="No tienes líneas asignadas." />}
              {/* Formulario para crear una línea y, si se eligió una, editarla. */}
              {mode === 'ADMIN' && <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-form-card"><h3>Crear línea</h3><form className="workspace-form" onSubmit={(event) => void submitCreateLine(event)}>
                  <Field label="Nombre"><input className="workspace-input" name="nombre" required maxLength={100} /></Field>
                  <Field label="Zona"><input className="workspace-input" name="zona" required maxLength={80} /></Field>
                  <Field label="Color de línea"><input className="workspace-input workspace-color-input" name="color" type="color" defaultValue="#0F4C81" required /></Field>
                  <Field label="Descripción" full><textarea className="workspace-input workspace-textarea" name="descripcion" maxLength={2000} /></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy}>Crear línea</Button></div>
                </form></Card>
                {lineaEditando && <Card className="workspace-form-card"><div className="workspace-card__heading"><h3>Editar línea #{lineaEditando.id}</h3><Button variant="ghost" type="button" onClick={() => setLineaEditando(null)}>Cancelar</Button></div><form className="workspace-form" key={lineaEditando.id} onSubmit={(event) => void submitUpdateLine(event)}>
                  <Field label="Nombre"><input className="workspace-input" name="nombre" defaultValue={lineaEditando.nombre} required maxLength={100} /></Field>
                  <Field label="Zona"><input className="workspace-input" name="zona" defaultValue={lineaEditando.zona} required maxLength={80} /></Field>
                  <Field label="Color"><input className="workspace-input workspace-color-input" name="color" type="color" defaultValue={lineaEditando.color} required /></Field>
                  <Field label="Descripción" full><textarea className="workspace-input workspace-textarea" name="descripcion" defaultValue={lineaEditando.descripcion} maxLength={2000} /></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy}>Guardar cambios</Button></div>
                </form></Card>}
              </div>}
            </div>
          )}

          {/* Aquí se administra la flota de micros y su capacidad. */}
          {!cargando && data && tab === 'micros' && (
            <div className="workspace-view">
              <PanelHeading kicker="FLOTA" title="Gestión de micros" />
              <Field label="Buscar micro por interno, placa, línea o estado"><input className="workspace-input" value={buscarMicro} onChange={(event) => setBuscarMicro(event.target.value)} placeholder="Ej. 10, ABC-123 o línea roja" /></Field>
              {microsFiltrados.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Micro</th><th>Placa</th><th>Línea</th><th>Aforo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{microsFiltrados.map((micro) => <tr key={micro.id}><td><strong>{micro.interno}</strong></td><td>{micro.placa}</td><td>{data.lineas.find((linea) => Number(linea.id) === Number(micro.lineaId))?.nombre ?? `#${micro.lineaId}`}</td><td>{micro.capacidadOperativa ?? micro.capacidad} / {micro.capacidad}</td><td><StateBadge value={micro.estado} /></td><td><div className="workspace-row-actions"><Button variant="ghost" type="button" onClick={() => setMicroEditando(micro)}>Editar</Button>{micro.estado !== 'INACTIVO' && <Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.desactivarMicro(micro.id), 'Micro desactivado.')}>Desactivar</Button>}</div></td></tr>)}</tbody></table></div> : data.micros.length ? <EmptyState icon={BusFront} title="Sin resultados" description="No hay micros que coincidan con la búsqueda." /> : <EmptyState icon={BusFront} title="No hay micros" description="Registra el primer micro para empezar." />}
              {/* Formulario de alta y edición de vehículos y de su capacidad. */}
              <div className="workspace-grid workspace-grid--two">
                <Card className="workspace-form-card"><h3>Registrar micro</h3><form className="workspace-form" onSubmit={(event) => void submitCreateMicro(event)}>
                  <Field label="Placa"><input className="workspace-input" name="placa" required maxLength={20} /></Field>
                  <Field label="Número interno"><input className="workspace-input" name="interno" required maxLength={20} /></Field>
                  <Field label="Capacidad total"><input className="workspace-input" name="capacidad" type="number" min={1} max={100} step={1} required /></Field>
                  <Field label="Asientos"><input className="workspace-input" name="capacidadSentados" type="number" min={1} max={100} step={1} required /></Field>
                  <Field label="Parados autorizados"><input className="workspace-input" name="capacidadParadosAutorizada" type="number" min={0} max={100} step={1} defaultValue={0} /></Field>
                  <Field label="Capacidad operativa (opcional)"><input className="workspace-input" name="capacidadOperativa" type="number" min={1} max={100} step={1} /></Field>
                  <Field label="Línea"><select className="workspace-select" name="lineaId" required defaultValue=""><option value="" disabled>Selecciona una línea</option>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <Field label="Estado"><select className="workspace-select" name="estado" defaultValue="ACTIVO"><option value="ACTIVO">Activo</option><option value="MANTENIMIENTO">Mantenimiento</option><option value="INACTIVO">Inactivo</option></select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy || data.lineas.length === 0}>Registrar micro</Button></div>
                </form><p className="workspace-note">La capacidad total debe ser igual a asientos más parados autorizados.</p></Card>
                {microEditando && <Card className="workspace-form-card"><div className="workspace-card__heading"><h3>Editar micro #{microEditando.id}</h3><Button variant="ghost" type="button" onClick={() => setMicroEditando(null)}>Cancelar</Button></div><form className="workspace-form" key={microEditando.id} onSubmit={(event) => void submitUpdateMicro(event)}>
                  <Field label="Placa"><input className="workspace-input" name="placa" defaultValue={microEditando.placa} required maxLength={20} /></Field>
                  <Field label="Número interno"><input className="workspace-input" name="interno" defaultValue={microEditando.interno} required maxLength={20} /></Field>
                  <Field label="Capacidad total"><input className="workspace-input" name="capacidad" type="number" min={1} max={100} step={1} defaultValue={microEditando.capacidad} required /></Field>
                  <Field label="Asientos"><input className="workspace-input" name="capacidadSentados" type="number" min={1} max={100} step={1} defaultValue={microEditando.capacidadSentados ?? ''} required /></Field>
                  <Field label="Parados autorizados"><input className="workspace-input" name="capacidadParadosAutorizada" type="number" min={0} max={100} step={1} defaultValue={microEditando.capacidadParadosAutorizada} /></Field>
                  <Field label="Capacidad operativa"><input className="workspace-input" name="capacidadOperativa" type="number" min={1} max={100} step={1} defaultValue={microEditando.capacidadOperativa ?? ''} /></Field>
                  <Field label="Línea"><select className="workspace-select" name="lineaId" defaultValue={microEditando.lineaId} required>{data.lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <Field label="Estado"><select className="workspace-select" name="estado" defaultValue={microEditando.estado}><option value="ACTIVO">Activo</option><option value="MANTENIMIENTO">Mantenimiento</option><option value="INACTIVO">Inactivo</option></select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy}>Guardar cambios</Button></div>
                </form></Card>}
              </div>
            </div>
          )}

          {/* Aquí se crean las cuentas de chofer y se actualizan sus datos. */}
          {!cargando && data && tab === 'conductores' && (
            <div className="workspace-view">
              <PanelHeading kicker="PERSONAL" title={mode === 'ADMIN' ? 'Consulta de conductores' : 'Conductores de tus líneas'} />
              <Field label="Buscar conductor por nombre, usuario o licencia"><input className="workspace-input" value={buscarConductor} onChange={(event) => setBuscarConductor(event.target.value)} placeholder="Ej. Juan Pérez o licencia" /></Field>
              {conductoresFiltrados.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Conductor</th><th>Usuario</th><th>Correo</th><th>Licencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{conductoresFiltrados.map((conductor) => <tr key={conductor.id}><td><strong>{conductor.nombres} {conductor.apellidos}</strong></td><td>{conductor.username ?? 'Sin usuario vinculado'}</td><td>{conductor.correo || 'Sin correo'}</td><td>{conductor.licencia}</td><td><StateBadge value={conductor.activo ? 'ACTIVO' : 'INACTIVO'} /></td><td><div className="workspace-row-actions"><Button variant="ghost" type="button" onClick={() => setConductorEditando(conductor)}>Editar</Button>{conductor.activo && <Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.desactivarConductor(conductor.id), 'Conductor desactivado.')}>Desactivar</Button>}</div></td></tr>)}</tbody></table></div> : data.conductores.length ? <EmptyState icon={Users} title="Sin resultados" description="No hay conductores que coincidan con la búsqueda." /> : <EmptyState icon={Users} title="No hay conductores" description="Registra el primer conductor para empezar." />}
              {/* Alta de una cuenta de chofer o edición de los datos existentes. */}
              <div className="workspace-grid workspace-grid--two">
                {mode === 'ORGANIZADOR' && <Card className="workspace-form-card"><h3>Registrar conductor</h3><form className="workspace-form" onSubmit={(event) => void submitCreateDriver(event)}>
                  <Field label="Nombres"><input className="workspace-input" name="nombres" required maxLength={100} /></Field>
                  <Field label="Apellidos"><input className="workspace-input" name="apellidos" required maxLength={100} /></Field>
                  <Field label="Licencia"><input className="workspace-input" name="licencia" required maxLength={40} /></Field>
                  <Field label="Correo electrónico"><input className="workspace-input" name="correo" type="email" required maxLength={254} autoComplete="email" /></Field>
                  <Field label="Línea"><select className="workspace-select" name="lineaId" required defaultValue=""><option value="" disabled>Selecciona una línea</option>{data.lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <Field label="Usuario de acceso"><input className="workspace-input" name="username" required maxLength={80} /></Field>
                  <Field label="Contraseña inicial"><input className="workspace-input" name="password" type="password" required minLength={12} maxLength={30} autoComplete="new-password" /></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy}>Crear conductor</Button></div>
                </form><p className="workspace-note">El organizador crea la cuenta de chofer y la asocia a una de sus líneas.</p></Card>}
                {conductorEditando && <Card className="workspace-form-card"><div className="workspace-card__heading"><h3>Editar conductor #{conductorEditando.id}</h3><Button variant="ghost" type="button" onClick={() => setConductorEditando(null)}>Cancelar</Button></div><form className="workspace-form" key={conductorEditando.id} onSubmit={(event) => void submitUpdateDriver(event)}>
                  <Field label="Nombres"><input className="workspace-input" name="nombres" defaultValue={conductorEditando.nombres} required maxLength={100} /></Field>
                  <Field label="Apellidos"><input className="workspace-input" name="apellidos" defaultValue={conductorEditando.apellidos} required maxLength={100} /></Field>
                  <Field label="Licencia"><input className="workspace-input" name="licencia" defaultValue={conductorEditando.licencia} required maxLength={40} /></Field>
                  <Field label="Estado"><select className="workspace-select" name="activo" defaultValue={String(conductorEditando.activo)}><option value="true">Activo</option><option value="false">Inactivo</option></select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy}>Guardar cambios</Button></div>
                </form></Card>}
              </div>
            </div>
          )}

          {/* Aquí se publican las tarifas y se desactivan las anteriores. */}
          {!cargando && data && tab === 'tarifas' && (
            <div className="workspace-view">
              <PanelHeading kicker="PRECIOS" title="Tarifas vigentes" />
              <Field label="Buscar tarifa por línea, categoría o importe"><input className="workspace-input" value={buscarTarifa} onChange={(event) => setBuscarTarifa(event.target.value)} placeholder="Ej. línea roja, general o 3.50" /></Field>
              {tarifasFiltradas.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Línea</th><th>Categoría</th><th>Importe</th><th>Vigencia</th><th>Acciones</th></tr></thead><tbody>{tarifasFiltradas.map((tarifa) => <tr key={tarifa.id}><td><strong>{tarifa.linea}</strong></td><td>{tarifa.categoria.replaceAll('_', ' ')}</td><td>{formatAmount(tarifa.importe, tarifa.moneda)}</td><td>{formatDate(tarifa.vigenteDesde)} — {formatDate(tarifa.vigenteHasta)}</td><td><Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.desactivarTarifa(tarifa.id), 'Tarifa desactivada.')}>Desactivar</Button></td></tr>)}</tbody></table></div> : data.tarifas.length ? <EmptyState icon={CircleDollarSign} title="Sin resultados" description="No hay tarifas que coincidan con la búsqueda." /> : <EmptyState icon={CircleDollarSign} title="No hay tarifas vigentes" description="Crea una tarifa para que pueda aplicarse a nuevos pasajes." />}
              {/* Formulario para publicar el precio y sus fechas de vigencia. */}
              <Card className="workspace-form-card"><h3>Crear tarifa</h3><form className="workspace-form" onSubmit={(event) => void submitCreateFare(event)}>
                <Field label="Línea"><select className="workspace-select" name="lineaId" required defaultValue=""><option value="" disabled>Selecciona una línea</option>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                <Field label="Categoría"><select className="workspace-select" name="categoria" required defaultValue="GENERAL">{CATEGORIAS.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}</select></Field>
                <Field label="Importe"><input className="workspace-input" name="importe" type="number" min={0} max={10000} step="0.01" required /></Field>
                <Field label="Vigente desde"><input className="workspace-input" name="vigenteDesde" type="date" defaultValue={localDateString()} required /></Field>
                <Field label="Vigente hasta (opcional)"><input className="workspace-input" name="vigenteHasta" type="date" /></Field>
                <div className="workspace-form__full"><Button type="submit" disabled={busy || data.lineas.length === 0}>Crear tarifa</Button></div>
              </form><p className="workspace-note">Las tarifas con periodos superpuestos para la misma línea y categoría serán rechazadas por la API.</p></Card>
              <Alert tone="info">El backend no ofrece un endpoint para editar una tarifa. Para corregirla, desactiva la vigente y crea otra con las fechas adecuadas.</Alert>
            </div>
          )}

          {/* Aquí se agregan paradas a las líneas disponibles. */}
          {!cargando && data && tab === 'paradas' && (
            <div className="workspace-view">
              <PanelHeading kicker="RECORRIDOS" title="Gestión de paradas" />
              <Field label="Buscar parada por nombre o línea"><input className="workspace-input" value={buscarParada} onChange={(event) => setBuscarParada(event.target.value)} placeholder="Ej. plaza principal" /></Field>
              {paradasFiltradas.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Parada</th><th>Línea</th><th>Orden</th><th>Coordenadas</th><th>Acción</th></tr></thead><tbody>{paradasFiltradas.map((parada) => <tr key={parada.id}><td><strong>{parada.nombre}</strong></td><td>{data.lineas.find((linea) => Number(linea.id) === Number(parada.lineaId))?.nombre ?? 'Sin línea'}</td><td>{parada.orden ?? '—'}</td><td>{parada.latitud ?? '—'}, {parada.longitud ?? '—'}</td><td><Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.desactivarParada(parada.id), 'Parada desactivada.')}>Desactivar</Button></td></tr>)}</tbody></table></div> : data.paradas.length ? <EmptyState icon={MapPin} title="Sin resultados" description="No hay paradas que coincidan con la búsqueda." /> : <EmptyState icon={MapPin} title="No hay paradas" description="Crea y asigna una parada a una línea." />}
              {/* Datos para ubicar la parada y ordenarla dentro de una línea. */}
              <Card className="workspace-form-card"><h3>Crear parada</h3><form className="workspace-form" onSubmit={(event) => void submitCreateStop(event)}>
                <Field label="Nombre"><input className="workspace-input" name="nombre" required maxLength={120} /></Field>
                <Field label="Línea"><select className="workspace-select" name="lineaId" required defaultValue=""><option value="" disabled>Selecciona una línea</option>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                <Field label="Orden en la línea"><input className="workspace-input" name="orden" type="number" min={1} step={1} required /></Field>
                <Field label="Latitud (opcional)"><input className="workspace-input" name="latitud" type="number" min={-90} max={90} step="any" /></Field>
                <Field label="Longitud (opcional)"><input className="workspace-input" name="longitud" type="number" min={-180} max={180} step="any" /></Field>
                <div className="workspace-form__full"><Button type="submit" disabled={busy || data.lineas.length === 0}>Crear parada</Button></div>
              </form></Card>
              <Alert tone="info">El backend permite crear y desactivar paradas, pero no ofrece actualización de datos existentes.</Alert>
            </div>
          )}

          {/* Aquí se revisan las solicitudes de beneficios y de estudiantes. */}
          {!cargando && data && tab === 'solicitudes' && (
            <div className="workspace-view">
              <PanelHeading kicker="VALIDACIONES" title="Revisión de solicitudes" />
              {/* Solicitudes de beneficios generales y de categoría estudiantil. */}
              <div className="workspace-grid workspace-grid--two">
                <section className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">BENEFICIOS</Badge><h2>Beneficios tarifarios</h2></div><FileCheck2 aria-hidden="true" /></div>{data.beneficios.length ? <div className="workspace-admin-list">{data.beneficios.map((item) => <article className="workspace-admin-item" key={item.id}><div className="workspace-admin-item__head"><div><strong>{item.nombreCompleto || item.username}</strong><small>{item.username} · {item.categoria.replaceAll('_', ' ')} · {formatDate(item.creadoEn)}</small></div><StateBadge value="PENDIENTE" /></div><p>Referencia de evidencia: <code>{item.evidenciaRef || 'No indicada'}</code></p>{item.fechaNacimiento && <p>Fecha de nacimiento: {formatDate(item.fechaNacimiento)}</p>}<label className="workspace-field"><span>Motivo (obligatorio al rechazar)</span><textarea className="workspace-input workspace-textarea" value={motivos[`beneficio-${item.id}`] ?? ''} onChange={(event) => setMotivos((actual) => ({ ...actual, [`beneficio-${item.id}`]: event.target.value }))} maxLength={1000} /></label><div className="workspace-row-actions"><Button type="button" disabled={busy} onClick={() => void reviewBenefit(item, 'APROBADO')}>Aprobar</Button><Button className="button--danger" type="button" disabled={busy} onClick={() => void reviewBenefit(item, 'RECHAZADO')}>Rechazar</Button></div></article>)}</div> : <EmptyState icon={Check} title="Sin pendientes" description="No hay solicitudes tarifarias pendientes." />}</section>
                <section className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">ESTUDIANTES</Badge><h2>Validación estudiantil</h2></div><Users aria-hidden="true" /></div>{data.estudiantes.length ? <div className="workspace-admin-list">{data.estudiantes.map((item) => <article className="workspace-admin-item" key={item.id}><div className="workspace-admin-item__head"><div><strong>{item.nombreCompleto || item.username}</strong><small>{item.username} · {item.tipo.replaceAll('_', ' ')} · {formatDate(item.creadoEn)}</small></div><StateBadge value="PENDIENTE" /></div><p>{item.codigoRude ? `RUDE: ${item.codigoRude}` : `Código universitario: ${item.codigoUniversitario ?? '—'}`}</p>{item.correoInstitucional && <p>Correo institucional: <code>{item.correoInstitucional}</code></p>}<p>Referencia de evidencia: <code>{item.evidenciaRef || 'No indicada'}</code></p><label className="workspace-field"><span>Motivo (obligatorio al rechazar)</span><textarea className="workspace-input workspace-textarea" value={motivos[`estudiante-${item.id}`] ?? ''} onChange={(event) => setMotivos((actual) => ({ ...actual, [`estudiante-${item.id}`]: event.target.value }))} maxLength={1000} /></label><div className="workspace-row-actions"><Button type="button" disabled={busy} onClick={() => void reviewStudent(item, 'APROBADO')}>Aprobar</Button><Button className="button--danger" type="button" disabled={busy} onClick={() => void reviewStudent(item, 'RECHAZADO')}>Rechazar</Button></div></article>)}</div> : <EmptyState icon={Check} title="Sin pendientes" description="No hay solicitudes estudiantiles pendientes." />}</section>
              </div>
              <p className="workspace-note">La API permite revisar beneficios y solicitudes estudiantiles; la evidencia se conserva como referencia textual.</p>
            </div>
          )}

          {/* Aquí se programan viajes, se registra el abordaje y se controla el aforo. */}
          {!cargando && data && tab === 'viajes' && (
            <div className="workspace-view">
              <PanelHeading kicker="OPERACIONES" title="Viajes y abordajes" />
              <Field label="Buscar viaje por número, línea, micro, conductor o estado"><input className="workspace-input" value={buscarViaje} onChange={(event) => setBuscarViaje(event.target.value)} placeholder="Ej. línea roja o en curso" /></Field>
              {viajesFiltrados.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Viaje</th><th>Línea</th><th>Micro</th><th>Conductor</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{viajesFiltrados.map((viaje) => <tr key={viaje.id}><td><strong>#{viaje.id}</strong></td><td>{viaje.linea}</td><td>{viaje.interno} · {viaje.placa}</td><td>{viaje.conductor}</td><td><StateBadge value={viaje.estado} /></td><td><div className="workspace-row-actions">{viaje.estado === 'PROGRAMADO' && <Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.iniciarViaje(viaje.id), 'Viaje iniciado.')}>Iniciar</Button>}{['EN_CURSO', 'EMERGENCIA'].includes(viaje.estado) && <Button variant="ghost" type="button" disabled={busy} onClick={() => void mutate(() => api.finalizarViaje(viaje.id), 'Viaje finalizado.')}>Finalizar</Button>}<Button variant="ghost" type="button" onClick={() => void cargarActividad(viaje.id)}>Ver abordajes</Button></div></td></tr>)}</tbody></table></div> : data.viajes.length ? <EmptyState icon={BusFront} title="Sin resultados" description="No hay viajes que coincidan con la búsqueda." /> : <EmptyState icon={BusFront} title="No hay viajes" description="Programa el primer viaje asignando una línea, micro y conductor." />}
              {/* Asigna una línea, un micro y un conductor para programar un viaje. */}
              <Card className="workspace-form-card"><h3>Programar viaje</h3><form className="workspace-form" onSubmit={(event) => void submitCreateTrip(event)}>
                <Field label="Línea"><select className="workspace-select" name="lineaId" required value={lineaProgramada} onChange={(event) => { setLineaProgramada(event.target.value); setMicroProgramado(''); }}><option value="" disabled>Selecciona una línea</option>{data.lineas.filter((linea) => linea.activa).map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                <Field label="Micro"><select className="workspace-select" name="microId" required value={microProgramado} onChange={(event) => setMicroProgramado(event.target.value)}><option value="" disabled>Selecciona un micro</option>{microOptions.map((micro) => <option key={micro.id} value={micro.id}>{micro.interno} · {micro.placa}</option>)}</select></Field>
                <Field label="Conductor"><select className="workspace-select" name="conductorId" required defaultValue=""><option value="" disabled>Selecciona un conductor</option>{data.conductores.filter((conductor) => conductor.activo).map((conductor) => <option key={conductor.id} value={conductor.id}>{conductor.nombres} {conductor.apellidos}</option>)}</select></Field>
                <div className="workspace-form__full"><Button type="submit" disabled={busy}>Programar viaje</Button></div>
              </form></Card>
              {/* Consulta de ocupación y registro de subidas y bajadas del pasaje. */}
              <Card className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">AFORO EN VIVO</Badge><h2>{selectedTrip ? `Viaje #${selectedTrip.id}` : 'Selecciona un viaje'}</h2></div><Gauge aria-hidden="true" /></div>
                {cargandoActividad ? <div className="workspace-loading"><span className="loading-spinner" />Consultando abordajes…</div> : aforo ? <><div className="workspace-stats workspace-stats--compact"><div><strong>{aforo.ocupacion}</strong><span>Abordados</span></div><div><strong>{aforo.disponibles ?? '—'}</strong><span>Disponibles</span></div><div><strong>{aforo.capacidad ?? aforo.capacidadAutorizada}</strong><span>Capacidad</span></div></div><p className="workspace-note">El backend solo devuelve abordajes activos (pasajeros que aún no registraron descenso).</p></> : <p className="workspace-note">Selecciona “Ver abordajes” en un viaje para consultar ocupación.</p>}
                <form className="workspace-form workspace-form--compact" onSubmit={(event) => void submitBoarding(event)}>
                  <Field label="Código del pasaje"><input className="workspace-input" name="codigo" type="text" placeholder="Pega el código que muestra el pasajero" maxLength={36} autoComplete="off" spellCheck={false} required /></Field>
                  <Field label="Viaje ID"><select className="workspace-select" name="viajeId" value={viajeSeleccionado} onChange={(event) => setViajeSeleccionado(event.target.value)} required><option value="">Selecciona un viaje</option>{viajesEnCurso.map((viaje) => <option key={viaje.id} value={viaje.id}>#{viaje.id} · {viaje.linea} · {viaje.estado}</option>)}</select></Field>
                  <Field label="Parada de subida (ID opcional)"><select className="workspace-select" name="paradaSubidaId" defaultValue=""><option value="">Sin especificar</option>{(selectedTrip ? paradasDeLinea(selectedTrip.lineaId) : data.paradas).map((parada) => <option key={parada.id} value={parada.id}>{parada.nombre} · #{parada.id}</option>)}</select></Field>
                  <Field label="Estado del pago"><select className="workspace-select" name="metodoPago" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option value="PAGADO">Ya pagado o exento</option><option value="EFECTIVO">Cobrar en efectivo</option></select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={busy || viajesEnCurso.length === 0}>Registrar abordaje</Button></div>
                </form>
                {abordajes.length ? <><div className="workspace-section-heading workspace-section-heading--spaced"><div><Badge className="section-kicker">A BORDO</Badge><h2>Pasajeros activos</h2></div></div><label className="workspace-field"><span>Parada de descenso (opcional)</span><select className="workspace-select" value={paradaBajadaId} onChange={(event) => setParadaBajadaId(event.target.value)}><option value="">Sin especificar</option>{(selectedTrip ? paradasDeLinea(selectedTrip.lineaId) : data.paradas).map((parada) => <option key={parada.id} value={parada.id}>{parada.nombre} · #{parada.id}</option>)}</select></label><div className="workspace-list">{abordajes.map((abordaje) => <div className="workspace-list__row" key={abordaje.id}><span className="workspace-list__icon"><Ticket aria-hidden="true" /></span><span><strong>{abordaje.codigo ?? `Pasaje #${abordaje.pasajeId}`}</strong><small>{abordaje.categoria?.replaceAll('_', ' ') ?? 'Categoría no informada'} · Subió {formatDate(abordaje.subioEn)}</small></span><Button variant="ghost" type="button" disabled={busy} onClick={() => {
                  const id = Number(abordaje.id);
                  void mutate(() => api.registrarDescenso(id, paradaBajadaId ? { paradaBajadaId: Number(paradaBajadaId) } : {}), 'Descenso registrado.').then((ok) => {
                    if (ok && viajeSeleccionado) void cargarActividad(Number(viajeSeleccionado));
                  });
                }}>Registrar descenso</Button></div>)}</div></> : aforo && <EmptyState icon={Ticket} title="Sin pasajeros abordados" description="No hay abordajes activos registrados para este viaje." />}
              </Card>
            </div>
          )}

          {/* Aquí se organizan los trasbordos entre viajes. */}
          {!cargando && data && tab === 'trasbordos' && (
            <div className="workspace-view">
              <PanelHeading kicker="CONTINUIDAD DEL SERVICIO" title="Gestión de trasbordos" />
              {/* Formulario para conectar un viaje de origen con otro de destino. */}
              <Card className="workspace-form-card"><h3>Crear trasbordo</h3><form className="workspace-form" onSubmit={(event) => void submitTransfer(event)}>
                <Field label="Viaje de origen"><select className="workspace-select" name="viajeOrigenId" required value={viajeOrigenTrasbordo} onChange={(event) => { setViajeOrigenTrasbordo(event.target.value); setViajeDestinoTrasbordo(''); }}><option value="" disabled>Selecciona viaje activo</option>{viajesOrigenDisponibles.map((viaje) => <option key={viaje.id} value={viaje.id}>#{viaje.id} · {viaje.linea} · {viaje.estado}</option>)}</select></Field>
                <Field label="Viaje de destino"><select className="workspace-select" name="viajeDestinoId" required value={viajeDestinoTrasbordo} onChange={(event) => setViajeDestinoTrasbordo(event.target.value)}><option value="" disabled>Selecciona viaje receptor</option>{viajesDestinoDisponibles.map((viaje) => <option key={viaje.id} value={viaje.id}>#{viaje.id} · {viaje.linea} · {viaje.estado}</option>)}</select></Field>
                <Field label="Tipo"><select className="workspace-select" name="tipo" value={tipoTrasbordo} onChange={(event) => { setTipoTrasbordo(event.target.value as 'NORMAL' | 'EMERGENCIA'); setViajeOrigenTrasbordo(''); setViajeDestinoTrasbordo(''); }}><option value="NORMAL">Normal · fin de turno</option><option value="EMERGENCIA">Emergencia</option></select></Field>
                {tipoTrasbordo === 'EMERGENCIA' && <Field label="Motivo"><select className="workspace-select" name="motivo" required defaultValue=""><option value="" disabled>Selecciona un motivo</option><option value="FALLA_MECANICA">Falla mecánica</option><option value="EMERGENCIA_CONDUCTOR">Emergencia del conductor</option><option value="OTRA_EMERGENCIA">Otra emergencia</option></select></Field>}
                {tipoTrasbordo === 'EMERGENCIA' && <Field label="Descripción del incidente" full><textarea className="workspace-input workspace-textarea" name="descripcionIncidente" required maxLength={2000} /></Field>}
                <Field label="Nota (opcional)" full><textarea className="workspace-input workspace-textarea" name="nota" maxLength={2000} /></Field>
                <div className="workspace-form__full"><Button type="submit" disabled={busy || viajesEnCurso.length < 2}>Crear trasbordo</Button></div>
              </form><p className="workspace-note">Para trasbordos normales, la API exige que ambos viajes pertenezcan a la misma línea y estén activos. Las emergencias requieren explicación.</p></Card>
              {/* Historial y acciones disponibles para trasbordos todavía abiertos. */}
              {data.trasbordos.length ? <div className="workspace-admin-list">{data.trasbordos.map((item) => <article className="workspace-admin-item" key={item.id}><div className="workspace-admin-item__head"><div><strong>Trasbordo #{item.id} · Viaje {item.viajeOrigenId} → {item.viajeDestinoId}</strong><small>{item.tipo} · {item.motivo.replaceAll('_', ' ')} · {formatDate(item.creadoEn)}</small></div><StateBadge value={item.estado} /></div>{item.estado === 'ABIERTO' && <form className="workspace-transfer-action" onSubmit={(event) => event.preventDefault()}><label className="workspace-field"><span>Pasaje ID</span><input className="workspace-input" name="pasajeId" type="number" min={1} step={1} required /></label><div className="workspace-row-actions"><button className="button button--primary" type="button" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) void actOnTransfer(item, form, 'continuar'); }}>Continuar viaje</button>{item.tipo === 'EMERGENCIA' && <button className="button button--danger" type="button" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) void actOnTransfer(item, form, 'rechazar'); }}>Rechazar y procesar devolución</button>}</div></form>}</article>)}</div> : <EmptyState icon={Route} title="Sin trasbordos" description="Los trasbordos registrados aparecerán aquí." />}
            </div>
          )}

          {/* Aquí se consultan pagos y se actualizan resultados de reembolsos. */}
          {!cargando && data && tab === 'pagos' && (
            <div className="workspace-view">
              <PanelHeading kicker="FINANZAS" title="Pagos y reembolsos" />
              <Alert tone="info">No se reciben ni almacenan datos de tarjetas. La pasarela real no está configurada; desde aquí solo se consultan pagos existentes y se registra el resultado de reembolsos.</Alert>
              {/* Pagos registrados y formularios para informar el resultado del reembolso. */}
              <div className="workspace-grid workspace-grid--two">
                <section className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">REGISTROS</Badge><h2>Pagos</h2></div><CreditCard aria-hidden="true" /></div>{data.pagos.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Pago</th><th>Pasaje</th><th>Importe</th><th>Método</th><th>Estado</th></tr></thead><tbody>{data.pagos.map((pago) => <tr key={pago.id}><td><strong>#{pago.id}</strong></td><td>#{pago.pasajeId}</td><td>{formatAmount(pago.importe, pago.moneda)}</td><td>{pago.metodo}</td><td><StateBadge value={pago.estado} /></td></tr>)}</tbody></table></div> : <EmptyState icon={Wallet} title="Sin pagos" description="Los pagos existentes aparecerán aquí." />}</section>
                <section className="workspace-card"><div className="workspace-card__heading"><div><Badge className="section-kicker">DEVOLUCIONES</Badge><h2>Reembolsos</h2></div><CircleDollarSign aria-hidden="true" /></div>{data.reembolsos.length ? <div className="workspace-admin-list">{data.reembolsos.map((item) => <article className="workspace-admin-item" key={item.id}><div className="workspace-admin-item__head"><div><strong>Reembolso #{item.id} · Pasaje #{item.pasajeId}</strong><small>{formatAmount(item.importe, 'BOB')} · {item.motivo} · Solicitado {formatDate(item.solicitadoEn)}</small></div><StateBadge value={item.estado} /></div>{['SOLICITADO', 'EN_PROCESO'].includes(item.estado) && <form className="workspace-form" onSubmit={(event) => event.preventDefault()}><Field label="Referencia de proveedor"><input className="workspace-input" name="referenciaProveedor" maxLength={160} /></Field><Field label="Detalle si falla"><input className="workspace-input" name="detalleError" maxLength={2000} /></Field><div className="workspace-form__full workspace-row-actions"><button className="button button--primary" type="button" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form) void resolveRefund(item, form, 'CONFIRMADO'); }}>Confirmar resultado</button><button className="button button--danger" type="button" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form) void resolveRefund(item, form, 'FALLIDO'); }}>Registrar fallo</button></div></form>}</article>)}</div> : <EmptyState icon={CircleDollarSign} title="Sin reembolsos" description="Las solicitudes creadas por el sistema aparecerán aquí." />}</section>
              </div>
              <p className="workspace-note">El backend permite registrar el resultado de un reembolso existente, pero no expone una operación para crear la solicitud desde administración.</p>
            </div>
          )}

          {!cargando && data && mode === 'ADMIN' && tab === 'reportes' && (
            <div className="workspace-view">
              <PanelHeading kicker="FINANZAS" title="Reporte de ingresos" />
              <Card className="workspace-form-card">
                <form className="workspace-form" onSubmit={(event) => generarReporte(event)}>
                  <Field label="Desde"><input className="workspace-input" name="desde" type="date" defaultValue={filtrosReporte.desde} /></Field>
                  <Field label="Hasta"><input className="workspace-input" name="hasta" type="date" defaultValue={filtrosReporte.hasta} /></Field>
                  <Field label="Agrupar por"><select className="workspace-select" name="agrupacion" defaultValue={filtrosReporte.agrupacion}><option value="DIA">Día</option><option value="SEMANA">Semana</option><option value="MES">Mes</option></select></Field>
                  <Field label="Línea"><select className="workspace-select" name="lineaId" defaultValue={filtrosReporte.lineaId}><option value="">Todas las líneas</option>{data.lineas.map((linea) => <option key={linea.id} value={linea.id}>{linea.nombre}</option>)}</select></Field>
                  <Field label="Chofer"><select className="workspace-select" name="conductorId" defaultValue={filtrosReporte.conductorId}><option value="">Todos los choferes</option>{data.conductores.map((conductor) => <option key={conductor.id} value={conductor.id}>{conductor.nombres} {conductor.apellidos}</option>)}</select></Field>
                  <Field label="Micro"><select className="workspace-select" name="microId" defaultValue={filtrosReporte.microId}><option value="">Todos los micros</option>{data.micros.map((micro) => <option key={micro.id} value={micro.id}>Micro {micro.interno} · {micro.placa}</option>)}</select></Field>
                  <div className="workspace-form__full"><Button type="submit" disabled={cargandoReporte}><BarChart3 aria-hidden="true" />{cargandoReporte ? 'Generando reporte…' : 'Generar reporte'}</Button></div>
                </form>
                <p className="workspace-note">Se cuentan cobros confirmados y se descuentan reembolsos confirmados en su fecha de confirmación.</p>
              </Card>
              {cargandoReporte ? <LoadingPanel /> : reporte && <>
                <section className="workspace-stats" aria-label="Resumen de ingresos">
                  <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--green"><Wallet aria-hidden="true" /></span><span className="workspace-stat__value">{formatAmount(reporte.resumen.cobrado, 'BOB')}</span><span className="workspace-stat__label">Cobrado</span></Card>
                  <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--amber"><CircleDollarSign aria-hidden="true" /></span><span className="workspace-stat__value">{formatAmount(reporte.resumen.devuelto, 'BOB')}</span><span className="workspace-stat__label">Reembolsado</span></Card>
                  <Card className="workspace-stat"><span className="workspace-stat__icon"><CreditCard aria-hidden="true" /></span><span className="workspace-stat__value">{formatAmount(Number(reporte.resumen.cobrado) - Number(reporte.resumen.devuelto), 'BOB')}</span><span className="workspace-stat__label">Ingreso neto</span></Card>
                </section>
                <section className="workspace-stats" aria-label="Cantidad de operaciones">
                  <Card className="workspace-stat"><span className="workspace-stat__icon"><CreditCard aria-hidden="true" /></span><span className="workspace-stat__value">{reporte.resumen.pagos}</span><span className="workspace-stat__label">Cobros confirmados</span></Card>
                  <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--amber"><CircleDollarSign aria-hidden="true" /></span><span className="workspace-stat__value">{reporte.resumen.devoluciones}</span><span className="workspace-stat__label">Reembolsos confirmados</span></Card>
                  <Card className="workspace-stat"><span className="workspace-stat__icon workspace-stat__icon--green"><BarChart3 aria-hidden="true" /></span><span className="workspace-stat__value">{filasReporte.length}</span><span className="workspace-stat__label">Registros agrupados</span></Card>
                </section>
                <ReportTable title="Evolución por período" rows={reportePorPeriodo} period />
                <div className="workspace-grid workspace-grid--three">
                  <ReportTable title="Ingresos por línea" rows={reportePorLinea} />
                  <ReportTable title="Ingresos por chofer" rows={reportePorChofer} />
                  <ReportTable title="Ingresos por micro" rows={reportePorMicro} />
                </div>
              </>}
            </div>
          )}

          {!cargando && !data && !error && <EmptyState icon={ShieldCheck} title="No hay datos disponibles" description="Intenta actualizar el panel en unos momentos." />}
        </main>
      </div>
    </PortalShell>
  );
}
