import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearTrasbordoDto } from './dto/crear-trasbordo.dto';
import { TrasbordosService } from './trasbordos.service';

@Controller('trasbordos')
@ApiTags('Trasbordos')
@UseGuards(SessionGuard, RolesGuard)
export class TrasbordosController {
  constructor(private readonly service: TrasbordosService) {}
  @Get() @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER', 'PASAJERO') listar(@Req() req: Request) {
    return this.service.listar(req.session.rol!, req.session.usuarioId!);
  }
  @Post() @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') crear(@Req() req: Request, @Body() dto: CrearTrasbordoDto) {
    return this.service.crear(req.session.usuarioId!, req.session.rol!, dto);
  }
  @Post(':id/pasajes/:pasajeId/continuar') @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER', 'PASAJERO') continuar(
    @Param('id', ParseIntPipe) id: number, @Param('pasajeId', ParseIntPipe) pasajeId: number, @Req() req: Request,
  ) { return this.service.continuar(id, pasajeId, req.session.usuarioId!, req.session.rol!); }
  @Post(':id/pasajes/:pasajeId/rechazar') @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER', 'PASAJERO') rechazar(
    @Param('id', ParseIntPipe) id: number, @Param('pasajeId', ParseIntPipe) pasajeId: number, @Req() req: Request,
  ) { return this.service.rechazar(id, pasajeId, req.session.usuarioId!, req.session.rol!); }
}
