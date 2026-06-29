import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: () =>
              'Nigha Radar Enterprise Industrial AI API is running.',
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return running message', () => {
      expect(appController.getHello()).toBe(
        'Nigha Radar Enterprise Industrial AI API is running.',
      );
    });
  });
});
