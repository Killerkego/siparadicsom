# syntax=docker/dockerfile:1
# Aranyhegy Szálló – Docker image.
# Egy konténer: a Python (FastAPI) szerver adja a játék szabályait (/api, /ws), és kiszolgálja a lefordított
# frontendet is. A játékok a memóriában vannak, ezért pontosan egy folyamat fut (újraindításkor elvesznek).
#
#   docker build -t aranyhegy .
#   docker run -d -p 8080:8080 --restart unless-stopped aranyhegy

# 1) A frontend fordítása. A fordító gép architektúráján fut (gyors), mert a kimenete (HTML/JS/CSS)
#    minden processzoron ugyanaz; így az ARM-es (arm64) image is gyorsan elkészül.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2) Futtatás: Python, a backend és a lefordított játék.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
# a tábla mezőit a backend is ebből a fájlból olvassa (config.py)
COPY frontend/src/data/board.json frontend/src/data/board.json
COPY --from=frontend /app/frontend/dist frontend/dist
# nem rendszergazdaként fut
RUN useradd --system --no-create-home aranyhegy
USER aranyhegy
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/games', timeout=2)" || exit 1
# egyetlen folyamat (--workers nélkül): a játékállapot a memóriában van, több folyamat között nem osztozna
CMD ["sh", "-c", "uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
