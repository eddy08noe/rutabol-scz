import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [AuthController], providers: [AuthService, SessionGuard, RolesGuard] })
export class AuthModule {}
