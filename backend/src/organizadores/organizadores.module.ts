import { Module } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';
import { OrganizadoresController } from './organizadores.controller';
import { OrganizadoresService } from './organizadores.service';

@Module({ controllers: [OrganizadoresController], providers: [OrganizadoresService, SessionGuard, RolesGuard] })
export class OrganizadoresModule {}
