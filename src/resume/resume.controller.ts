import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { FileInterceptor } from '@nestjs/platform-express'
import { AnalyzeResumeDto } from './dto/analyze-resume.dto';
import { ApplyRewritesDto } from './dto/apply-rewrites.dto';

@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) { }

  @Post()
  @UseInterceptors(FileInterceptor('resume'))
  create(@UploadedFile() resume: Express.Multer.File, @Body() createResumeDto: CreateResumeDto) {
    return this.resumeService.create(resume, createResumeDto);
  }


  @Get()
  findAll() {
    return this.resumeService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resumeService.findOne(id)
  }

  @Post(':id/rewrites')
  applyRewrites(@Param('id') id: string, @Body() applyRewritesDto: ApplyRewritesDto) {
    return this.resumeService.applyRewrites(id, applyRewritesDto.baseVersionId, applyRewritesDto.rewrites);
  }

  @Get(':id/versions/:versionId/analysis')
  getAnalysisForVersion(@Param('versionId') versionId: string) {
    return this.resumeService.getAnalysisForVersion(versionId)
  }

  @Post(':id/analyze')
  analyze(@Param('id') id: string, @Body() analyzeResumeDto: AnalyzeResumeDto) {
    return this.resumeService.analyze(id, analyzeResumeDto)
  }

}
