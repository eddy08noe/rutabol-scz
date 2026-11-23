import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearPasajeDto } from './dto/crear-pasaje.dto';
import { PasajesService } from './pasajes.service';

@Controller('pasajes')
@ApiTags('Pasajes')
@UseGuards(SessionGuard, RolesGuard)
export class PasajesController {
  constructor(private readonly service: PasajesService) {}
  @Post() @Roles('PASAJERO') crear(@Req() req: Request, @Body() dto: CrearPasajeDto) {
    return this.service.crear(req.session.usuarioId!, dto);
  }
  @Get('mios') @Roles('PASAJERO') mios(@Req() req: Request) { return this.service.mios(req.session.usuarioId!); }
  @Get(':codigo') @Roles('PASAJERO', 'ADMIN') porCodigo(@Param('codigo') codigo: string, @Req() req: Request) {
    return this.service.porCodigo(codigo, req.session.usuarioId!, req.session.rol!);
  }
}
