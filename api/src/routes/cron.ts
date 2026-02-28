import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { computeFilesSignature } from '../lib/files_signature.js'

export async function registerCronRoutes(app: FastifyInstance) {
  const runsDir = path.resolve(process.cwd(), '../data/runs')

  // Cache parsed run items. Invalidation uses a lightweight signature derived from
  // the recent files list plus aggregated metadata (count + max mtime + sums).
  // This avoids repeatedly reading/parsing up to 200 JSON files when nothing changed.
  let cache: { sig: string; items: any[] } | null = null

  app.get('/api/cron/runs', async () => {
    try {
      const entries = await fs.readdir(runsDir)
      const files = entries.filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 200)

      const filePaths = files.map((f) => path.join(runsDir, f))
      const meta = await computeFilesSignature(filePaths)
      // Include filename hash to catch rename-only changes.
      const sig = `${files.length}|${hashNames(files)}|${meta.key}`

      if (cache && cache.sig === sig) {
        return { ok: true, items: cache.items }
      }

      const items = [] as any[]
      for (const f of files) {
        try {
          const txt = await fs.readFile(path.join(runsDir, f), 'utf-8')
          items.push(JSON.parse(txt))
        } catch {
          // ignore broken
        }
      }

      cache = { sig, items }
      return { ok: true, items }
    } catch (e: any) {
      return { ok: true, items: [], note: 'runs dir not found yet', err: e?.message }
    }
  })
}

function hashNames(names: string[]) {
  const h = createHash('sha1')
  for (const n of names) h.update(n).update('\n')
  return h.digest('hex').slice(0, 12)
}
