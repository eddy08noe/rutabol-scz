// Aquí se describen los datos que las pantallas reciben y envían al sistema.
// Datos principales que se consultan en la portada: líneas, micros, paradas y tarifas.
export interface Linea {
  id: number;
  nombre: string;
  zona: string;
  descripcion: string;
  color: string;
  activa: boolean;
}

// Información de los micros, paradas y tarifas que aparecen en las pantallas.
export type EstadoMicro = 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';

export interface Micro {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  capacidadSentados: number | null;
  capacidadParadosAutorizada: number;
  capacidadSugerida: number | null;
  capacidadOperativa: number | null;
  estado: EstadoMicro;
  lineaId: number;
}

export interface MicroCercano extends Micro {
  linea: string;
  latitud: number;
  longitud: number;
  distanciaKm: number;
}

export interface Parada {
  id: number;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  lineaId: number | null;
  orden: number | null;
}

export interface Tarifa {
  id: number;
  lineaId: number;
  linea: string;
  categoria: string;
  importe: number | string;
  moneda: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: boolean;
}

// Cuenta activa, rol asignado y datos necesarios para crear un cliente.
export type RolUsuario = 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO';

export interface Usuario {
  id: number;
  username: string;
  rol: RolUsuario;
  nombre_completo: string | null;
  correo: string | null;
}

// Estos son los datos que se piden al crear una cuenta de pasajero.
export interface RegistroPasajero {
  username: string;
  password: string;
  nombreCompleto: string;
  correo: string;
}

// Nombres permitidos para los precios y para las solicitudes de descuento.
export type CategoriaTarifa =
  | 'GENERAL'
  | 'MENOR_12'
  | 'ESCOLAR_PRIMARIA'
  | 'ESCOLAR_SECUNDARIA'
  | 'UNIVERSITARIO'
  | 'ADULTO_MAYOR'
  | 'DISCAPACIDAD'
  | 'BENEMERITO'
  | 'POLICIA_UNIFORMADO';

export type CategoriaEstudiante = 'ESCOLAR_PRIMARIA' | 'ESCOLAR_SECUNDARIA' | 'UNIVERSITARIO';
export type CategoriaBeneficio = 'MENOR_12' | 'ADULTO_MAYOR' | 'DISCAPACIDAD' | 'BENEMERITO' | 'POLICIA_UNIFORMADO';

// Datos de viajes, aforo y pasajes que usa el cliente y el administrador.
export interface Viaje {
  id: number;
  lineaId: number;
  linea: string;
  microId: number;
  placa: string;
  interno: string;
  conductorId: number;
  conductor: string;
  estado: 'PROGRAMADO' | 'EN_CURSO' | 'EMERGENCIA' | 'FINALIZADO';
  iniciadoEn: string | null;
  finalizadoEn: string | null;
}

// El resumen de aforo indica cuántas personas están a bordo y cuántos lugares quedan.
export interface AforoViaje {
  viajeId: number;
  estado: string;
  microId: number;
  placa: string;
  interno: string;
  capacidad: number | null;
  capacidadAutorizada: number;
  capacidadSentados: number | null;
  capacidadSugeridaSentados: number | null;
  capacidadParadosAutorizada: number;
  ocupacion: number;
  disponibles: number | null;
}

export interface Pasaje {
  id: number;
  codigo: string;
  lineaId: number;
  linea?: string;
  interno?: string;
  placa?: string;
  viajeInicialId: number;
  viajeActualId: number | null;
  categoria: CategoriaTarifa;
  importe: number | string;
  moneda: string;
  estado: string;
  creadoEn: string;
  finalizadoEn?: string | null;
  canceladoEn?: string | null;
}

// Pagos y devoluciones muestran los movimientos asociados a cada pasaje.
export interface Pago {
  id: number;
  pasajeId: number;
  proveedor: string;
  referenciaProveedor: string | null;
  importe: number | string;
  moneda: string;
  metodo: string;
  estado: string;
  creadoEn: string;
}

// Resumen de los cobros confirmados y devoluciones confirmadas que usa administración.
export interface ReporteIngresosFila {
  periodo: string;
  lineaId: number;
  linea: string;
  microId: number;
  interno: string;
  placa: string;
  conductorId: number;
  conductor: string;
  cobrado: number | string;
  devuelto: number | string;
  pagos: number;
  devoluciones: number;
}

export interface ReporteIngresos {
  desde: string | null;
  hasta: string | null;
  agrupacion: 'DIA' | 'SEMANA' | 'MES';
  resumen: { cobrado: number | string; devuelto: number | string; pagos: number; devoluciones: number };
  filas: ReporteIngresosFila[];
}

// Información de una devolución solicitada para un pago.
export interface Reembolso {
  id: number;
  pagoId: number;
  pasajeId: number;
  metodoPago: string;
  importe: number | string;
  motivo: string;
  estado: string;
  solicitadoEn: string;
  confirmadoEn: string | null;
  detalleError: string | null;
}

// Datos enviados por clientes para pedir la validación de un beneficio tarifario.
export interface SolicitudBeneficio {
  id: number;
  lineaId?: number | null;
  categoria: CategoriaTarifa;
  evidenciaRef?: string;
  fechaNacimiento?: string | null;
  estadoValidacion: string;
  revisadoEn?: string | null;
  motivoRechazo?: string | null;
}

// Datos enviados por estudiantes para pedir la validación de su tarifa.
export interface SolicitudEstudiante {
  id: number;
  lineaId?: number | null;
  tipo: CategoriaEstudiante;
  codigoRude?: string | null;
  codigoUniversitario?: string | null;
  correoInstitucional?: string | null;
  evidenciaRef?: string;
  estadoValidacion: string;
  revisadoEn?: string | null;
  motivoRechazo?: string | null;
}
