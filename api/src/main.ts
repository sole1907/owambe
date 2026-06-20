import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim())
  // Extract vercel team suffixes (e.g. "soconceptspro-3887s-projects") from configured origins
  // so all preview deployments for the same team are permitted
  const vercelSuffixes = allowedOrigins
    .filter((o) => o.endsWith('.vercel.app'))
    .map((o) => o.replace(/^https?:\/\/[^.]+\./, '')) // e.g. "soconceptspro-3887s-projects.vercel.app"

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes('*')) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      // Allow any Vercel preview URL sharing the same team/project suffix
      if (origin.endsWith('.vercel.app') && vercelSuffixes.some((s) => origin.endsWith(s))) {
        return callback(null, true)
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
