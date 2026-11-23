import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearConductorDto } from './dto/crear-conductor.dto';
import { ActualizarConductorDto } from './dto/actualizar-conductor.dto';
import { ConductoresService } from './conductores.service';
import type { Request } from 'express';

@Controller('conductores')
@ApiTags('Conductores')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN', 'ORGANIZADOR')
export class ConductoresController {
  constructor(private readonly service: ConductoresService) {}
  @Get() listar(@Req() req: Request) { return this.service.listar(req.session.usuarioId!, req.session.rol!); }
  @Get(':id') buscar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.buscar(id, req.session.usuarioId!, req.session.rol!); }
  @Post() @Roles('ORGANIZADOR') crear(@Req() req: Request, @Body() dto: CrearConductorDto) { return this.service.crear(dto, req.session.usuarioId!, req.session.rol!); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: ActualizarConductorDto) { return this.service.actualizar(id, dto, req.session.usuarioId!, req.session.rol!); }
  @Delete(':id') desactivar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.desactivar(id, req.session.usuarioId!, req.session.rol!); }
}
