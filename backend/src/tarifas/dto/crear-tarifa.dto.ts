import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { CATEGORIAS_TARIFA, CategoriaTarifa } from '../../common/categorias-tarifa';

export class CrearTarifaDto {
  @IsInt() @Min(1) lineaId!: number;
  @IsIn(CATEGORIAS_TARIFA) categoria!: CategoriaTarifa;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000) importe!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) vigenteDesde!: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) vigenteHasta?: string;
}
