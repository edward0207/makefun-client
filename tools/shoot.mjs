// Takes the screenshots in shots.json from the running app, with the headless browser alone
// (Node 22's own WebSocket speaking the DevTools protocol — nothing is installed).
//
//   node serve.ts --port 8099 &
//   node tools/shoot.mjs --base http://localhost:8099
//
// Each shot waits for the app's own window.__shotReady, which the client sets to true once the
// screen's data is on the page, then settles for the images, and is saved as a JPEG under the
// bounty's cap (256 KiB, long side at most 1280). The shots are real renders of app/ on live
// make.fun data; nothing is edited afterwards.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const PORT = 9333;
const MAX_BYTES = 256 * 1024;
const READY_TIMEOUT_MS = 30_000;
const SETTLE_MS = 900;

const here = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const base = args[args.indexOf('--base') + 1] ?? 'http://localhost:8080';
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const browser = spawn(HEADLESS, [
  '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', 'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => browser.kill());

const target = await waitFor(async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return response.ok ? response.json() : null;
}, 15_000);

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id != null && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

for (const shot of shots) {
  const { width, height } = shot.viewport ?? { width: 1280, height: 800 };
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/${shot.path}` });
  await waitFor(async () => {
    const { result } = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
    return result.value === true ? true : null;
  }, READY_TIMEOUT_MS);
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

  let quality = 86;
  let data;
  do {
    ({ data } = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false }));
    quality -= 8;
  } while (Buffer.from(data, 'base64').byteLength > MAX_BYTES && quality > 30);

  const bytes = Buffer.from(data, 'base64');
  writeFileSync(join(here, 'screenshots', shot.file), bytes);
  console.log(`${shot.file}: ${shot.path} ${width}×${height}, ${bytes.byteLength} bytes`);
}

socket.close();
browser.kill();

/** Polls `attempt` until it returns something other than null, or the wait runs out. */
async function waitFor(attempt, timeoutMs) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await attempt();
      if (value != null) return value;
    } catch {
      // The browser is not up yet, or the page is mid-navigation; try again.
    }
    if (Date.now() > until) throw new Error('timed out waiting for the browser');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
