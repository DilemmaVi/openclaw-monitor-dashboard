import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { readLastNonEmptyLines } from '../lib/tail_lines.js'

export async function registerMetricsRoutes(app: FastifyInstance) {
  const file = path.resolve(process.cwd(), '../data/metrics.jsonl')

  app.get('/api/metrics/cost/recent', async (req) => {
    const q = req.query as { limit?: string | number } | undefined
    const limitRaw = q?.limit
    const limitNum = typeof limitRaw === 'string' || typeof limitRaw === 'number' ? Number(limitRaw) : 240
    const limit = Math.min(1440, Math.max(1, Number.isFinite(limitNum) ? limitNum : 240))
    try {
      const tail = await readLastNonEmptyLines(file, limit)
      const items = tail
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
      return { ok: true, items }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      return { ok: true, items: [], note: 'no metrics yet', err }
    }
  })
}
