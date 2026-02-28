import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { computeFilesSignature } from '../lib/files_signature.js'

function groupByJob(items: any[]) {
  const map = new Map<string, any[]>()
  for (const it of items) {
    const job = String(it?.job ?? 'unknown')
    if (!map.has(job)) map.set(job, [])
    map.get(job)!.push(it)
  }
  return map
}

export async function registerCronStatsRoutes(app: FastifyInstance) {
  const runsDir = path.resolve(process.cwd(), '../data/runs')

  // Cache computed stats. Invalidation uses a signature built from the selected
  // recent file list (up to 500) plus aggregated per-file metadata.
  let cache: { sig: string; stats: any[] } | null = null

  app.get('/api/cron/stats', async () => {
    let items: any[] = []
    let sig: string | null = null
    try {
      const entries = await fs.readdir(runsDir)
      const files = entries.filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 500)

      const filePaths = files.map((f) => path.join(runsDir, f))
      const meta = await computeFilesSignature(filePaths)
      // Include a stable hash of the selected filenames so pure renames don't go unnoticed
      // when mtimes/sizes remain the same.
      sig = `${files.length}|${hashNames(files)}|${meta.key}`

      if (cache && cache.sig === sig) {
        return { ok: true, stats: cache.stats }
      }

      for (const f of files) {
        try {
          const txt = await fs.readFile(path.join(runsDir, f), 'utf-8')
          items.push(JSON.parse(txt))
        } catch {
          // ignore
        }
      }
    } catch {
      items = []
    }

    const byJob = groupByJob(items)

    const stats = [] as any[]
    for (const [job, arr] of byJob.entries()) {
      const recent7 = arr.slice(0, 7)
      const ok7 = recent7.filter((x) => x.ok).length
      const last = arr[0]
      stats.push({
        job,
        last_ts: last?.ts ?? null,
        last_ok: !!last?.ok,
        last_artifact_size: typeof last?.artifact_size === 'number' ? last.artifact_size : null,
        recent7_ok: ok7,
        recent7_total: recent7.length
      })
    }

    stats.sort((a, b) => String(a.job).localeCompare(String(b.job)))

    if (sig) cache = { sig, stats }

    return { ok: true, stats }
  })
}

function hashNames(names: string[]) {
  const h = createHash('sha1')
  for (const n of names) h.update(n).update('\n')
  return h.digest('hex').slice(0, 12)
}
