import { Test, TestingModule } from '@nestjs/testing';
import { AdmindashboardController } from './admindashboard.controller';
import { AdmindashboardService } from './admindashboard.service';

describe('AdmindashboardController', () => {
  let controller: AdmindashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdmindashboardController],
      providers: [AdmindashboardService],
    }).compile();

    controller = module.get<AdmindashboardController>(AdmindashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
