import type { Request, Response } from 'express';
import * as bookService from '../services/book.service';
import { AppError } from '../utils/AppError';

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  return req.user;
}

function requireId(req: Request): string {
  const { id } = req.params;

  if (typeof id !== 'string') {
    throw new AppError('Invalid book id', 400);
  }

  return id;
}

export async function listBooksController(req: Request, res: Response): Promise<void> {
  const result = await bookService.listBooks(requireUser(req), req.query as unknown as { page: number; limit: number });
  res.status(200).json(result);
}

export async function createBookController(req: Request, res: Response): Promise<void> {
  const book = await bookService.createBook(requireUser(req), req.body);
  res.status(201).json(book);
}

export async function getBookController(req: Request, res: Response): Promise<void> {
  const book = await bookService.getBook(requireUser(req), requireId(req));
  res.status(200).json(book);
}

export async function updateBookController(req: Request, res: Response): Promise<void> {
  const book = await bookService.updateBook(requireUser(req), requireId(req), req.body);
  res.status(200).json(book);
}

export async function deleteBookController(req: Request, res: Response): Promise<void> {
  await bookService.deleteBook(requireUser(req), requireId(req));
  res.status(204).send();
}
