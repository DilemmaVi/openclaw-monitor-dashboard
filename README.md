# OpenClaw Monitor Dashboard

Local-only monitoring dashboard for an OpenClaw setup.

## Dev

Install deps:

```bash
pnpm i
```

Start both API + Web (turborepo):

```bash
pnpm dev
```

Or restart dev processes (graceful → force):

```bash
./scripts/restart.sh
```

## Ports

- Web (Vite): `http://127.0.0.1:5175`
- API: `http://127.0.0.1:4318`

## `scripts/restart.sh`

`restart.sh` tries to avoid destructive kills by default:

1. Send `SIGTERM` to dev processes scoped to this repo (best-effort)
2. Wait ~2s
3. If any of those PIDs are still alive, escalate to `SIGKILL` (`kill -9`) **only for the remaining PIDs**

This reduces operator confusion and avoids unnecessarily killing unrelated processes.
