import { UserActivity } from '@entities/index';
import { Injectable } from '@nestjs/common';
import { GenericService } from '@schematics/index';

@Injectable()
export class UserActivityService extends GenericService(UserActivity) {

    async logUserActivity(userId: string, activityType: string, details?: string): Promise<UserActivity> {
        const activity = new UserActivity();
        activity.userId = userId;
        activity.activityType = activityType;
        activity.details = details;
    
        return await this.create(activity);
    }

    async getUserActivities(userId: string, page: number = 1, limit: number = 10): Promise<{ activities: UserActivity[]; totalActivities: number }> {
        const skip = (page - 1) * limit;
    
        const [activities, totalActivities] = await this.getRepo().findAndCount({
          where: { userId },
          skip,
          take: limit,
          order: { timestamp: 'DESC' }, // Assuming createdAt field exists in UserActivity entity
        });
    
        return { activities, totalActivities };
      }
}
