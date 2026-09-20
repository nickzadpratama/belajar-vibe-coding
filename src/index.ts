import { Elysia } from 'elysia';
import { usersRoutes } from './routes/users-route';

const port = Number(process.env.PORT ?? 3000);

const app = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    database: 'postgresql',
    timestamp: new Date().toISOString(),
  }))
  .use(usersRoutes)
  .listen(port);

console.log(`🦊 Elysia berjalan di http://${app.server?.hostname}:${app.server?.port}`);
