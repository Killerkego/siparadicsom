import { spawn, spawnSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_PORT = 8000;
const BACKEND_DIR = fileURLToPath(new URL('../backend', import.meta.url));

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill();
}

// A Vite újraindulásakor (pl. a config mentésekor) is megmaradó állapot
const state = (globalThis.siparadicsomBackend ??= { child: null, watcher: null });

function startBackend(python) {
  const child = spawn(python, ['-m', 'uvicorn', 'main:app', '--port', String(BACKEND_PORT)], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
  });
  state.child = child;
  child.once('exit', () => {
    if (state.child === child) state.child = null;
  });
}

// A .py fájlok mentésekor újraindítjuk a backendet. Az uvicorn saját --reload-ja Windows-on
// Ctrl+C jellel indítja újra magát, ami a közös konzolban a Vite-ot és a backendet is leállítja.
function watchBackend(python) {
  if (state.watcher) return;
  let timer;
  state.watcher = watch(BACKEND_DIR, (_, file) => {
    if (!file?.endsWith('.py')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const old = state.child;
      if (!old) return startBackend(python);
      old.once('exit', () => startBackend(python));
      killTree(old);
    }, 200);
  });
  process.once('exit', () => state.child && killTree(state.child));
}

// `npm run dev` a Python backendet is elindítja (backend/.venv), ha még nem fut
function pythonBackend() {
  return {
    name: 'siparadicsom-backend',
    apply: 'serve',
    async configureServer(server) {
      if (state.child || (await portInUse(BACKEND_PORT))) return;
      const python = [`${BACKEND_DIR}/.venv/Scripts/python.exe`, `${BACKEND_DIR}/.venv/bin/python`].find(existsSync);
      if (!python) {
        server.config.logger.warn(
          '\n[backend] Nincs backend/.venv, a lobbi nem fog működni. Telepítés a projekt gyökeréből:\n' +
            '  python -m venv backend/.venv\n' +
            '  backend/.venv/Scripts/python -m pip install -r backend/requirements.txt\n',
        );
        return;
      }
      startBackend(python);
      watchBackend(python);
    },
  };
}

export default defineConfig({
  plugins: [react(), pythonBackend()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${BACKEND_PORT}`,
      '/ws': { target: `ws://127.0.0.1:${BACKEND_PORT}`, ws: true },
    },
  },
});
