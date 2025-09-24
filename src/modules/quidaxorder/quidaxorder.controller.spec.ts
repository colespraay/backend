import { Test, TestingModule } from '@nestjs/testing';
import { QuidaxorderController } from './quidaxorder.controller';

describe('QuidaxorderController', () => {
  let controller: QuidaxorderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuidaxorderController],
    }).compile();

    controller = module.get<QuidaxorderController>(QuidaxorderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
