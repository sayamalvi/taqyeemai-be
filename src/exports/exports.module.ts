import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ActivityModule } from 'src/activity/activity.module';

@Module({
  imports: [PrismaModule, ActivityModule],
  providers: [ExportsService],
  exports: [ExportsService]
})
export class ExportsModule { }
