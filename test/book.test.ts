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

  const signToken = (u: AuthUser) => jwt.sign(u, env.JWT_SECRET, { algorithm: 'HS256' });
  const token = signToken(user);

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
    const createStub = sinon.stub(BookModel, 'create');

    const response = await request(app).post('/books').set('Authorization', `Bearer ${token}`).send({
      title: '',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: '2020-01-01',
      pages: 0,
      library: user.libraries[0]
    });

    assert.equal(response.status, 400);
    sinon.assert.notCalled(createStub);
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

  it('returns a book by id', async () => {
    const book = {
      _id: '507f1f77bcf86cd799439013',
      title: 'Clean API Design',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: '2020-01-01T00:00:00.000Z',
      pages: 320,
      library: user.libraries[0]
    };

    sinon.stub(BookModel, 'findOne').resolves(book as never);

    const response = await request(app)
      .get('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.title, book.title);
  });

  it('returns 400 for an invalid book id', async () => {
    const findOneStub = sinon.stub(BookModel, 'findOne');

    const response = await request(app)
      .get('/books/not-an-objectid')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 400);
    sinon.assert.notCalled(findOneStub);
  });

  it('updates a book and returns the updated document', async () => {
    const updated = {
      _id: '507f1f77bcf86cd799439013',
      title: 'Updated Title',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: '2020-01-01T00:00:00.000Z',
      pages: 400,
      library: user.libraries[0]
    };

    sinon.stub(BookModel, 'findOneAndUpdate').resolves(updated as never);

    const response = await request(app)
      .put('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title', pages: 400 });

    assert.equal(response.status, 200);
    assert.equal(response.body.title, 'Updated Title');
    assert.equal(response.body.pages, 400);
  });

  it('returns 404 when updating a book not in user libraries', async () => {
    sinon.stub(BookModel, 'findOneAndUpdate').resolves(null);

    const response = await request(app)
      .put('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    assert.equal(response.status, 404);
  });

  it('returns 400 when update body is empty', async () => {
    const updateStub = sinon.stub(BookModel, 'findOneAndUpdate');

    const response = await request(app)
      .put('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.equal(response.status, 400);
    sinon.assert.notCalled(updateStub);
  });

  it('returns 403 when updating a book to a library outside user membership', async () => {
    const response = await request(app)
      .put('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`)
      .send({ library: '507f1f77bcf86cd799439099' });

    assert.equal(response.status, 403);
  });

  it('deletes a book and returns 204', async () => {
    sinon.stub(BookModel, 'findOneAndDelete').resolves({ _id: '507f1f77bcf86cd799439013' } as never);

    const response = await request(app)
      .delete('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 204);
  });

  it('returns 404 when deleting a book not in user libraries', async () => {
    sinon.stub(BookModel, 'findOneAndDelete').resolves(null);

    const response = await request(app)
      .delete('/books/507f1f77bcf86cd799439013')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 404);
  });
});
