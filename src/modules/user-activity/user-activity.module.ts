import { Module } from '@nestjs/common';
import { UserActivityController } from './user-activity.controller';
import { UserActivityService } from './user-activity.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActivity } from '@entities/index';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserActivity]),
  ],
  controllers: [UserActivityController],
  providers: [UserActivityService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
