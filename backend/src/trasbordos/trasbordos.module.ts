import { Module } from '@nestjs/common';
import { TrasbordosController } from './trasbordos.controller';
import { TrasbordosService } from './trasbordos.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [TrasbordosController], providers: [TrasbordosService, SessionGuard, RolesGuard] })
export class TrasbordosModule {}
