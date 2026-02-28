import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import { getCpuUsagePct, getDiskUsage, getMemory } from '../lib/host.js'

export async function registerHostRoutes(app: FastifyInstance) {
  app.get('/api/host/summary', async () => {
    const mem = getMemory()
    const disk = await getDiskUsage()

    return {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      hostname: os.hostname(),
      uptimeSec: process.uptime(),
      cpuUsagePctApprox: Number(getCpuUsagePct().toFixed(2)),
      mem: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        percent: Number(mem.percent.toFixed(2))
      },
      disk
    }
  })
}
