"""Aranyhegy Szálló backend: a végpontok. A játék szabályai a többi modulban vannak:
config (beállítások), store (játékok, állapot), actions (mozgás, pénz), fields (mezők),
turns (kör vége, építkezés), play (dobás, döntések), bots (gépi játékosok).

A frontend `npm run dev` parancsa magától elindítja. Külön futtatás a projekt gyökeréből:
    backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000 --reload --reload-dir backend
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

import bots
import play
import seasons
from actions import add_log
from config import DEV_MODE, FIGURE_COUNT, MAX_PLAYERS, MIN_PLAYERS
from schemas import ChoiceIn, CreateIn, DevMoveIn, DevSeasonIn, FigureIn, PlayerIn, PlayerRef, VisibilityIn
from store import (
    broadcast,
    connections,
    find_player,
    games,
    get_game,
    joined_response,
    new_game,
    new_player,
    public_lobbies,
    public_state,
)
from turns import acting_player

app = FastAPI(title="Aranyhegy Szálló")


async def updated(game: dict) -> dict:
    """Mindenkinek elküldi az új állapotot, és a kérésre is ezzel válaszol. Ha gépi játékos következik,
    elindítja a lépéseit."""
    await broadcast(game)
    bots.kick(game)
    return public_state(game)


def host_in_lobby(game: dict, player_id: str) -> None:
    """Csak a házigazda, és csak a játék indítása előtt (gépi játékosok hozzáadása, eltávolítása)."""
    if player_id != game["host_id"]:
        raise HTTPException(403, "Csak a házigazda teheti meg.")
    if game["status"] != "lobby":
        raise HTTPException(409, "A játék már elindult.")


# --- lobbi ---


@app.get("/api/games")
async def list_games():
    """A nyilvános, még várakozó lobbik a lobbik oldalára; a privátak nem szerepelnek benne."""
    return {"lobbies": public_lobbies()}


@app.post("/api/games")
async def create_game(body: CreateIn):
    player = new_player(None, body.name)
    return joined_response(new_game(player, body.public), player)


@app.post("/api/games/{code}/visibility")
async def set_visibility(code: str, body: VisibilityIn):
    """A házigazda a lobbiban átállíthatja: nyilvános vagy privát."""
    game = get_game(code)
    if body.player_id != game["host_id"]:
        raise HTTPException(403, "Csak a házigazda állíthatja át.")
    if game["status"] != "lobby":
        raise HTTPException(409, "A játék már elindult.")
    game["public"] = body.public
    return await updated(game)


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


@app.post("/api/games/{code}/bots")
async def add_bot(code: str, body: PlayerRef):
    """A házigazda gépi játékost ad a lobbihoz; ugyanúgy játszik, mint a többiek."""
    game = get_game(code)
    host_in_lobby(game, body.player_id)
    if len(game["players"]) >= MAX_PLAYERS:
        raise HTTPException(409, "A játék megtelt.")
    game["players"].append(bots.new_bot(game))
    return await updated(game)


@app.post("/api/games/{code}/bots/{bot_id}/remove")
async def remove_bot(code: str, bot_id: str, body: PlayerRef):
    game = get_game(code)
    host_in_lobby(game, body.player_id)
    bot = find_player(game, bot_id)
    if bot is None or not bots.is_bot(bot):
        raise HTTPException(404, "Nincs ilyen gépi játékos.")
    game["players"].remove(bot)
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
    humans = [p for p in game["players"] if not bots.is_bot(p)]
    if not humans:  # gépi játékosok magukban nem játszanak tovább
        del games[game["code"]]
        connections.pop(game["code"], None)
        return {"ok": True}
    if game["host_id"] == body.player_id:
        game["host_id"] = humans[0]["id"]  # a következő (emberi) játékos lesz a házigazda
    pending = game["pending"]
    if pending and pending["player_id"] == body.player_id:
        # a még el nem fogadott lap(ok) a dobott lapok közé kerülnek, hogy a 40 lapos pakli megmaradjon
        if pending["type"] == "card":
            game["discard"].append(pending["card"])
        elif pending["type"] == "card_pick":
            game["discard"].extend(pending["options"])
        game["pending"] = None
    game["traps"] = {f: t for f, t in game["traps"].items() if t["owner"] != body.player_id}
    # a kör annál marad, aki eddig is következett volna
    if index < game["turn"]:
        game["turn"] -= 1
    game["turn"] %= len(game["players"])
    if game["status"] == "playing" and len(game["players"]) == 1:
        # egyedül nem lehet játszani: aki bent maradt, megnyeri a szezont
        last = game["players"][0]
        game["status"] = "finished"
        game["winner_id"] = last["id"]
        game["end_reason"] = "left"
        add_log(game, f"Mindenki más kilépett: {last['name']} nyerte a szezont.")
    await updated(game)
    return {"ok": True}


# --- játék ---


@app.post("/api/games/{code}/roll")
async def roll_dice(code: str, body: PlayerRef):
    """A soron következő játékos dob; a szerver sorsol, lépteti a bábut és alkalmazza a mezőt."""
    game = get_game(code)
    play.roll(game, acting_player(game, body.player_id))
    return await updated(game)


@app.post("/api/games/{code}/repay")
async def repay_loan(code: str, body: PlayerRef):
    """Önkéntes törlesztés a saját körben, dobás előtt (amennyit a pénz fedez)."""
    game = get_game(code)
    play.repay(game, acting_player(game, body.player_id))
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


@app.post("/api/games/{code}/dev/season")
async def dev_season(code: str, body: DevSeasonIn):
    """Szezonesemény azonnal (bemutatóhoz): a megadottat indítja, vagy "none"-ra a futót leállítja.
    Amíg egy esemény tart, újat ez sem indíthat."""
    require_dev()
    game = get_game(code)
    if find_player(game, body.player_id) is None:
        raise HTTPException(404, "Nincs ilyen játékos.")
    if body.season == "none":
        game["season"] = None
    elif body.season not in seasons.SEASONS:
        raise HTTPException(422, "Nincs ilyen szezonesemény.")
    elif not seasons.start(game, body.season):
        raise HTTPException(409, "Már tart egy szezonesemény, előbb annak kell véget érnie.")
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


# --- a lefordított játék (élesben) ---

# Élesben (Docker) ugyanez a szerver adja ki a lefordított frontendet is, így az /api, a /ws és a játék
# egy címen van. Fejlesztés közben a frontend/dist nincs meg, akkor a Vite szolgálja ki.
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
