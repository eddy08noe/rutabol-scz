import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LineasModule } from './lineas/lineas.module';
import { MicrosModule } from './micros/micros.module';
import { AuthModule } from './auth/auth.module';
import { EstudiantesModule } from './estudiantes/estudiantes.module';
import { ConductoresModule } from './conductores/conductores.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { ViajesModule } from './viajes/viajes.module';
import { UbicacionesModule } from './ubicaciones/ubicaciones.module';
import { PasajesModule } from './pasajes/pasajes.module';
import { PagosModule } from './pagos/pagos.module';
import { AbordajesModule } from './abordajes/abordajes.module';
import { TrasbordosModule } from './trasbordos/trasbordos.module';
import { ParadasModule } from './paradas/paradas.module';
import { BeneficiosModule } from './beneficios/beneficios.module';
import { OrganizadoresModule } from './organizadores/organizadores.module';
import { LineaPermisosModule } from './common/linea-permisos.module';

@Module({ imports: [
  DatabaseModule, LineaPermisosModule, AuthModule, LineasModule, MicrosModule,
  EstudiantesModule, ConductoresModule, TarifasModule, ViajesModule, UbicacionesModule,
  PasajesModule, PagosModule, AbordajesModule, TrasbordosModule,
  ParadasModule, BeneficiosModule, OrganizadoresModule,
] })
export class AppModule {}
