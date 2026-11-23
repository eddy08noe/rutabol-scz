import { Module } from '@nestjs/common';
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesService } from './ubicaciones.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [UbicacionesController], providers: [UbicacionesService, SessionGuard, RolesGuard] })
export class UbicacionesModule {}
