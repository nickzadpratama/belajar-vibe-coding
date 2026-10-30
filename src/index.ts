import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { usersRoutes } from './routes/users-route';

const port = Number(process.env.PORT ?? 3000);

const app = new Elysia()
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'Belajar Vibe Coding API',
          version: '1.0.0',
          description:
            'Dokumentasi API untuk manajemen user dan autentikasi sesi menggunakan Bun, Elysia, dan Drizzle ORM.',
        },
        tags: [
          { name: 'System', description: 'Endpoint utilitas sistem dan health check' },
          { name: 'Users', description: 'Operasi manajemen user dan autentikasi' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'UUID',
              description: 'Masukkan token sesi yang didapat dari endpoint login',
            },
          },
        },
      },
    }),
  )
  .get(
    '/health',
    () => ({
      status: 'ok',
      database: 'postgresql',
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        tags: ['System'],
        summary: 'Health Check',
        description: 'Mengecek status ketersediaan server dan database',
        responses: {
          200: {
            description: 'Server dan database dalam kondisi normal',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    database: { type: 'string', example: 'postgresql' },
                    timestamp: { type: 'string', example: '2026-10-30T15:00:00.000Z' },
                  },
                  required: ['status', 'database', 'timestamp'],
                },
                example: {
                  status: 'ok',
                  database: 'postgresql',
                  timestamp: '2026-10-30T15:00:00.000Z',
                },
              },
            },
          },
        },
      },
    },
  )
  .use(usersRoutes)
  .listen(port);

console.log(`🦊 Elysia berjalan di http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger UI dapat diakses di http://${app.server?.hostname}:${app.server?.port}/swagger`);
