import { Module } from '@nestjs/common';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesService } from './estudiantes.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [EstudiantesController], providers: [EstudiantesService, SessionGuard, RolesGuard] })
export class EstudiantesModule {}
