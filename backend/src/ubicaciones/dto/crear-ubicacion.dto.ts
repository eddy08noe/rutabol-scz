import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CrearUbicacionDto {
  @IsInt() @Min(1) viajeId!: number;
  @IsNumber() @Min(-90) @Max(90) latitud!: number;
  @IsNumber() @Min(-180) @Max(180) longitud!: number;
}
