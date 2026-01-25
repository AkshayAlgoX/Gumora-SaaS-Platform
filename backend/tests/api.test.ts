import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

describe('API Health Check', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should return OK on /healthz', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('should return 401 on protected route without auth', async () => {
    const response = await request(app).get('/api/library');
    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('should return products list on public route', async () => {
    const response = await request(app).get('/api/products');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.products)).toBe(true);
  });
});

describe('Auth Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should reject login with missing credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('should reject register with invalid email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'invalid-email',
        password: '123456',
      });
    
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('should return 401 on /me without cookie', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });
});

describe('Product Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should return 404 for non-existent product slug', async () => {
    const response = await request(app).get('/api/products/non-existent-slug-12345');
    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
  });

  it('should reject checkout without auth', async () => {
    const response = await request(app)
      .post('/api/checkout/create-session')
      .send({ productId: '507f1f77bcf86cd799439011' });
    
    expect(response.status).toBe(401);
  });
});

describe('Rate Limiting', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should have rate limit headers', async () => {
    const response = await request(app).get('/api/products');
    expect(response.headers).toHaveProperty('ratelimit-limit');
    expect(response.headers).toHaveProperty('ratelimit-remaining');
  });
});
