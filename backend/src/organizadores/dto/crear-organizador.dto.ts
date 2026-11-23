import { ArrayMinSize, IsArray, IsEmail, IsInt, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearOrganizadorDto {
  @IsString() @IsNotEmpty() @MaxLength(80) username!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) nombreCompleto!: string;
  @IsEmail() @MaxLength(254) correo!: string;
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) lineaIds!: number[];
}
