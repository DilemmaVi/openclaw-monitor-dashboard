import fs from 'node:fs/promises'

type TailLinesOptions = {
  chunkSize?: number
  maxBytes?: number
}

function countNewlines(buf: Buffer) {
  let n = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) n++
  }
  return n
}

export async function readLastNonEmptyLines(filePath: string, limit: number, opts: TailLinesOptions = {}) {
  const chunkSize = opts.chunkSize ?? 64 * 1024
  const maxBytes = opts.maxBytes ?? Number.POSITIVE_INFINITY

  const st = await fs.stat(filePath)
  const size = Number(st.size)
  if (!Number.isFinite(size) || size <= 0) return [] as string[]

  const fh = await fs.open(filePath, 'r')
  try {
    let pos = size
    let bytesReadTotal = 0
    let nl = 0
    const chunks: Buffer[] = []

    while (pos > 0 && nl < limit + 1 && bytesReadTotal < maxBytes) {
      const readSize = Math.min(chunkSize, pos)
      pos -= readSize
      bytesReadTotal += readSize

      const buf = Buffer.allocUnsafe(readSize)
      const r = await fh.read(buf, 0, readSize, pos)
      const used = r.bytesRead === buf.length ? buf : buf.subarray(0, r.bytesRead)
      nl += countNewlines(used)
      chunks.push(used)
    }

    const combined = Buffer.concat(chunks.reverse())
    const txt = combined.toString('utf-8')
    const parts = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (pos > 0 && parts.length > 0) {
      const prev = Buffer.allocUnsafe(1)
      const r = await fh.read(prev, 0, 1, pos - 1)
      const prevByte = r.bytesRead === 1 ? prev[0] : null
      if (prevByte !== 0x0a) parts.shift()
    }

    return parts.slice(-limit)
  } finally {
    await fh.close()
  }
}
