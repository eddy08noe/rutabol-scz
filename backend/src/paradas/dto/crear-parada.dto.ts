import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearParadaDto {
  @IsString() @IsNotEmpty() @MaxLength(120) nombre!: string;
  @IsInt() @Min(1) lineaId!: number;
  @IsInt() @Min(1) orden!: number;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
}
