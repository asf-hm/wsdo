import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import sinon from 'sinon';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { BookModel } from '../src/models';
import type { AuthUser } from '../src/types/auth';

describe('Books API', () => {
  const user: AuthUser = {
    id: '507f1f77bcf86cd799439011',
    username: 'alice',
    country: 'US',
    libraries: ['507f1f77bcf86cd799439012'],
    role: 'user'
  };

  const token = jwt.sign(user, env.JWT_SECRET);

  afterEach(() => {
    sinon.restore();
  });

  it('creates a book in one of the user libraries', async () => {
    const body = {
      title: 'Clean API Design',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: '2020-01-01',
      pages: 320,
      library: user.libraries[0]
    };

    const createStub = sinon.stub(BookModel, 'create').resolves({
      _id: '507f1f77bcf86cd799439013',
      ...body
    } as never);

    const response = await request(app).post('/books').set('Authorization', `Bearer ${token}`).send(body);

    assert.equal(response.status, 201);
    assert.equal(response.body.title, body.title);
    assert.equal(createStub.calledOnce, true);
  });

  it('rejects invalid book input', async () => {
    const response = await request(app).post('/books').set('Authorization', `Bearer ${token}`).send({
      title: '',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: '2020-01-01',
      pages: 0,
      library: user.libraries[0]
    });

    assert.equal(response.status, 400);
  });

  it('rejects creating a book in a library outside user membership', async () => {
    const response = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Clean API Design',
        author: 'Jane Carter',
        authorCountry: 'US',
        publishedDate: '2020-01-01',
        pages: 320,
        library: '507f1f77bcf86cd799439099'
      });

    assert.equal(response.status, 403);
  });

  it('requires authentication for book routes', async () => {
    const response = await request(app).get('/books');

    assert.equal(response.status, 401);
  });

  it('applies default pagination when listing books', async () => {
    const findChain = {
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().resolves([])
    };

    sinon.stub(BookModel, 'find').returns(findChain as never);
    sinon.stub(BookModel, 'countDocuments').resolves(0);

    const response = await request(app).get('/books').set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.pagination.page, 1);
    assert.equal(response.body.pagination.limit, env.BOOKS_DEFAULT_LIMIT);
    assert.equal(findChain.skip.calledWith(0), true);
    assert.equal(findChain.limit.calledWith(env.BOOKS_DEFAULT_LIMIT), true);
  });

  it('clamps list limit to the configured maximum', async () => {
    const findChain = {
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().resolves([])
    };

    sinon.stub(BookModel, 'find').returns(findChain as never);
    sinon.stub(BookModel, 'countDocuments').resolves(0);

    const response = await request(app).get('/books?limit=9999').set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.pagination.limit, env.BOOKS_MAX_LIMIT);
    assert.equal(findChain.limit.calledWith(env.BOOKS_MAX_LIMIT), true);
  });

  it('returns 404 when a book is outside the user libraries', async () => {
    const findOneStub = sinon.stub(BookModel, 'findOne').resolves(null);

    const response = await request(app)
      .get('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 404);
    assert.equal(findOneStub.calledOnce, true);
    const filter = findOneStub.firstCall.args[0] as any;
    assert.equal(filter._id, '507f1f77bcf86cd799439013');
    assert.deepEqual(
      filter.library.$in.map((id: Types.ObjectId) => id.toString()),
      user.libraries
    );
  });
});
