import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DocumentModule } from 'src/document/document.module';
import { LlmModule } from 'src/llm/llm.module';
import { ScoringModule } from 'src/scoring/scoring.module';
import { ExportsModule } from 'src/exports/exports.module';

@Module({
  imports: [PrismaModule, DocumentModule, LlmModule, ScoringModule, ExportsModule],
  controllers: [ResumeController],
  providers: [ResumeService],
})
export class ResumeModule { }
