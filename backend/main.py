"""Síparadicsom backend: játék létrehozása kóddal, csatlakozás, lobbi és a játék indítása.

Futtatás a projekt gyökeréből:
    backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000 --reload --reload-dir backend
"""

import secrets
import uuid
from typing import Annotated

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, StringConstraints

MIN_PLAYERS = 2
MAX_PLAYERS = 6
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # nincs benne 0/O és 1/I, hogy ne lehessen összekeverni
CODE_LENGTH = 6

app = FastAPI(title="Síparadicsom")

# A játékok a memóriában vannak, a szerver újraindításakor elvesznek.
games: dict[str, dict] = {}
connections: dict[str, set[WebSocket]] = {}

PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class PlayerIn(BaseModel):
    name: PlayerName


class PlayerRef(BaseModel):
    player_id: str


def new_code() -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if code not in games:
            return code


def get_game(code: str) -> dict:
    game = games.get(code.upper())
    if game is None:
        raise HTTPException(404, "Nincs ilyen kódú játék.")
    return game


def public_state(game: dict) -> dict:
    return {
        "code": game["code"],
        "status": game["status"],  # "lobby" vagy "playing"
        "host_id": game["host_id"],
        "players": game["players"],
        "min_players": MIN_PLAYERS,
        "max_players": MAX_PLAYERS,
    }


async def broadcast(game: dict) -> None:
    """Minden csatlakozott böngészőnek elküldi a játék új állapotát."""
    sockets = connections.get(game["code"], set())
    state = public_state(game)
    for ws in list(sockets):
        try:
            await ws.send_json(state)
        except Exception:
            sockets.discard(ws)


def joined_response(game: dict, player: dict) -> dict:
    return {"player_id": player["id"], "game": public_state(game)}


@app.post("/api/games")
async def create_game(body: PlayerIn):
    code = new_code()
    player = {"id": uuid.uuid4().hex, "name": body.name}
    games[code] = {"code": code, "status": "lobby", "host_id": player["id"], "players": [player]}
    return joined_response(games[code], player)


@app.post("/api/games/{code}/join")
async def join_game(code: str, body: PlayerIn):
    game = get_game(code)
    if game["status"] != "lobby":
        raise HTTPException(409, "Ez a játék már elindult.")
    if len(game["players"]) >= MAX_PLAYERS:
        raise HTTPException(409, "A játék megtelt.")
    if any(p["name"].lower() == body.name.lower() for p in game["players"]):
        raise HTTPException(409, "Ez a név már foglalt ebben a játékban.")
    player = {"id": uuid.uuid4().hex, "name": body.name}
    game["players"].append(player)
    await broadcast(game)
    return joined_response(game, player)


@app.get("/api/games/{code}")
async def game_state(code: str):
    return public_state(get_game(code))


@app.post("/api/games/{code}/start")
async def start_game(code: str, body: PlayerRef):
    game = get_game(code)
    if body.player_id != game["host_id"]:
        raise HTTPException(403, "Csak a házigazda indíthatja el a játékot.")
    if game["status"] != "lobby":
        raise HTTPException(409, "A játék már elindult.")
    if len(game["players"]) < MIN_PLAYERS:
        raise HTTPException(409, f"Legalább {MIN_PLAYERS} játékos kell az indításhoz.")
    game["status"] = "playing"
    await broadcast(game)
    return public_state(game)


@app.post("/api/games/{code}/leave")
async def leave_game(code: str, body: PlayerRef):
    game = get_game(code)
    game["players"] = [p for p in game["players"] if p["id"] != body.player_id]
    if not game["players"]:
        del games[game["code"]]
        connections.pop(game["code"], None)
        return {"ok": True}
    if game["host_id"] == body.player_id:
        game["host_id"] = game["players"][0]["id"]  # a következő játékos lesz a házigazda
    await broadcast(game)
    return {"ok": True}


@app.websocket("/ws/games/{code}")
async def game_socket(ws: WebSocket, code: str, player_id: str):
    await ws.accept()
    game = games.get(code.upper())
    if game is None or all(p["id"] != player_id for p in game["players"]):
        await ws.close(code=4404)  # a kliens ebből tudja, hogy a játék vagy a játékos már nem létezik
        return
    sockets = connections.setdefault(game["code"], set())
    sockets.add(ws)
    await ws.send_json(public_state(game))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        sockets.discard(ws)
