import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function registerOpenClawRoutes(app: FastifyInstance) {
  app.get('/api/openclaw/gateway', async () => {
    // best-effort: rely on openclaw CLI if available
    try {
      const { stdout } = await execFileAsync('openclaw', ['gateway', 'status'], {
        timeout: 5000,
        maxBuffer: 1024 * 1024
      })
      return { ok: true, stdout: stdout.trim() }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) }
    }
  })
}
