import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserActivityService } from './user-activity.service';

@ApiTags('user-activity')
@Controller('user-activity')
export class UserActivityController {
  constructor(private readonly UseracSRV: UserActivityService) {}

  //getUserActivities
  @Get('/:userId')
  @ApiOperation({ summary: 'Get user activities with pagination' })
  @ApiResponse({ status: 200, description: 'Returns user activities and total count' })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  async getUserActivities(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<any> {
    return await this.UseracSRV.getUserActivities(userId, page, limit);
  }

}
