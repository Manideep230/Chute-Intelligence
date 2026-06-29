import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Nigha Radar Enterprise Industrial AI API is running.');
  });

  it('/mqtt-webhook (POST) - returns 400 when missing payload or topic', () => {
    return request(app.getHttpServer())
      .post('/mqtt-webhook')
      .send({ topic: 'nigha/chute/6a38c55a7fcfb7085c8786fc/radar' })
      .expect(400);
  });

  it('/mqtt-webhook (POST) - returns 401 when unauthorized', async () => {
    process.env.MQTT_WEBHOOK_SECRET = 'super-secret';
    try {
      await request(app.getHttpServer())
        .post('/mqtt-webhook')
        .set('x-webhook-secret', 'wrong-secret')
        .send({
          topic: 'nigha/chute/6a38c55a7fcfb7085c8786fc/radar',
          payload: { zone: 1, distance: 3.5 },
        })
        .expect(401);
    } finally {
      delete process.env.MQTT_WEBHOOK_SECRET;
    }
  });

  it('/mqtt-webhook (POST) - returns 201 success', () => {
    return request(app.getHttpServer())
      .post('/mqtt-webhook')
      .send({
        topic: 'nigha/chute/6a38c55a7fcfb7085c8786fc/radar',
        payload: { zone: 1, distance: 3.5 },
      })
      .expect(201)
      .expect({ success: true });
  });
});
