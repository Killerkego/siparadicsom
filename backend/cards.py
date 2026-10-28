"""Az eseménykártyák húzása és hatása.

Húzás (PDF 8.3): a pakli tetejéről; a kihúzott lap a dobott lapok közé kerül, és addig nem jön újra,
amíg a pakli el nem fogy. Ekkor a dobott lapokból új, megkevert pakli lesz.

Szabályok a lapokhoz:
- A kártyával elért mező (előre, hátra, START, helycsere) hatása nem érvényesül, csak a pénz a START-on.
- „Kör” mindig a húzó játékos saját köre; a több körös hatások a kör végén fogynak (turns.close_turn).
- Lojális ügyfél: a következő rossz (veszteség/hátrány) lapot semlegesíti; Kártyablokk: a következő jót.
- Ha egy hatás nem hajtható végre (pl. nincs épület), az ahhoz kötött rész egyszerűen 0.
"""

import random

from actions import add_log, dice, dobott, jump, pay, record_action, start_bonus, walk
from config import FIELD_COUNT
from deck import CARD_BY_ID, is_good


def take(game: dict) -> str:
    """A pakli felső lapja; ha elfogyott, a dobott lapokat újrakeverjük."""
    if not game["deck"]:
        game["deck"] = game["discard"]
        game["discard"] = []
        random.SystemRandom().shuffle(game["deck"])
        add_log(game, "A pakli elfogyott: a kártyák újrakeverve.")
    return game["deck"].pop(0)


def blocker(player: dict, card_id: str) -> str | None:
    """Ha egy korábbi lap miatt ez a kártya nem számít, annak a neve (és a védelem elfogy)."""
    effects = player["effects"]
    if is_good(card_id) and effects["block_good"]:
        effects["block_good"] = 0
        return "Kártyablokk"
    if not is_good(card_id) and effects["shield_bad"]:
        effects["shield_bad"] = 0
        return "Lojális ügyfél"
    return None


def draw(game: dict, player: dict) -> None:
    """Kártyahúzó mezőn: a lap a kamera elé repül, és a játékos elfogadásáig ott marad."""
    card_id = take(game)
    card = CARD_BY_ID[card_id]
    game["card_draw"] = card_id  # a mozgás animációja a végén ezt a lapot húzza
    game["pending"] = {"type": "card", "player_id": player["id"], "card": card_id, "blocked_by": blocker(player, card_id)}
    add_log(game, f"{player['name']} kártyát húzott: {card['name']}.")


def resolve(game: dict, player: dict, card_id: str, blocked_by: str | None) -> str:
    """A lap végrehajtása. Visszaadja, hogyan folytatódik a kör:
    "finish" (kör vége), "again" (még egyszer dobhat), "pending" (új döntés vár, pl. Jósnő)."""
    card = CARD_BY_ID[card_id]
    if blocked_by:
        game["discard"].append(card_id)
        add_log(game, f"{player['name']} {card['name']} lapja nem számít ({blocked_by}).")
        return "finish"
    result = EFFECTS[card_id](game, player) or "finish"
    if card_id != "E08":  # a Jósnő lapja a két új lap kihúzása előtt került el
        game["discard"].append(card_id)
    return result


def pick(game: dict, player: dict, chosen: str, other: str) -> str:
    """Jósnő: a választott lap végrehajtása, a másik a pakli aljára kerül."""
    game["deck"].append(other)
    add_log(game, f"{player['name']} a {CARD_BY_ID[chosen]['name']} lapot választotta, a másik a pakli aljára került.")
    return resolve(game, player, chosen, blocker(player, chosen))


# --- segédek ---


def gain(game: dict, player: dict, amount: int, why: str = "") -> None:
    player["money"] += amount
    add_log(game, f"{player['name']}: +{amount} HK{why}.")


def charge(game: dict, player: dict, amount: int, why: str = "") -> None:
    """Kötelező fizetés (pénzhiánynál hitelből)."""
    pay(game, player, amount)
    add_log(game, f"{player['name']}: -{amount} HK{why}.")


def move(game: dict, player: dict, moves: list[dict], dice_value: int | None = None) -> None:
    """A kártya mozgatását lejátsszák a böngészők; az új mező hatása nem érvényesül."""
    record_action(game, player, dice_value, moves)


def has(player: dict, building: str) -> bool:
    return building in player["buildings"]


# --- előny ---


def season_party(game, player):  # E01
    player["effects"]["income_boost"] += 2


def empty_lift(game, player):  # E02
    add_log(game, f"{player['name']} még egyszer dobhat.")
    return "again"


def sponsor(game, player):  # E03
    player["effects"]["build_discount"] = 3


def loyal_guest(game, player):  # E04
    player["effects"]["shield_bad"] = 5


def accountant(game, player):  # E05
    gain(game, player, 700)
    player["effects"]["expense_half"] += 1


def helicopter(game, player):  # E06
    moves = [jump(player, 0)]
    start_bonus(game, player, 2000)
    move(game, player, moves)


def tourist_pull(game, player):  # E07
    move(game, player, [walk(game, player, 4, bonus=4000)])


def fortune_teller(game, player):  # E08
    game["discard"].append("E08")
    options = [take(game), take(game)]
    game["pending"] = {"type": "card_pick", "player_id": player["id"], "options": options}
    add_log(game, f"{player['name']} két lapot húzott a Jósnőnél, választ közülük.")
    return "pending"


