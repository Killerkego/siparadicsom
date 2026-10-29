"""Gépi játékosok: ugyanúgy dobnak és döntenek, mint az emberek, ugyanazokkal a szabályokkal (play.roll,
play.choose). A házigazda a lobbiban adja hozzá őket. A soron következő gépi játékos a szerveren lép,
miután az előző mozgás animációja minden böngészőben lefutott, és egy kis „gondolkodási” idő is eltelt.
"""

import asyncio
import random

from fastapi import HTTPException

import play
from actions import animation_left
from config import BUILDING_BY_ID, FIELD_COUNT, RULES
from deck import is_good
from store import broadcast, games, new_player

# a gépi játékosok neve (a játék világához illő becenevek); az első szabad jut
BOT_NAMES = ["Hópihe Hanna", "Fenyves Feri", "Lavina Lili", "Szánkós Samu"]

# ennyit vár a gép a döntés előtt, hogy a többiek lássák, mi történik (ms)
THINK_MS = {"roll": 900, "card": 2200, "card_pick": 2200, "build": 1400}
DEFAULT_THINK_MS = 1600

LIFT_RESERVE = 3000  # felvonóra csak akkor száll, ha utána is marad legalább ennyi pénze
GAMBLE_RESERVE = 2000  # gamblingon csak ennyi pénz felett kockáztat
REPAY_RESERVE = 2000  # dobás előtt kifizeti a teljes hitelt, ha utána is marad ennyi pénze

# játékonként a futó gépi lépéssorozat
running: dict[str, asyncio.Task] = {}


def is_bot(player: dict) -> bool:
    return player.get("bot", False)


def new_bot(game: dict) -> dict:
    """Új gépi játékos a lobbiba, szabad névvel, bábuval és színnel."""
    taken = {p["name"] for p in game["players"]}
    name = next((n for n in BOT_NAMES if n not in taken), f"Gépi játékos {len(game['players']) + 1}")
    bot = new_player(game, name)
    bot["bot"] = True
    return bot


# --- döntések ---


def decide(game: dict, player: dict) -> tuple[str, str | None]:
    """Mit lép most a gép: ("roll", None) vagy ("choose", választás)."""
    pending = game["pending"]
    if not pending:
        return "roll", None
    return "choose", CHOICES[pending["type"]](game, player, pending)


def wants_to_repay(player: dict) -> bool:
    """Dobás előtt önként törleszt: ha a teljes hitelt ki tudja fizetni, és marad tartaléka, vagy ha
    már minden eleme megvan, és a törlesztés után a győzelemhez kellő pénze is megmarad."""
    loan, money = player["loan"], player["money"]
    if not loan or money < loan:
        return False
    all_built = len(player["buildings"]) == len(BUILDING_BY_ID)
    return money - loan >= (RULES["win_money"] if all_built else REPAY_RESERVE)


def choose_card(game: dict, player: dict, pending: dict) -> str:
    return "ok"


def choose_card_pick(game: dict, player: dict, pending: dict) -> str:
    """Jósnő: a jó lapot választja, ha van ilyen."""
    good = [c for c in pending["options"] if is_good(c)]
    return random.choice(good or pending["options"])


def choose_build(game: dict, player: dict, pending: dict) -> str:
    """A megvehetők közül a legdrágábbat veszi meg (az viszi legtöbbet előre); ha nincs, kihagyja."""
    options = pending["options"]
    if not options:
        return "no"
    return max(options, key=lambda b: (pending["prices"].get(b, BUILDING_BY_ID[b]["price"]), b))


def choose_gamble(game: dict, player: dict, pending: dict) -> str:
    """Csak akkor kockáztat, ha bírja a bukást, és akkor is csak minden második alkalommal."""
    if player["money"] < GAMBLE_RESERVE:
        return "no"
    return random.choice(["yes", "no"])


def choose_lift(game: dict, player: dict, pending: dict) -> str:
    """Ha telik rá, a legmesszebb előre vivő felvonóra száll (a START-on túlra nem, mert az nem ad bónuszt)."""
    if player["money"] < RULES["lift_cost"] + LIFT_RESERVE:
        return "no"
    ahead = [t for t in pending["targets"] if t > player["position"]]
    if not ahead:
        return "no"
    return str(max(ahead, key=lambda t: (t - player["position"]) % FIELD_COUNT))


def choose_trap(game: dict, player: dict, pending: dict) -> str:
    return random.choice(["back", "money"])


CHOICES = {
    "card": choose_card,
    "card_pick": choose_card_pick,
    "build": choose_build,
    "gamble": choose_gamble,
    "lift": choose_lift,
    "trap": choose_trap,
}


# --- lépés ---


def bot_to_move(game: dict) -> dict | None:
    """A soron következő játékos, ha gépi és a játék fut; különben None."""
    if game["status"] != "playing":
        return None
    player = game["players"][game["turn"]]
    return player if is_bot(player) else None


def step(game: dict) -> bool:
    """A soron következő gépi játékos egy lépése (dobás vagy döntés). Igaz, ha lépett.
    Ha a döntése valamiért nem érvényes, a biztonságos „nem” választással próbálkozik."""
    player = bot_to_move(game)
    if player is None:
        return False
    action, choice = decide(game, player)
    if action == "roll":
        if wants_to_repay(player):
            play.repay(game, player)
        play.roll(game, player)
        return True
    try:
        play.choose(game, player, choice)
    except HTTPException:
        play.choose(game, player, "no" if game["pending"]["type"] != "card" else "ok")
    return True


def think_time(game: dict) -> int:
    pending = game["pending"]
    return THINK_MS.get(pending["type"] if pending else "roll", DEFAULT_THINK_MS)


async def drive(code: str) -> None:
    """Amíg gépi játékos következik: megvárja az animációt és a gondolkodási időt, lép, szétküldi."""
    while True:
        game = games.get(code)
        if game is None or bot_to_move(game) is None:
            return
        await asyncio.sleep((animation_left(game) + think_time(game)) / 1000)
        game = games.get(code)
        if game is None or bot_to_move(game) is None or animation_left(game) > 0:
            continue  # közben változott a helyzet (pl. valaki kilépett): újra megnézzük
        try:
            step(game)
        except HTTPException:
            return  # nem tud lépni (ez nem fordulhat elő), ne pörögjön a ciklus
        await broadcast(game)


def kick(game: dict) -> None:
    """Elindítja a gépi lépéseket, ha gépi játékos következik és még nem fut ilyen sorozat."""
    if bot_to_move(game) is None:
        return
    task = running.get(game["code"])
    if task is None or task.done():
        running[game["code"]] = asyncio.get_running_loop().create_task(drive(game["code"]))
