import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AsignarLineasDto } from './dto/asignar-lineas.dto';
import { CrearOrganizadorDto } from './dto/crear-organizador.dto';
import { OrganizadoresService } from './organizadores.service';

@Controller('organizadores')
@ApiTags('Organizadores')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class OrganizadoresController {
  constructor(private readonly service: OrganizadoresService) {}
  @Get() listar() { return this.service.listar(); }
  @Post() crear(@Req() req: Request, @Body() dto: CrearOrganizadorDto) {
    return this.service.crear(req.session.usuarioId!, dto);
  }
  @Patch(':id/lineas') asignarLineas(
    @Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: AsignarLineasDto,
  ) { return this.service.asignarLineas(req.session.usuarioId!, id, dto.lineaIds); }
}