# --- hátrány ---


def stuck(game, player):  # H01
    player["effects"]["skip_turns"] += 1


def avalanche_path(game, player):  # H02
    move(game, player, [walk(game, player, -3)])


def it_freeze(game, player):  # H03
    player["effects"]["build_block"] += 1


def weak_rate(game, player):  # H04
    player["effects"]["weak_start"] = 2


def lift_strike(game, player):  # H05
    player["effects"]["max_move"] = 1


def defection(game, player):  # H06
    behind = (player["position"] - 1) % FIELD_COUNT
    other = next((p for p in game["players"] if p is not player and p["position"] == behind), None)
    if other:
        other["position"] = player["position"]
        move(game, player, [jump(player, behind)])
        add_log(game, f"{player['name']} és {other['name']} helyet cserélt.")
        if other["in_school"]:  # elkerült az oktatás mezőjéről, így az oktatásnak is vége
            other["in_school"] = False
            add_log(game, f"{other['name']} a helycserével kikerült az oktatásról.")
    else:
        move(game, player, [jump(player, 1)])
        add_log(game, f"{player['name']} mögött nem áll senki: az 1. mezőre lépett.")


def roulette(game, player):  # H07
    value = dice()
    moves = []
    if value <= 2:
        moves.append(walk(game, player, -3))
        add_log(game, f"Rulett: {player['name']} {dobott(value)}, 3 mezőt vissza.")
    elif value <= 4:
        player["effects"]["skip_turns"] += 1
        add_log(game, f"Rulett: {player['name']} {dobott(value)}, kimarad egy körből.")
    else:
        charge(game, player, 1500, f" (Rulett, {dobott(value)})")
    move(game, player, moves, value)


def card_block(game, player):  # H08
    player["effects"]["block_good"] = 5


# --- nyeremény ---


def money(amount):
    return lambda game, player: gain(game, player, amount)


def full_house(game, player):  # N05
    extra = 600 if has(player, "szalloda") or has(player, "lakosztaly") else 0
    gain(game, player, 2400 + extra)


def olympic_camp(game, player):  # N07
    gain(game, player, 2800 + (500 if has(player, "palya") else 0))


def gourmet(game, player):  # N10
    gain(game, player, 3000 if has(player, "etterem") else 900)


def king_of_the_hill(game, player):  # N11
    for p in game["players"]:
        if p["buildings"]:
            gain(game, p, 400 * len(p["buildings"]), f" ({len(p['buildings'])} épület)")


# --- veszteség ---


def fine(amount):
    return lambda game, player: charge(game, player, amount)


def strike(game, player):  # V02
    charge(game, player, 1800)
    player["effects"]["build_block"] += 1


def lift_failure(game, player):  # V03
    charge(game, player, 1600 if has(player, "felvono") else 2200)
    player["effects"]["build_block"] += 1


def avalanche(game, player):  # V04
    charge(game, player, 2000)
    move(game, player, [walk(game, player, -2)])


def icing(game, player):  # V05
    charge(game, player, 1200)
    player["effects"]["roll_minus"] = 1


def bad_review(game, player):  # V06
    charge(game, player, 1400)
    player["effects"]["build_markup"] += 1


def cancelled_show(game, player):  # V07
    charge(game, player, 1000 if has(player, "bar") else 1800)


def evacuation(game, player):  # V08
    charge(game, player, 1300)
    player["effects"]["skip_turns"] += 1


def mandatory_fee(game, player):  # V10
    for p in game["players"]:
        charge(game, p, 700)


def weak_season(game, player):  # V11
    charge(game, player, 600 * len(player["buildings"]) + 600, f" ({len(player['buildings'])} épület)")


def overbooking(game, player):  # V12
    charge(game, player, 1800)
    for p in game["players"]:
        if p is not player and len(p["buildings"]) > len(player["buildings"]):
            pay(game, player, 400)
            p["money"] += 400
            add_log(game, f"{player['name']} 400 HK-t fizetett {p['name']} játékosnak (több épülete van).")


EFFECTS = {
    "E01": season_party, "E02": empty_lift, "E03": sponsor, "E04": loyal_guest,
    "E05": accountant, "E06": helicopter, "E07": tourist_pull, "E08": fortune_teller,
    "H01": stuck, "H02": avalanche_path, "H03": it_freeze, "H04": weak_rate,
    "H05": lift_strike, "H06": defection, "H07": roulette, "H08": card_block,
    "N01": money(3200), "N02": money(2200), "N03": money(2500), "N04": money(1800),
    "N05": full_house, "N06": money(1600), "N07": olympic_camp, "N08": money(2000),
    "N09": money(1500), "N10": gourmet, "N11": king_of_the_hill, "N12": money(2300),
    "V01": fine(1500), "V02": strike, "V03": lift_failure, "V04": avalanche,
    "V05": icing, "V06": bad_review, "V07": cancelled_show, "V08": evacuation,
    "V09": fine(1600), "V10": mandatory_fee, "V11": weak_season, "V12": overbooking,
}
assert set(EFFECTS) == set(CARD_BY_ID), "minden kártyának kell hatás"
