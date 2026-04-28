import cors from 'cors';
import express from 'express';
import './types/express';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { authRouter } from './routes/auth.routes';
import { bookRouter } from './routes/book.routes';
import { feedRouter } from './routes/feed.routes';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(authRouter);
app.use(bookRouter);
app.use(feedRouter);

app.use(notFound);
app.use(errorHandler);
