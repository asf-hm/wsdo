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

  const signToken = (u: AuthUser) => jwt.sign(u, env.JWT_SECRET, { algorithm: 'HS256' });
  const token = signToken(user);

  afterEach(() => {
    sinon.restore();
  });

  it('applies 80% weight to pages and 20% to age', () => {
    const eps = 1e-9;

    const pagesOnly = scoreBook(env.FEED_MAX_PAGES, 0, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });
    assert.ok(Math.abs(pagesOnly - 0.8) < eps, `expected 0.8, got ${pagesOnly}`);

    const ageOnly = scoreBook(0, env.FEED_MAX_AGE_DAYS, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });
    assert.ok(Math.abs(ageOnly - 0.2) < eps, `expected 0.2, got ${ageOnly}`);

    const full = scoreBook(env.FEED_MAX_PAGES, env.FEED_MAX_AGE_DAYS, {
      maxPages: env.FEED_MAX_PAGES,
      maxAgeDays: env.FEED_MAX_AGE_DAYS
    });
    assert.ok(Math.abs(full - 1.0) < eps, `expected 1.0, got ${full}`);
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

  it('marks books from the user country with sameCountry = 1', () => {
    const pipeline = buildFeedPipeline(user);
    const addFields = pipeline[1] as any;
    const cond = addFields.$addFields.sameCountry.$cond;

    assert.deepEqual(cond[0].$eq, ['$authorCountry', user.country]);
    assert.equal(cond[1], 1);
    assert.equal(cond[2], 0);
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
