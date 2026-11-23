export type EstadoMicro = 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';

export interface Micro {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  capacidadSentados: number | null;
  capacidadParadosAutorizada: number;
  capacidadOperativa?: number;
  capacidadSugerida: number | null;
  estado: EstadoMicro;
  lineaId: number;
}
