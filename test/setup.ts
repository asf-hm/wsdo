process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/book-management-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';
process.env.NODE_ENV = 'test';
