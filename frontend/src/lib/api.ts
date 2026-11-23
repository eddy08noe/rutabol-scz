import type {
  CategoriaBeneficio,
  CategoriaEstudiante,
  CategoriaTarifa,
  EstadoMicro,
  AforoViaje,
  Linea,
  Micro,
  MicroCercano,
  Pago,
  ReporteIngresos,
  Parada,
  Pasaje,
  Reembolso,
  RegistroPasajero,
  SolicitudBeneficio,
  SolicitudEstudiante,
  Tarifa,
  Usuario,
  Viaje,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Conserva el código de respuesta para que cada pantalla pueda explicar el error.
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Punto común de comunicación para todas las pantallas del frontend.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    // Las llamadas incluyen la sesión para que el servidor reconozca a la persona.
    response = await fetch(`${BASE}${path}`, {
      ...options,
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch {
    throw new Error('No se puede conectar con la API. Comprueba que el backend esté ejecutándose en el puerto 3001.');
  }

  // Si el servidor devuelve un error, se muestra su mensaje en la pantalla.
  if (!response.ok) {
    const body: { message?: string | string[] } | null = await response.json().catch(() => null);
    const detail = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new ApiError(detail || `Error HTTP ${response.status}`, response.status);
  }

  // Algunas acciones terminan sin contenido que mostrar.
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  if (!body.trim()) return undefined as T;
  return JSON.parse(body) as T;
}

// Aquí se conecta cada pantalla con los servicios disponibles del sistema.
export const api = {
  // Consultas generales que alimentan la portada y los selectores de viajes.
  lineas: () => request<Linea[]>('/lineas'),
  micros: () => request<Micro[]>('/micros'),
  microsCercanos: (latitud: number, longitud: number) =>
    request<MicroCercano[]>(`/micros/cercanos?lat=${encodeURIComponent(latitud)}&lng=${encodeURIComponent(longitud)}`),
  paradas: (lineaId?: number) => request<Parada[]>(`/paradas${lineaId ? `?lineaId=${lineaId}` : ''}`),
  tarifas: (lineaId?: number, categoria?: string) => {
    const params = new URLSearchParams();
    if (lineaId) params.set('lineaId', String(lineaId));
    if (categoria) params.set('categoria', categoria);
    const query = params.toString();
    return request<Tarifa[]>(`/tarifas${query ? `?${query}` : ''}`);
  },
  viajes: (lineaId?: number, estado?: string) => {
    const params = new URLSearchParams();
    if (lineaId) params.set('lineaId', String(lineaId));
    if (estado) params.set('estado', estado);
    const query = params.toString();
    return request<Viaje[]>(`/viajes${query ? `?${query}` : ''}`);
  },
  // Consultas y solicitudes personales del pasajero.
  pasajesMios: () => request<Pasaje[]>('/pasajes/mios'),
  crearPasaje: (data: { viajeId: number; categoria: CategoriaTarifa; paradaOrigenId?: number; paradaDestinoId?: number }) =>
    request<Pasaje>('/pasajes', { method: 'POST', body: JSON.stringify(data) }),
  pagos: () => request<Pago[]>('/pagos'),
  reporteIngresos: (filtros: { desde?: string; hasta?: string; agrupacion?: 'DIA' | 'SEMANA' | 'MES'; lineaId?: string; conductorId?: string; microId?: string }) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.toString();
    return request<ReporteIngresos>(`/pagos/reporte-ingresos${query ? `?${query}` : ''}`);
  },
  reembolsos: () => request<Reembolso[]>('/pagos/reembolsos'),
  beneficiosMios: () => request<SolicitudBeneficio[]>('/beneficios-tarifarios/mios'),
  solicitarBeneficio: (data: { lineaId: number; categoria: CategoriaBeneficio; evidenciaRef: string; fechaNacimiento?: string }) =>
    request<SolicitudBeneficio>('/beneficios-tarifarios', { method: 'POST', body: JSON.stringify(data) }),
  estudianteMio: () => request<SolicitudEstudiante[]>('/estudiantes/mio'),
  solicitarEstudiante: (data: {
    lineaId: number;
    tipo: CategoriaEstudiante;
    codigoRude?: string;
    codigoUniversitario?: string;
    correoInstitucional?: string;
    evidenciaRef: string;
  }) => request<SolicitudEstudiante>('/estudiantes', { method: 'POST', body: JSON.stringify(data) }),
  // Acciones administrativas para organizar líneas, micros y conductores.
  crearLinea: (data: Omit<Linea, 'id' | 'activa'>) =>
    request<Linea>('/lineas', { method: 'POST', body: JSON.stringify(data) }),
  actualizarLinea: (id: number, data: Partial<Omit<Linea, 'id'>>) =>
    request<Linea>(`/lineas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  desactivarLinea: (id: number) => request<void>(`/lineas/${id}`, { method: 'DELETE' }),
  crearMicro: (data: {
    placa: string; interno: string; capacidad: number; capacidadSentados: number;
    capacidadParadosAutorizada?: number; capacidadOperativa?: number; estado: EstadoMicro; lineaId: number;
  }) =>
    request<Micro>('/micros', { method: 'POST', body: JSON.stringify(data) }),
  actualizarMicro: (id: number, data: Partial<Pick<Micro,
    'placa' | 'interno' | 'capacidad' | 'capacidadSentados' | 'capacidadParadosAutorizada' | 'capacidadOperativa' | 'estado' | 'lineaId'
  >>) =>
    request<Micro>(`/micros/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  desactivarMicro: (id: number) => request<void>(`/micros/${id}`, { method: 'DELETE' }),
  conductores: () => request<Conductor[]>('/conductores'),
  crearConductor: (data: { nombres: string; apellidos: string; licencia: string; username?: string; password?: string; correo?: string; lineaId?: number }) =>
    request<Conductor>('/conductores', { method: 'POST', body: JSON.stringify(data) }),
  actualizarConductor: (id: number, data: Partial<Pick<Conductor, 'nombres' | 'apellidos' | 'licencia' | 'activo'>>) =>
    request<Conductor>(`/conductores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  desactivarConductor: (id: number) => request<void>(`/conductores/${id}`, { method: 'DELETE' }),
  // Alta y desactivación de paradas para los recorridos.
  crearParada: (data: { nombre: string; lineaId: number; orden: number; latitud?: number; longitud?: number }) =>
    request<Parada>('/paradas', { method: 'POST', body: JSON.stringify(data) }),
  desactivarParada: (id: number) => request<void>(`/paradas/${id}`, { method: 'DELETE' }),
  crearTarifa: (data: { lineaId: number; categoria: CategoriaTarifa; importe: number; vigenteDesde: string; vigenteHasta?: string }) =>
    request<Tarifa>('/tarifas', { method: 'POST', body: JSON.stringify(data) }),
  desactivarTarifa: (id: number) => request<void>(`/tarifas/${id}`, { method: 'DELETE' }),
  // Revisión de solicitudes para aprobarlas o rechazarlas.
  beneficiosPendientes: () => request<SolicitudBeneficioAdmin[]>('/beneficios-tarifarios/pendientes'),
  estudiantesPendientes: () => request<SolicitudEstudianteAdmin[]>('/estudiantes/pendientes'),
  organizadores: () => request<Organizador[]>('/organizadores'),
  crearOrganizador: (data: { username: string; password: string; nombreCompleto: string; correo: string; lineaIds: number[] }) =>
    request<Organizador>('/organizadores', { method: 'POST', body: JSON.stringify(data) }),
  asignarLineasOrganizador: (id: number, lineaIds: number[]) =>
    request<{ usuarioId: number; lineaIds: number[] }>(`/organizadores/${id}/lineas`, { method: 'PATCH', body: JSON.stringify({ lineaIds }) }),
  revisarBeneficio: (id: number, data: { estado: 'APROBADO' | 'RECHAZADO'; motivoRechazo?: string }) =>
    request<SolicitudBeneficio>(`/beneficios-tarifarios/${id}/revision`, { method: 'PATCH', body: JSON.stringify(data) }),
  revisarEstudiante: (id: number, data: { estado: 'APROBADO' | 'RECHAZADO'; motivoRechazo?: string }) =>
    request<SolicitudEstudiante>(`/estudiantes/${id}/revision`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Programación de viajes y registro de pasajeros que suben o bajan.
  crearViaje: (data: { lineaId: number; microId: number; conductorId: number }) =>
    request<ViajeCreado>('/viajes', { method: 'POST', body: JSON.stringify(data) }),
  aforoViaje: (id: number) => request<AforoViaje>(`/viajes/${id}/aforo`),
  iniciarViaje: (id: number) => request<{ id: number; estado: string }>(`/viajes/${id}/iniciar`, { method: 'POST' }),
  finalizarViaje: (id: number) => request<{ id: number; estado: string }>(`/viajes/${id}/finalizar`, { method: 'POST' }),
  reportarIncidente: (id: number, data: { tipo: 'FALLA_MECANICA' | 'EMERGENCIA_CONDUCTOR' | 'OTRA'; descripcion: string; latitud?: number; longitud?: number }) =>
    request<{ id: number; viajeId: number; estado: string }>(`/viajes/${id}/incidentes`, { method: 'POST', body: JSON.stringify(data) }),
  registrarUbicacion: (data: { viajeId: number; latitud: number; longitud: number }) =>
    request<{ id: number; microId: number; viajeId: number }>(`/ubicaciones`, { method: 'POST', body: JSON.stringify(data) }),
  abordajesViaje: (id: number) => request<Abordaje[]>(`/abordajes/viaje/${id}`),
  registrarAbordaje: (data: { codigo: string; viajeId: number; paradaSubidaId?: number; metodoPago?: 'EFECTIVO' }) =>
    request<{ abordajeId: string; pasajeId: number; viajeId: number }>('/abordajes', { method: 'POST', body: JSON.stringify(data) }),
  registrarDescenso: (id: number, data: { paradaBajadaId?: number }) =>
    request<Abordaje>(`/abordajes/${id}/descenso`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Traspaso de pasajeros entre viajes y actualización del resultado del reembolso.
  trasbordos: () => request<Trasbordo[]>('/trasbordos'),
  crearTrasbordo: (data: {
    viajeOrigenId: number; viajeDestinoId: number; tipo: 'NORMAL' | 'EMERGENCIA';
    motivo: 'FIN_TURNO' | 'FALLA_MECANICA' | 'EMERGENCIA_CONDUCTOR' | 'OTRA_EMERGENCIA';
    nota?: string; descripcionIncidente?: string; latitud?: number; longitud?: number;
  }) => request<Trasbordo>('/trasbordos', { method: 'POST', body: JSON.stringify(data) }),
  continuarTrasbordo: (id: number, pasajeId: number) =>
    request<unknown>(`/trasbordos/${id}/pasajes/${pasajeId}/continuar`, { method: 'POST' }),
  rechazarTrasbordo: (id: number, pasajeId: number) =>
    request<unknown>(`/trasbordos/${id}/pasajes/${pasajeId}/rechazar`, { method: 'POST' }),
  resolverReembolso: (id: number, data: { estado: 'CONFIRMADO' | 'FALLIDO'; referenciaProveedor?: string; detalleError?: string }) =>
    request<ReembolsoResultado>(`/pagos/reembolsos/${id}/resultado`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Estas opciones permiten entrar, comprobar la sesión y salir de la cuenta.
  login: (username: string, password: string) =>
    request<Usuario>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  registrarPasajero: (data: RegistroPasajero) =>
    request<Usuario>('/auth/registro', { method: 'POST', body: JSON.stringify(data) }),
  usuarioActual: () => request<Usuario>('/auth/me'),
  logout: () => request<{ mensaje: string }>('/auth/logout', { method: 'POST' }),
};

// Datos de conductores y de solicitudes que revisa el personal autorizado.
export interface Conductor {
  id: number;
  usuarioId: number | null;
  username?: string | null;
  correo?: string | null;
  nombres: string;
  apellidos: string;
  licencia: string;
  activo: boolean;
}

export interface Organizador {
  usuarioId: number;
  username: string;
  nombreCompleto: string | null;
  correo: string | null;
  lineas: Array<{ id: number; nombre: string }>;
}

export interface SolicitudBeneficioAdmin extends SolicitudBeneficio {
  usuarioId: number;
  username: string;
  nombreCompleto: string | null;
  creadoEn: string;
}

export interface SolicitudEstudianteAdmin extends SolicitudEstudiante {
  usuarioId: number;
  username: string;
  nombreCompleto: string | null;
  creadoEn: string;
}

// Actividad que ocurre durante un viaje y sus posibles trasbordos.
export interface Abordaje {
  id: number | string;
  pasajeId: number;
  viajeId: number;
  codigo?: string;
  categoria?: CategoriaTarifa;
  subioEn?: string;
  bajoEn?: string | null;
  paradaSubidaId?: number | null;
  paradaBajadaId?: number | null;
}

export interface Trasbordo {
  id: number;
  viajeOrigenId: number;
  viajeDestinoId: number;
  tipo: 'NORMAL' | 'EMERGENCIA';
  motivo: string;
  estado: string;
  creadoEn: string;
}

// Respuestas que confirman la creación de un viaje o el resultado de un reembolso.
export interface ViajeCreado {
  id: number;
  lineaId: number;
  microId: number;
  conductorId: number;
  estado: Viaje['estado'];
  creadoEn: string;
}

export interface ReembolsoResultado {
  id: number;
  pagoId: number;
  importe: number | string;
  estado: string;
  referenciaProveedor?: string | null;
  confirmadoEn?: string | null;
  detalleError?: string | null;
}
