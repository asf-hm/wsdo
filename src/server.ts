import { app } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { seedData } from './seed/seedData';

async function startServer(): Promise<void> {
  await connectDatabase();
  await seedData();

  app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
