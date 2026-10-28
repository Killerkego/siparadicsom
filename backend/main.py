"""Aranyhegy Szálló backend: a végpontok. A játék szabályai a többi modulban vannak:
config (beállítások), store (játékok, állapot), actions (mozgás, pénz), fields (mezők),
turns (kör vége, építkezés), play (dobás, döntések).

A frontend `npm run dev` parancsa magától elindítja. Külön futtatás a projekt gyökeréből:
    backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000 --reload --reload-dir backend
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

import play
from config import DEV_MODE, FIGURE_COUNT, MAX_PLAYERS, MIN_PLAYERS
from schemas import ChoiceIn, DevMoveIn, FigureIn, PlayerIn, PlayerRef
from store import (
    broadcast,
    connections,
    find_player,
    games,
    get_game,
    joined_response,
    new_game,
    new_player,
    public_state,
)
from turns import acting_player

app = FastAPI(title="Aranyhegy Szálló")


async def updated(game: dict) -> dict:
    """Mindenkinek elküldi az új állapotot, és a kérésre is ezzel válaszol."""
    await broadcast(game)
    return public_state(game)


# --- lobbi ---


@app.post("/api/games")
async def create_game(body: PlayerIn):
    player = new_player(None, body.name)
    return joined_response(new_game(player), player)


@app.post("/api/games/{code}/join")
async def join_game(code: str, body: PlayerIn):
    game = get_game(code)
    if game["status"] != "lobby":
        raise HTTPException(409, "Ez a játék már elindult.")
    if len(game["players"]) >= MAX_PLAYERS:
        raise HTTPException(409, "A játék megtelt.")
    if any(p["name"].lower() == body.name.lower() for p in game["players"]):
        raise HTTPException(409, "Ez a név már foglalt ebben a játékban.")
    player = new_player(game, body.name)
    game["players"].append(player)
    await broadcast(game)
    return joined_response(game, player)


@app.get("/api/games/{code}")
async def game_state(code: str):
    return public_state(get_game(code))


@app.post("/api/games/{code}/figure")
async def choose_figure(code: str, body: FigureIn):
    """Bábuválasztás a lobbiban; két játékosnak nem lehet ugyanaz a figurája."""
    game = get_game(code)
    if game["status"] != "lobby":
        raise HTTPException(409, "Bábut csak a játék indítása előtt lehet választani.")
    player = find_player(game, body.player_id)
    if player is None:
        raise HTTPException(404, "Nincs ilyen játékos.")
    if not 0 <= body.figure < FIGURE_COUNT:
        raise HTTPException(422, "Nincs ilyen bábu.")
    if any(p["figure"] == body.figure and p["id"] != player["id"] for p in game["players"]):
        raise HTTPException(409, "Ezt a bábut már más választotta.")
    player["figure"] = body.figure
    return await updated(game)


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
    game["turn"] = 0
    return await updated(game)


@app.post("/api/games/{code}/leave")
async def leave_game(code: str, body: PlayerRef):
    game = get_game(code)
    index = next((i for i, p in enumerate(game["players"]) if p["id"] == body.player_id), None)
    if index is None:
        return {"ok": True}
    game["players"].pop(index)
    if not game["players"]:
        del games[game["code"]]
        connections.pop(game["code"], None)
        return {"ok": True}
    if game["host_id"] == body.player_id:
        game["host_id"] = game["players"][0]["id"]  # a következő játékos lesz a házigazda
    if game["pending"] and game["pending"]["player_id"] == body.player_id:
        game["pending"] = None
    game["traps"] = {f: t for f, t in game["traps"].items() if t["owner"] != body.player_id}
    # a kör annál marad, aki eddig is következett volna
    if index < game["turn"]:
        game["turn"] -= 1
    game["turn"] %= len(game["players"])
    await broadcast(game)
    return {"ok": True}


# --- játék ---


@app.post("/api/games/{code}/roll")
async def roll_dice(code: str, body: PlayerRef):
    """A soron következő játékos dob; a szerver sorsol, lépteti a bábut és alkalmazza a mezőt."""
    game = get_game(code)
    play.roll(game, acting_player(game, body.player_id))
    return await updated(game)


@app.post("/api/games/{code}/choose")
async def choose(code: str, body: ChoiceIn):
    """Döntés a várakozó kérdésben (kártya, építkezés, gambling, felvonó, csapda)."""
    game = get_game(code)
    play.choose(game, acting_player(game, body.player_id), body.choice)
    return await updated(game)


# --- fejlesztői végpontok (csak DEV_MODE esetén) ---


def require_dev() -> None:
    if not DEV_MODE:
        raise HTTPException(403, "A fejlesztői mód ki van kapcsolva.")


@app.post("/api/games/{code}/dev/move")
async def dev_move(code: str, body: DevMoveIn):
    require_dev()
    game = get_game(code)
    play.dev_move(game, acting_player(game, body.player_id), body.field)
    return await updated(game)


@app.post("/api/games/{code}/dev/build-all")
async def dev_build_all(code: str, body: PlayerRef):
    require_dev()
    game = get_game(code)
    player = find_player(game, body.player_id)
    if player is None:
        raise HTTPException(404, "Nincs ilyen játékos.")
    play.dev_build_all(game, player)
    return await updated(game)


# --- élő kapcsolat ---


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
