import { Types, type FilterQuery } from 'mongoose';
import { BookModel, type Book } from '../models';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/AppError';

interface CreateBookInput {
  title: string;
  author: string;
  authorCountry: string;
  publishedDate: Date;
  pages: number;
  library: string;
}

type UpdateBookInput = Partial<CreateBookInput>;

interface ListBooksInput {
  page: number;
  limit: number;
}

interface PaginatedBooks {
  data: Book[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function assertLibraryMembership(user: AuthUser, libraryId: string): void {
  if (!user.libraries.includes(libraryId)) {
    throw new AppError('Library is not available for this user', 403);
  }
}

function libraryObjectIds(user: AuthUser): Types.ObjectId[] {
  return user.libraries.map((id) => new Types.ObjectId(id));
}

function scopedFilter(user: AuthUser, extra: FilterQuery<Book> = {}): FilterQuery<Book> {
  return {
    ...extra,
    library: { $in: libraryObjectIds(user) }
  };
}

export async function listBooks(user: AuthUser, input: ListBooksInput): Promise<PaginatedBooks> {
  const filter = scopedFilter(user);
  const skip = (input.page - 1) * input.limit;

  const [data, total] = await Promise.all([
    BookModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit),
    BookModel.countDocuments(filter)
  ]);

  return {
    data,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit)
    }
  };
}

export async function createBook(user: AuthUser, input: CreateBookInput): Promise<Book> {
  assertLibraryMembership(user, input.library);
  return BookModel.create(input);
}

export async function getBook(user: AuthUser, id: string): Promise<Book> {
  const book = await BookModel.findOne(scopedFilter(user, { _id: id }));

  if (!book) {
    throw new AppError('Book not found', 404);
  }

  return book;
}

export async function updateBook(user: AuthUser, id: string, input: UpdateBookInput): Promise<Book> {
  if (input.library !== undefined) {
    assertLibraryMembership(user, input.library);
  }

  const book = await BookModel.findOneAndUpdate(scopedFilter(user, { _id: id }), { $set: input }, {
    new: true,
    runValidators: true
  });

  if (!book) {
    throw new AppError('Book not found', 404);
  }

  return book;
}

export async function deleteBook(user: AuthUser, id: string): Promise<void> {
  const book = await BookModel.findOneAndDelete(scopedFilter(user, { _id: id }));

  if (!book) {
    throw new AppError('Book not found', 404);
  }
}
