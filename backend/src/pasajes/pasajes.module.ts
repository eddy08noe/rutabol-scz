import { Module } from '@nestjs/common';
import { PasajesController } from './pasajes.controller';
import { PasajesService } from './pasajes.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [PasajesController], providers: [PasajesService, SessionGuard, RolesGuard], exports: [PasajesService] })
export class PasajesModule {}
