import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('ReportsController (e2e)', () => {
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
    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: '+919999999999', otp: '123456' });
    authToken = loginRes.body.accessToken;

    // Create a mock plant and chute first to link the report to
    const plantRes = await request(app.getHttpServer())
      .post('/industry/plants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Reports Test Plant',
        location: 'Nevada',
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    const chuteRes = await request(app.getHttpServer())
      .post('/industry/chutes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Reports Chute Link',
        plantId: plantRes.body._id,
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    createdChuteId = chuteRes.body._id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Report Download Operations', () => {
    it('should download report in JSON format by default', () => {
      return request(app.getHttpServer())
        .get(`/reports/${createdChuteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect((res) => {
          expect(res.body).toHaveProperty('chute');
          expect(res.body).toHaveProperty('summary');
          expect(res.body).toHaveProperty('generatedAt');
          expect(res.body.chute.name).toBe('Reports Chute Link');
        });
    });

    it('should download report in CSV format when specified', () => {
      return request(app.getHttpServer())
        .get(`/reports/${createdChuteId}?format=csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /text\/csv/)
        .expect((res) => {
          expect(res.text).toContain('Nigha Radar - Operational Report');
          expect(res.text).toContain('Chute: Reports Chute Link');
        });
    });
  });
});
