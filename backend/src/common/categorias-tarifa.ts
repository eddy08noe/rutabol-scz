export const CATEGORIAS_TARIFA = [
  'GENERAL',
  'MENOR_12',
  'ESCOLAR_PRIMARIA',
  'ESCOLAR_SECUNDARIA',
  'UNIVERSITARIO',
  'ADULTO_MAYOR',
  'DISCAPACIDAD',
  'BENEMERITO',
  'POLICIA_UNIFORMADO',
] as const;

export type CategoriaTarifa = (typeof CATEGORIAS_TARIFA)[number];
export const CATEGORIAS_ESTUDIANTE = ['ESCOLAR_PRIMARIA', 'ESCOLAR_SECUNDARIA', 'UNIVERSITARIO'] as const;
export type CategoriaEstudiante = (typeof CATEGORIAS_ESTUDIANTE)[number];
export const CATEGORIAS_BENEFICIO = ['MENOR_12', 'ADULTO_MAYOR', 'DISCAPACIDAD', 'BENEMERITO', 'POLICIA_UNIFORMADO'] as const;
export type CategoriaBeneficio = (typeof CATEGORIAS_BENEFICIO)[number];
