import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class RegistrarAbordajeDto {
  @IsUUID() codigo!: string;
  @IsInt({ message: 'El viaje seleccionado no es válido' })
  @Min(1, { message: 'El viaje seleccionado no es válido' })
  viajeId!: number;
  @IsOptional() @IsInt() @Min(1) paradaSubidaId?: number;
  @IsOptional() @IsIn(['EFECTIVO']) metodoPago?: 'EFECTIVO';
}
