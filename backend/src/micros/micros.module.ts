import { Module } from '@nestjs/common';
import { LineasModule } from '../lineas/lineas.module';
import { MicrosController } from './micros.controller';
import { MicrosService } from './micros.service';

@Module({
  imports: [LineasModule],
  controllers: [MicrosController],
  providers: [MicrosService],
})
export class MicrosModule {}
