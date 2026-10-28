"""Segédek a tesztekhez: játék létrehozása a végpontokon át, kockadobás rögzítése, az animációs
várakozás kikapcsolása. A tesztek a backend mappából futnak (lásd TESZTELES.md a projekt gyökerében)."""

import asyncio
import sys
from contextlib import contextmanager
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402
from config import BOARD  # noqa: E402
from schemas import CreateIn, PlayerIn, PlayerRef  # noqa: E402
from store import games  # noqa: E402

# minden modul, amelyik kockát dob (a saját névterébe importálja a dice-t)
DICE_USERS = ("play.dice", "fields.dice", "cards.dice")


def run(coro):
    return asyncio.run(coro)


def new_lobby(count: int, public: bool = False):
    """Lobbi `count` játékossal; visszaadja a játékot és a játékosok azonosítóit sorrendben."""
    created = run(main.create_game(CreateIn(name="Játékos 1", public=public)))
    code = created["game"]["code"]
    ids = [created["player_id"]]
    for i in range(2, count + 1):
        ids.append(run(main.join_game(code, PlayerIn(name=f"Játékos {i}")))["player_id"])
    return games[code], ids


def new_game(count: int):
    """Elindított játék `count` játékossal (a házigazda indítja)."""
    game, ids = new_lobby(count)
    run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
    return game, ids


def settle(game: dict) -> None:
    """Az utolsó mozgás animációja véget ért (a szerver addig nem enged lépni)."""
    if game["last_action"]:
        game["last_action"]["at"] = -10**12


@contextmanager
def dice_rolls(*values):
    """A következő dobások értékei (minden kockát dobó modulban)."""
    sequence = iter(values)
    roll = lambda: next(sequence)  # noqa: E731
    patches = [mock.patch(target, roll) for target in DICE_USERS]
    for p in patches:
        p.start()
    try:
        yield
    finally:
        for p in patches:
            p.stop()


def field_id(kind: str) -> int:
    """Az első ilyen típusú (vagy speciális altípusú) mező sorszáma."""
    return next(f["id"] for f in BOARD if f["type"] == kind or f.get("special") == kind)


def current(game: dict) -> dict:
    return game["players"][game["turn"]]
