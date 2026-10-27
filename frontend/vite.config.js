import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

// `npm run dev` a Python backendet is elindítja (backend/.venv), ha még nem fut
function pythonBackend() {
  return {
    name: 'siparadicsom-backend',
    apply: 'serve',
    async configureServer(server) {
      if (globalThis.siparadicsomBackend || (await portInUse(BACKEND_PORT))) return;
      const python = [`${BACKEND_DIR}/.venv/Scripts/python.exe`, `${BACKEND_DIR}/.venv/bin/python`].find(existsSync);
      if (!python) {
        server.config.logger.warn(
          '\n[backend] Nincs backend/.venv, a lobbi nem fog működni. Telepítés a projekt gyökeréből:\n' +
            '  python -m venv backend/.venv\n' +
            '  backend/.venv/Scripts/python -m pip install -r backend/requirements.txt\n',
        );
        return;
      }
      const child = spawn(python, ['-m', 'uvicorn', 'main:app', '--port', String(BACKEND_PORT), '--reload'], {
        cwd: BACKEND_DIR,
        stdio: 'inherit',
      });
      globalThis.siparadicsomBackend = child;
      child.once('exit', () => (globalThis.siparadicsomBackend = null));
      process.once('exit', () => killTree(child));
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
