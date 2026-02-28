import Fastify from 'fastify'
import { registerCostRoutes } from './routes/cost.js'
import { registerHostRoutes } from './routes/host.js'
import { registerCronRoutes } from './routes/cron.js'
import { registerCronStatsRoutes } from './routes/cron_stats.js'
import { registerMetricsRoutes } from './routes/metrics.js'
import { registerProcessRoutes } from './routes/processes.js'
import { registerOpenClawRoutes } from './routes/opencode.js'
import { registerRuntimeRoutes } from './routes/runtime.js'

const server = Fastify({ logger: true })

server.get('/api/health', async () => {
  return { ok: true, ts: Date.now() }
})

// routes
await registerHostRoutes(server)
await registerProcessRoutes(server)
await registerOpenClawRoutes(server)
await registerRuntimeRoutes(server)
await registerCostRoutes(server)
await registerCronRoutes(server)
await registerCronStatsRoutes(server)
await registerMetricsRoutes(server)

const port = Number(process.env.PORT || 4318)
const host = process.env.HOST || '127.0.0.1'

server.listen({ port, host }).catch((err) => {
  server.log.error(err)
  process.exit(1)
})
