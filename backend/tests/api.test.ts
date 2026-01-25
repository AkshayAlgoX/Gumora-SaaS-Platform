import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import type { Express } from 'express';

/**
 * Unit tests for API endpoints
 * Note: These tests don't require database connection
 * They test middleware, routing, and request validation
 */

describe('Health & Root Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should return OK on /healthz', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('should return API info on root path', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Gumora API');
    expect(response.body.status).toBe('running');
    expect(response.body.endpoints).toBeDefined();
  });
});

describe('Auth Middleware', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should return 401 on protected route without auth', async () => {
    const response = await request(app).get('/api/library');
    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('should return 401 on /me without cookie', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('should return 401 on creator routes without auth', async () => {
    const response = await request(app).get('/api/creator/products');
    expect(response.status).toBe(401);
  });

  it('should return 401 on sales route without auth', async () => {
    const response = await request(app).get('/api/creator/sales');
    expect(response.status).toBe(401);
  });
});

describe('Request Validation', () => {
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

  it('should reject login with missing password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });
    
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('should reject checkout without auth', async () => {
    const response = await request(app)
      .post('/api/checkout/create-session')
      .send({ productId: '507f1f77bcf86cd799439011' });
    
    expect(response.status).toBe(401);
  });
});

describe('Security Headers', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should include security headers from Helmet', async () => {
    const response = await request(app).get('/healthz');
    
    // Helmet adds these security headers
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include CORS headers for allowed origins', async () => {
    const response = await request(app)
      .get('/healthz')
      .set('Origin', 'https://gumora.shop');
    
    expect(response.headers['access-control-allow-origin']).toBe('https://gumora.shop');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should reject CORS for disallowed origins', async () => {
    const response = await request(app)
      .get('/healthz')
      .set('Origin', 'https://evil-site.com');
    
    // Should not have the evil origin in CORS header
    expect(response.headers['access-control-allow-origin']).not.toBe('https://evil-site.com');
  });
});

describe('Rate Limiting Setup', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('should have rate limit headers on /api routes', async () => {
    // Rate limiter only applies to /api/* routes
    const response = await request(app).get('/api/auth/me');
    // Rate limiter adds these headers
    expect(response.headers).toHaveProperty('ratelimit-limit');
    expect(response.headers).toHaveProperty('ratelimit-remaining');
  });
});
