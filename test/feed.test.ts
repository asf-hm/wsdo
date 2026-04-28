import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import sinon from 'sinon';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { BookModel } from '../src/models';
import { buildFeedPipeline } from '../src/services/feed.service';
import { scoreBook } from '../src/services/feedScore';
import type { AuthUser } from '../src/types/auth';

describe('Feed ranking', () => {
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

  it('gives a higher score to longer books when age is equal', () => {
    const shortBook = scoreBook(200, 1000, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });
    const longBook = scoreBook(800, 1000, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });

    assert.equal(longBook > shortBook, true);
  });

  it('gives a higher score to older books when pages are equal', () => {
    const newerBook = scoreBook(400, 1000, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });
    const olderBook = scoreBook(400, 5000, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });

    assert.equal(olderBook > newerBook, true);
  });

  it('builds the expected feed aggregation shape', () => {
    const pipeline = buildFeedPipeline(user);

    assert.deepEqual(Object.keys(pipeline[0]), ['$match']);
    assert.deepEqual(Object.keys(pipeline[1]), ['$addFields']);
    assert.deepEqual(Object.keys(pipeline[2]), ['$addFields']);
    assert.deepEqual(Object.keys(pipeline[3]), ['$addFields']);
    assert.deepEqual(Object.keys(pipeline[4]), ['$sort']);
    assert.deepEqual(Object.keys(pipeline[5]), ['$limit']);
    assert.deepEqual(Object.keys(pipeline[6]), ['$project']);
    assert.deepEqual(pipeline[4], { $sort: { sameCountry: -1, score: -1 } });
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/feed');

    assert.equal(response.status, 401);
  });

  it('returns aggregation results unchanged', async () => {
    const expectedBooks = [
      {
        _id: '507f1f77bcf86cd799439013',
        title: 'Ranked Book',
        author: 'Jane Carter',
        authorCountry: 'US',
        publishedDate: '2020-01-01T00:00:00.000Z',
        pages: 320,
        library: user.libraries[0]
      }
    ];

    const aggregateStub = sinon.stub(BookModel, 'aggregate').returns({
      allowDiskUse: sinon.stub().resolves(expectedBooks)
    } as never);

    const response = await request(app).get('/feed').set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, expectedBooks);
    assert.equal(aggregateStub.calledOnce, true);
  });
});
