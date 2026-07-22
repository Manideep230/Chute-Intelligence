import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AiController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdChuteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Authenticate
    await request(app.getHttpServer())
      .post('/auth/request-otp')
      .send({ phone: '9391888104' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: '9391888104', otp: '939188' });
    authToken = loginRes.body.accessToken;

    // Create a mock plant and chute to link predictions to
    const plantRes = await request(app.getHttpServer())
      .post('/industry/plants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'AI Test Plant',
        location: 'Nevada',
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    const chuteRes = await request(app.getHttpServer())
      .post('/industry/chutes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Chute AI Link',
        plantId: plantRes.body._id,
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    createdChuteId = chuteRes.body._id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Component Predictions & RUL', () => {
    it('should retrieve predictions and Remaining Useful Lives (RUL) for components', () => {
      return request(app.getHttpServer())
        .get(`/ai/predictions/${createdChuteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('chuteId');
          expect(res.body).toHaveProperty('overallBlockageProbability');
          expect(res.body).toHaveProperty('recommendedActions');
          expect(Array.isArray(res.body.recommendedActions)).toBe(true);
        });
    });
  });

  describe('AI Copilot Chat SSE Streaming', () => {
    it('should successfully initiate chat streaming (Server Sent Events)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chuteId: createdChuteId,
          message: 'How is the compressor pressure doing?',
          history: [],
        })
        .expect(201)
        .expect('Content-Type', /text\/event-stream/);

      expect(res.text).toContain('data:');
    }, 20000); // 20 seconds timeout
  });
});
