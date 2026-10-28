"""A mezők hatása, ahová a bábu érkezett: kártyahúzás és a speciális mezők (oktatás, síverseny,
gambling, felvonó, csapda). Ha a játékosnak döntenie kell, a játék `pending` mezőjébe kerül."""

from actions import add_log, dice, pay, walk
from config import BOARD, LIFTS, RULES
from store import find_player


def land(game: dict, player: dict, moves: list[dict]) -> None:
    """Az érkezési mező hatása. A visszaléptetés (csapda) a `moves` listába kerül az animációhoz."""
    pos = player["position"]
    field = BOARD[pos]
    if field["type"] == "kartya":
        draw_card(game, player)
    handler = SPECIAL_FIELDS.get(field.get("special"))
    if handler:
        handler(game, player, moves)


def draw_card(game: dict, player: dict) -> None:
    """A kártyák tartalma később jön: most csak a húzás látszik, hatása nincs.
    A lap addig marad a képernyőn, amíg a húzó játékos le nem okézza."""
    game["card_draw"] = True
    game["pending"] = {"type": "card", "player_id": player["id"]}
    add_log(game, f"{player['name']} húzott egy kártyát.")


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
    """Más csapdájába lépve elsül (vissza vagy fizet); üres csapdamezőn a játékos rakhat le egyet."""
    key = str(player["position"])
    placed = game["traps"].get(key)
    owner = placed and find_player(game, placed["owner"])
    if not owner or owner["id"] == player["id"]:
        game["pending"] = {"type": "trap", "player_id": player["id"]}
        return
    del game["traps"][key]
    if placed["kind"] == "back":
        moves.append(walk(game, player, -RULES["trap_back"]))
        add_log(game, f"{player['name']} {owner['name']} csapdájába lépett: {RULES['trap_back']} mezőt vissza.")
    else:
        pay(game, player, RULES["trap_money"])
        owner["money"] += RULES["trap_money"]
        add_log(game, f"{player['name']} {owner['name']} csapdájába lépett: {RULES['trap_money']} HK-t fizet neki.")


SPECIAL_FIELDS = {
    "oktatas": school,
    "siverseny": ski_race,
    "gambling": gambling,
    "felvono": lift,
    "csapda": trap,
}
