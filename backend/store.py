"""A játékok tárolása (memóriában), új játék és játékos, a kliensnek küldött állapot és a szétküldés."""

import secrets
import time
import uuid

from fastapi import HTTPException, WebSocket

from deck import CARDS, new_deck
from config import (
    BUILDINGS,
    CODE_ALPHABET,
    CODE_LENGTH,
    DEV_MODE,
    FIGURE_COUNT,
    MAX_PLAYERS,
    MIN_PLAYERS,
    PAWN_COLORS,
    RULES,
)

# A játékok a memóriában vannak, a szerver újraindításakor elvesznek.
games: dict[str, dict] = {}
connections: dict[str, set[WebSocket]] = {}


def now_ms() -> int:
    return int(time.time() * 1000)


def new_code() -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if code not in games:
            return code


def new_player(game: dict | None, name: str) -> dict:
    players = game["players"] if game else []
    color = next(c for c in PAWN_COLORS if c not in {p["color"] for p in players})
    figure = next(f for f in range(FIGURE_COUNT) if f not in {p["figure"] for p in players})
    return {
        "id": uuid.uuid4().hex,
        "name": name,
        "color": color,
        "figure": figure,  # az első szabad figura; a lobbiban átválasztható
        "position": 0,
        "money": RULES["start_money"],
        "in_school": False,
        "buildings": [],  # a megépített elemek azonosítói, vásárlási sorrendben
        "loan": 0,  # a banknak tartozott összeg kamattal; a START-on törleszt, hitellel nem lehet nyerni
        "effects": new_effects(),  # a kártyák későbbi vagy több körös hatásai
    }


def new_effects() -> dict:
    """A kártyák függőben lévő hatásai; 0 = nincs. A „kör” mindig a játékos saját köre."""
    return {
        "income_boost": 0,  # Szezonnyitó buli: ennyi bevételi mezőn +50%
        "expense_half": 0,  # Könyvelő: ennyi kiadási mezőn csak a fele
        "build_discount": 0,  # Szponzor: még ennyi körig egy épület 40%-kal olcsóbb
        "build_markup": 0,  # Negatív visszajelzés: ennyi épület 20%-kal drágább
        "build_block": 0,  # IT-lefagyás, Sztrájk, Felvonó meghibásodása: ennyiszer nem vásárolhat
        "shield_bad": 0,  # Lojális ügyfél: még ennyi körig egy rossz kártya nem számít
        "block_good": 0,  # Kártyablokk: még ennyi körig egy jó kártya nem számít
        "weak_start": 0,  # Gyenge árfolyam: ennyi START-áthaladásnál csak kevesebb jár
        "max_move": 0,  # Felvonósztrájk: a következő dobásnál legfeljebb 3 mező
        "roll_minus": 0,  # Jegesedés: a következő dobásból 1-et le kell vonni
        "skip_turns": 0,  # Elakadás, Kiürítés, Rulett: ennyi körből kimarad
    }


def new_game(host: dict) -> dict:
    """Új játék a lobbiban, a házigazdával; elmenti a többi közé."""
    code = new_code()
    games[code] = {
        "code": code,
        "status": "lobby",  # lobby -> playing -> finished
        "host_id": host["id"],
        "players": [host],
        "turn": 0,  # a soron következő játékos sorszáma
        "last_action": None,  # az utolsó mozgás, ezt játsszák le a böngészők
        "pending": None,  # döntésre vár: card / gamble / lift / trap / build
        "traps": {},  # mező sorszáma (szövegként) -> ki rakta le és milyet
        "log": [],
        "winner_id": None,
        "deck": new_deck(),  # a húzópakli (a teteje az első elem); a kliens csak a darabszámot látja
        "discard": [],  # a már kihúzott lapok; ha a pakli elfogy, ezekből keverünk újat
    }
    return games[code]


def get_game(code: str) -> dict:
    game = games.get(code.upper())
    if game is None:
        raise HTTPException(404, "Nincs ilyen kódú játék.")
    return game


def find_player(game: dict, player_id: str) -> dict | None:
    return next((p for p in game["players"] if p["id"] == player_id), None)


def public_state(game: dict) -> dict:
    players = game["players"]
    return {
        "code": game["code"],
        "status": game["status"],
        "host_id": game["host_id"],
        "players": players,
        "turn_player_id": players[game["turn"]]["id"] if game["status"] == "playing" else None,
        "winner_id": game["winner_id"],
        # az utolsó mozgás (dobás, lépések, kártyahúzás); az "at" időponthoz igazítva mindenkinél egyszerre fut
        "last_action": game["last_action"],
        "pending": game["pending"],
        "traps": game["traps"],
        "log": game["log"],
        "rules": RULES,
        "buildings": BUILDINGS,
        "cards": CARDS,
        "deck_count": len(game["deck"]),
        "server_time": now_ms(),  # ebből számolja a kliens, mennyit siet/késik az órája
        "min_players": MIN_PLAYERS,
        "max_players": MAX_PLAYERS,
        "dev_mode": DEV_MODE,
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
