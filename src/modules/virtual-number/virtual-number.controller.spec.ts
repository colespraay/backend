import { Test, TestingModule } from '@nestjs/testing';
import { VirtualNumberController } from './virtual-number.controller';

describe('VirtualNumberController', () => {
  let controller: VirtualNumberController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VirtualNumberController],
    }).compile();

    controller = module.get<VirtualNumberController>(VirtualNumberController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
