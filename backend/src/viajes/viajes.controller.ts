import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearViajeDto } from './dto/crear-viaje.dto';
import { CrearIncidenteDto } from './dto/crear-incidente.dto';
import { ViajesService } from './viajes.service';

@Controller('viajes')
@ApiTags('Viajes e incidentes')
export class ViajesController {
  constructor(private readonly service: ViajesService) {}
  @Get() listar(@Req() req: Request, @Query('lineaId') linea?: string, @Query('estado') estado?: string) {
    return this.service.listar(linea ? Number(linea) : undefined, estado, req.session?.usuarioId, req.session?.rol);
  }
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') crear(@Body() dto: CrearViajeDto, @Req() req: Request) { return this.service.crear(dto, req.session.usuarioId!, req.session.rol!); }
  @Post(':id/iniciar') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') iniciar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.iniciar(id, req.session.usuarioId!, req.session.rol!);
  }
  @Post(':id/finalizar') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') finalizar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.finalizar(id, req.session.usuarioId!, req.session.rol!);
  }
  @Post(':id/incidentes') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') reportar(
    @Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: CrearIncidenteDto,
  ) { return this.service.reportarIncidente(id, req.session.usuarioId!, req.session.rol!, dto); }
  @Get(':id/aforo') aforo(@Param('id', ParseIntPipe) id: number) { return this.service.aforo(id); }
}
