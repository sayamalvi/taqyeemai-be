import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards, Req, Request } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { FileInterceptor } from '@nestjs/platform-express'
import { AnalyzeResumeDto } from './dto/analyze-resume.dto';
import { ApplyRewritesDto } from './dto/apply-rewrites.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) { }

  @Post()
  @UseInterceptors(FileInterceptor('resume'))
  create(@Request() req, @UploadedFile() resume: Express.Multer.File, @Body() createResumeDto: CreateResumeDto) {
    return this.resumeService.create(req.user.userId, resume, createResumeDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.resumeService.findAll(req.user.userId)
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.resumeService.findOne(req.user.userId, id)
  }

  @Post(':id/rewrites')
  applyRewrites(@Request() req, @Param('id') id: string, @Body() applyRewritesDto: ApplyRewritesDto) {
    return this.resumeService.applyRewrites(req.user.userId, id, applyRewritesDto.baseVersionId, applyRewritesDto.rewrites);
  }

  @Get(':id/versions/:versionId/analysis')
  getAnalysisForVersion(@Request() req, @Param('versionId') versionId: string) {
    return this.resumeService.getAnalysisForVersion(req.user.userId, versionId)
  }

  @Post(':id/analyze')
  analyze(@Request() req, @Param('id') id: string, @Body() analyzeResumeDto: AnalyzeResumeDto) {
    return this.resumeService.analyze(req.user.userId, id, analyzeResumeDto)
  }

}
