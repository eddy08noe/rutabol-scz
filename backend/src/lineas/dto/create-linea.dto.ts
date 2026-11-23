import { IsHexColor, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLineaDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  zona!: string;

  @IsString() @MaxLength(2000)
  descripcion!: string;

  @IsHexColor()
  color!: string;
}
