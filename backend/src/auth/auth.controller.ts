import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
@ApiTags('Autenticación')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('registro')
  async registrar(@Body() dto: RegisterDto, @Req() req: Request) {
    const usuario = await this.auth.registrar(dto);
    await this.abrirSesion(req, usuario);
    return usuario;
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const usuario = await this.auth.validar(dto.username, dto.password);
    await this.abrirSesion(req, usuario);
    return usuario;
  }

  @Get('me')
  async me(@Req() req: Request) {
    if (!req.session.usuarioId) throw new UnauthorizedException('No existe sesión activa');
    const usuario = await this.auth.buscarPublico(req.session.usuarioId);
    if (!usuario) throw new UnauthorizedException('La cuenta está inactiva o no existe');
    return usuario;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
    res.clearCookie('micros.sid', {
      path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    });
    return { mensaje: 'Sesión finalizada' };
  }

  private async abrirSesion(
    req: Request,
    usuario: { id: number; username: string; rol: 'ADMIN' | 'ORGANIZADOR' | 'CHOFER' | 'PASAJERO' },
  ): Promise<void> {
    // Regenerar el identificador previene reutilizar una sesión anterior.
    await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.usuarioId = usuario.id;
    req.session.username = usuario.username;
    req.session.rol = usuario.rol;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  }
}
