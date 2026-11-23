import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearParadaDto } from './dto/crear-parada.dto';
import { ParadasService } from './paradas.service';
import type { Request } from 'express';

@Controller('paradas')
@ApiTags('Paradas')
export class ParadasController {
  constructor(private readonly service: ParadasService) {}
  @Get() listar(@Req() req: Request, @Query('lineaId') linea?: string) { return this.service.listar(linea ? Number(linea) : undefined, req.session?.usuarioId, req.session?.rol); }
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') crear(@Body() dto: CrearParadaDto, @Req() req: Request) { return this.service.crear(dto, req.session.usuarioId!, req.session.rol!); }
  @Delete(':id') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') desactivar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.desactivar(id, req.session.usuarioId!, req.session.rol!);
  }
}
