import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import sinon from 'sinon';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { UserModel } from '../src/models';

describe('Auth API', () => {
  const userId = '507f1f77bcf86cd799439011';
  const libraryId = '507f1f77bcf86cd799439012';

  afterEach(() => {
    sinon.restore();
  });

  it('returns a JWT for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const selectStub = sinon.stub().resolves({
      _id: { toString: () => userId },
      username: 'alice',
      password: passwordHash,
      country: 'US',
      libraries: [{ toString: () => libraryId }],
      role: 'user'
    });

    sinon.stub(UserModel, 'findOne').returns({ select: selectStub } as never);

    const response = await request(app).post('/login').send({
      username: 'alice',
      password: 'password123'
    });

    assert.equal(response.status, 200);
    assert.equal(typeof response.body.token, 'string');
    assert.equal(response.body.user.username, 'alice');

    const decoded = jwt.verify(response.body.token, env.JWT_SECRET) as jwt.JwtPayload;

    assert.equal(decoded.username, 'alice');
    assert.deepEqual(decoded.libraries, [libraryId]);
  });

  it('returns 401 for a wrong password', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const selectStub = sinon.stub().resolves({
      _id: { toString: () => userId },
      username: 'alice',
      password: passwordHash,
      country: 'US',
      libraries: [{ toString: () => libraryId }],
      role: 'user'
    });

    sinon.stub(UserModel, 'findOne').returns({ select: selectStub } as never);

    const response = await request(app).post('/login').send({
      username: 'alice',
      password: 'wrong-password'
    });

    assert.equal(response.status, 401);
  });
});
