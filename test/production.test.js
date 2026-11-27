import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const html = '<!doctype html><div id="root"></div><script type="module" src="/assets/app.js"></script>'
const bundle = 'document.getElementById("root").textContent = "Football Manager"'

async function start(t, { built = false, production = false } = {}) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'ufm-production-'))
  await writeFile(path.join(cwd, 'package.json'), await readFile(path.join(root, 'package.json')))
  await symlink(path.join(root, 'server'), path.join(cwd, 'server'), 'dir')
  if (built) {
    await mkdir(path.join(cwd, 'dist/assets'), { recursive: true })
    await writeFile(path.join(cwd, 'dist/index.html'), html)
    await writeFile(path.join(cwd, 'dist/assets/app.js'), bundle)
  }

  const socket = net.createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))

  const env = { ...process.env, PORT: String(port), DATA_DIR: path.join(cwd, 'data') }
  delete env.NODE_ENV
  if (production) env.NODE_ENV = 'production'
  const child = spawn('npm', ['start', '--silent'], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  let timer
  const outcome = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Server did not start or exit:\n${logs}`)), 20000)
    child.once('error', reject)
    child.once('exit', (code) => resolve({ kind: 'exit', code }))
    child.stdout.on('data', (chunk) => {
      logs += chunk
      if (logs.includes('ULTIMATE FOOTBALL MANAGER listening')) resolve({ kind: 'listening' })
    })
    child.stderr.on('data', (chunk) => { logs += chunk })
  })

  t.after(async () => {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      process.kill(-child.pid, 'SIGKILL')
      await exited
    }
    await rm(cwd, { recursive: true, force: true })
  })

  const result = await outcome
  clearTimeout(timer)
  return { result, logs: () => logs, url: `http://127.0.0.1:${port}` }
}

test('production refuses to report ready without a frontend build', async (t) => {
  const app = await start(t, { production: true })
  assert.equal(app.result.kind, 'exit', app.logs())
  assert.notEqual(app.result.code, 0)
  assert.match(app.logs(), /npm run build/)
})

test('npm start serves the built frontend and API without requiring NODE_ENV from the host', async (t) => {
  const app = await start(t, { built: true })
  assert.equal(app.result.kind, 'listening', app.logs())

  for (const route of ['/', '/transfers', '/competitions']) {
    const res = await fetch(`${app.url}${route}`)
    assert.equal(res.status, 200, route)
    assert.match(res.headers.get('content-type'), /text\/html/)
    assert.equal(await res.text(), html, route)
  }

  const script = await fetch(`${app.url}/assets/app.js`)
  assert.equal(script.status, 200)
  assert.match(script.headers.get('content-type'), /javascript/)
  assert.equal(await script.text(), bundle)

  const health = await fetch(`${app.url}/api/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ok, true)
})
