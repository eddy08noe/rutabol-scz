import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CATEGORIAS_TARIFA, CategoriaTarifa } from '../../common/categorias-tarifa';

export class CrearPasajeDto {
  @IsInt() @Min(1) viajeId!: number;
  @IsIn(CATEGORIAS_TARIFA) categoria!: CategoriaTarifa;
  @IsOptional() @IsInt() @Min(1) paradaOrigenId?: number;
  @IsOptional() @IsInt() @Min(1) paradaDestinoId?: number;
}
