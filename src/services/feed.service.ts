import { Types, type PipelineStage } from 'mongoose';
import { env } from '../config/env';
import { BookModel, type Book } from '../models';
import type { AuthUser } from '../types/auth';

export function buildFeedPipeline(user: AuthUser): PipelineStage[] {
  const libraryIds = user.libraries.map((libraryId) => new Types.ObjectId(libraryId));

  return [
    {
      $match: {
        library: { $in: libraryIds }
      }
    },
    {
      $addFields: {
        sameCountry: {
          $cond: [{ $eq: ['$authorCountry', user.country] }, 1, 0]
        },
        ageInDays: {
          $max: [
            0,
            {
              $dateDiff: {
                startDate: '$publishedDate',
                endDate: '$$NOW',
                unit: 'day'
              }
            }
          ]
        }
      }
    },
    {
      $addFields: {
        normalizedPages: {
          $divide: [{ $min: ['$pages', env.FEED_MAX_PAGES] }, env.FEED_MAX_PAGES]
        },
        normalizedAge: {
          $divide: [{ $min: ['$ageInDays', env.FEED_MAX_AGE_DAYS] }, env.FEED_MAX_AGE_DAYS]
        }
      }
    },
    {
      $addFields: {
        score: {
          $add: [{ $multiply: [0.8, '$normalizedPages'] }, { $multiply: [0.2, '$normalizedAge'] }]
        }
      }
    },
    {
      $sort: {
        sameCountry: -1,
        score: -1
      }
    },
    {
      $limit: env.FEED_LIMIT
    },
    {
      $project: {
        sameCountry: 0,
        ageInDays: 0,
        normalizedPages: 0,
        normalizedAge: 0,
        score: 0
      }
    }
  ];
}

export async function getFeed(user: AuthUser): Promise<Book[]> {
  return BookModel.aggregate<Book>(buildFeedPipeline(user)).allowDiskUse(true);
}
