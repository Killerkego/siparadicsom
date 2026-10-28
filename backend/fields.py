"""A mezők hatása, ahová a bábu érkezett: bevétel, kiadás, kártyahúzás és a speciális mezők
(oktatás, síverseny, gambling, felvonó, csapda). Ha a játékosnak döntenie kell, a játék `pending`
mezőjébe kerül."""

import cards
from actions import add_log, dice, pay, walk
from config import BOARD, LIFTS, RULES
from store import find_player


def land(game: dict, player: dict, moves: list[dict]) -> None:
    """Az érkezési mező hatása. A visszaléptetés (csapda) a `moves` listába kerül az animációhoz."""
    field = BOARD[player["position"]]
    handler = FIELD_TYPES.get(field["type"]) or SPECIAL_FIELDS.get(field.get("special"))
    if handler:
        handler(game, player, moves)


def income(game: dict, player: dict, moves: list[dict]) -> None:
    """Bevételi mező: fix összeg (Szezonnyitó buli után 50%-kal több)."""
    amount = RULES["income_field"]
    extra = ""
    if player["effects"]["income_boost"]:
        player["effects"]["income_boost"] -= 1
        amount = amount * 3 // 2
        extra = " (Szezonnyitó buli: +50%)"
    player["money"] += amount
    add_log(game, f"{player['name']} bevételi mezőre lépett: +{amount} HK{extra}.")


def expense(game: dict, player: dict, moves: list[dict]) -> None:
    """Kiadási mező: fix összeg (Könyvelő után a fele); ha nincs rá pénz, hitelből."""
    amount = RULES["expense_field"]
    extra = ""
    if player["effects"]["expense_half"]:
        player["effects"]["expense_half"] -= 1
        amount //= 2
        extra = " (Könyvelő: csak a fele)"
    pay(game, player, amount)
    add_log(game, f"{player['name']} kiadási mezőre lépett: -{amount} HK{extra}.")


def card(game: dict, player: dict, moves: list[dict]) -> None:
    cards.draw(game, player)


def school(game: dict, player: dict, moves: list[dict]) -> None:
    """Oktatás: páros dobással mehet tovább, addig minden kör elején fix összeget kap."""
    player["in_school"] = True
    add_log(
        game,
        f"{player['name']} oktatásra került: páros dobással mehet tovább, addig minden körben +{RULES['school_pay']} HK.",
    )


def ski_race(game: dict, player: dict, moves: list[dict]) -> None:
    """Síverseny: mindenki dob, a legmagasabb nyer; döntetlennél az élen állók újra dobnak."""
    contenders = game["players"]
    rounds = []
    while True:
        rolls = {p["id"]: dice() for p in contenders}
        rounds.append(", ".join(f"{p['name']} {rolls[p['id']]}" for p in contenders))
        best = max(rolls.values())
        contenders = [p for p in contenders if rolls[p["id"]] == best]
        if len(contenders) == 1:
            break
    winner = contenders[0]
    winner["money"] += RULES["race_prize"]
    add_log(game, f"Síverseny! {' | '.join(rounds)} → {winner['name']} nyert, +{RULES['race_prize']} HK.")


def gambling(game: dict, player: dict, moves: list[dict]) -> None:
    game["pending"] = {"type": "gamble", "player_id": player["id"]}


def lift(game: dict, player: dict, moves: list[dict]) -> None:
    targets = [f for f in LIFTS if f != player["position"]]
    game["pending"] = {"type": "lift", "player_id": player["id"], "targets": targets}


def trap(game: dict, player: dict, moves: list[dict]) -> None:
    """Más csapdájába lépve elsül (vissza vagy fizet); üres csapdamezőn a játékos rakhat le egyet.
    Visszalépésnél az új mező hatása is érvényesül: a tábla úgy van kirakva, hogy az kiadási mező legyen."""
    key = str(player["position"])
    placed = game["traps"].get(key)
    owner = placed and find_player(game, placed["owner"])
    if not owner or owner["id"] == player["id"]:
        game["pending"] = {"type": "trap", "player_id": player["id"]}
        return
    del game["traps"][key]
    # a lerakó böngészője ebből tudja, hogy a mozgás végén értesítést mutasson
    game["trap_event"] = {
        "seq": (game["trap_event"] or {}).get("seq", 0) + 1,
        "field": int(key),
        "owner_id": owner["id"],
        "victim_id": player["id"],
        "kind": placed["kind"],
    }
    if placed["kind"] == "back":
        moves.append(walk(game, player, -RULES["trap_back"]))
        add_log(game, f"{player['name']} {owner['name']} csapdájába lépett: {RULES['trap_back']} mezőt vissza.")
        land(game, player, moves)
    else:
        pay(game, player, RULES["trap_money"])
        owner["money"] += RULES["trap_money"]
        add_log(game, f"{player['name']} {owner['name']} csapdájába lépett: {RULES['trap_money']} HK-t fizet neki.")


FIELD_TYPES = {
    "bevetel": income,
    "kiadas": expense,
    "kartya": card,
}

SPECIAL_FIELDS = {
    "oktatas": school,
    "siverseny": ski_race,
    "gambling": gambling,
    "felvono": lift,
    "csapda": trap,
}
