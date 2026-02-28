import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'

const execFileAsync = promisify(execFile)

export async function registerCostRoutes(app: FastifyInstance) {
  app.get('/api/cost/codez', async () => {
    // 注意：脚本位于 workspace/scripts 下；这里从 api/ 目录回到 workspace
    const script = path.resolve(process.cwd(), '../../../../scripts/codez_fetch_metrics_api.py')
    const python = path.resolve(process.cwd(), '../.venv/bin/python3')

    const env = { ...process.env, CODEZ_OUTPUT_JSON: '1' }

    const { stdout, stderr } = await execFileAsync(python, [script], {
      env,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024
    })

    const data = safeJson(stdout)

    // best-effort append metrics jsonl (for trends)
    try {
      if (data && typeof data === 'object' && 'today' in data) {
        const metricsFile = path.resolve(process.cwd(), '../data/metrics.jsonl')
        const rec = {
          ts: new Date().toISOString(),
          type: 'codez_cost',
          data
        }
        await fs.appendFile(metricsFile, JSON.stringify(rec) + '\n', 'utf-8')
      }
    } catch {
      // ignore
    }

    return {
      ok: true,
      data,
      stderr: stderr?.trim() ? stderr.trim() : undefined
    }
  })
}

function safeJson(s: string) {
  const t = (s ?? '').trim()
  try {
    return JSON.parse(t)
  } catch {
    return { raw: t }
  }
}
