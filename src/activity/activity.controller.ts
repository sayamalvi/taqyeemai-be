import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('history')
  getHistory(@Request() req: any) {
    return this.activityService.getHistory(req.user.id);
  }

  @Get('insights')
  getInsights(@Request() req: any) {
    return this.activityService.getInsights(req.user.id);
  }
}
