import { Test, TestingModule } from '@nestjs/testing';
import { AdmindashboardService } from './admindashboard.service';

describe('AdmindashboardService', () => {
  let service: AdmindashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdmindashboardService],
    }).compile();

    service = module.get<AdmindashboardService>(AdmindashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
