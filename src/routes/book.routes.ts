import { Router } from 'express';
import {
  createBookController,
  deleteBookController,
  getBookController,
  listBooksController,
  updateBookController
} from '../controllers/book.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { bookIdSchema, createBookSchema, listBooksSchema, updateBookSchema } from '../validators/book.validator';

export const bookRouter = Router();

bookRouter.use(requireAuth);
bookRouter.get('/books', validate(listBooksSchema), asyncHandler(listBooksController));
bookRouter.post('/books', validate(createBookSchema), asyncHandler(createBookController));
bookRouter.get('/books/:id', validate(bookIdSchema), asyncHandler(getBookController));
bookRouter.put('/books/:id', validate(updateBookSchema), asyncHandler(updateBookController));
bookRouter.delete('/books/:id', validate(bookIdSchema), asyncHandler(deleteBookController));
