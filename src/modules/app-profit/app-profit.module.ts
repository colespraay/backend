import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppProfit } from '@entities/index';
import { AppProfitController } from './app-profit.controller';
import { AppProfitService } from './app-profit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppProfit])],
  controllers: [AppProfitController],
  providers: [AppProfitService],
  exports: [AppProfitService],
})
export class AppProfitModule {}
