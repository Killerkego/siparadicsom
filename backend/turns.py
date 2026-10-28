"""A kör menete: ki léphet, a kör végi építkezés, a győzelem ellenőrzése és a körváltás."""

from fastapi import HTTPException

from actions import add_log, animating
from config import BOARD, BUILDING_BY_ID, BUILDINGS, RULES

# a kör végén fogyó, több körös kártyahatások és a lejáratkor kiírt név
TIMED_EFFECTS = {"build_discount": "Szponzor", "shield_bad": "Lojális ügyfél", "block_good": "Kártyablokk"}


def acting_player(game: dict, player_id: str) -> dict:
    """A soron következő játékos, ha ő kérte és most léphet; különben hiba."""
    if game["status"] == "finished":
        raise HTTPException(409, "A játék véget ért.")
    if game["status"] != "playing":
        raise HTTPException(409, "A játék még nem indult el.")
    player = game["players"][game["turn"]]
    if player["id"] != player_id:
        raise HTTPException(403, "Nem te következel.")
    if animating(game):
        raise HTTPException(409, "Még tart az előző lépés.")
    return player


# --- építkezés ---


def build_price(building: dict, discount: int, player: dict | None = None) -> int:
    """A vételár a vásárlási mező kedvezményével és a játékos kártyáival (Szponzor -40%,
    Negatív visszajelzés +20%), 50 HK-ra kerekítve."""
    price = building["price"] * (100 - discount) / 100
    if player and player["effects"]["build_discount"]:
        price *= 0.6
    if player and player["effects"]["build_markup"]:
        price *= 1.2
    return round(price / 50) * 50


def build_problem(player: dict, building: dict, discount: int) -> str | None:
    """Miért nem veheti meg most a játékos az elemet (None, ha megveheti)."""
    if building["id"] in player["buildings"]:
        return f"A(z) {building['name']} már megvan."
    missing = [BUILDING_BY_ID[r]["name"] for r in building["requires"] if r not in player["buildings"]]
    if missing:
        return f"A(z) {building['name']} előfeltétele: {', '.join(missing)}."
    price = build_price(building, discount, player)
    if player["money"] < price:
        return f"Nincs elég pénzed: a(z) {building['name']} {price} HK."
    return None


def build(game: dict, player: dict, building: dict, discount: int) -> None:
    """Megépíti az elemet (a hívó már ellenőrizte, hogy megveheti); a kártyás árhatások elfogynak."""
    price = build_price(building, discount, player)
    player["money"] -= price
    player["buildings"].append(building["id"])
    effects = player["effects"]
    notes = [f"{discount}% kedvezménnyel"] if discount else []
    if effects["build_discount"]:
        effects["build_discount"] = 0
        notes.append("Szponzor: -40%")
    if effects["build_markup"]:
        effects["build_markup"] -= 1
        notes.append("Negatív visszajelzés: +20%")
    extra = f", {', '.join(notes)}" if notes else ""
    add_log(game, f"{player['name']} megépítette: {building['name']} (-{price} HK{extra}).")


# --- a kör vége ---


def finish_turn(game: dict, player: dict) -> None:
    """A mező hatásai után: ha van megvehető elem, a játékos dönthet róla, különben lezárul a kör."""
    if player["effects"]["build_block"]:
        player["effects"]["build_block"] -= 1
        add_log(game, f"{player['name']} ebben a körben nem vásárolhat épületet (kártya).")
        close_turn(game, player)
        return
    discount = RULES["shop_discount"] if BOARD[player["position"]]["type"] == "vasarlas" else 0
    options = [b["id"] for b in BUILDINGS if build_problem(player, b, discount) is None]
    if options:
        prices = {b: build_price(BUILDING_BY_ID[b], discount, player) for b in options}
        game["pending"] = {
            "type": "build",
            "player_id": player["id"],
            "discount": discount,
            "options": options,
            "prices": prices,
        }
        return
    if discount:
        add_log(game, f"{player['name']} vásárlási mezőn áll, de most nincs megvehető építési elem.")
    close_turn(game, player)


def close_turn(game: dict, player: dict) -> None:
    """Győzelem ellenőrzése a kör végén (minden elem, elég pénz, nincs hitel), utána körváltás."""
    won = len(player["buildings"]) == len(BUILDINGS) and player["money"] >= RULES["win_money"] and not player["loan"]
    if won:
        game["status"] = "finished"
        game["winner_id"] = player["id"]
        game["pending"] = None
        add_log(game, f"{player['name']} felépítette a teljes síparadicsomot és nyert!")
        return
    game["pending"] = None
    tick_effects(game, player)
    next_player(game)


def tick_effects(game: dict, player: dict) -> None:
    """A több körös kártyahatások a játékos saját körének végén fogynak."""
    for key, name in TIMED_EFFECTS.items():
        if player["effects"][key]:
            player["effects"][key] -= 1
            if not player["effects"][key]:
                add_log(game, f"{player['name']} {name} hatása lejárt.")


def next_player(game: dict) -> None:
    """A következő játékos jön; aki kártya miatt kimarad, azt átugorjuk (és a kimaradása fogy)."""
    players = game["players"]
    for _ in range(len(players) * 4):
        game["turn"] = (game["turn"] + 1) % len(players)
        player = players[game["turn"]]
        if not player["effects"]["skip_turns"]:
            return
        player["effects"]["skip_turns"] -= 1
        add_log(game, f"{player['name']} kimarad ebből a körből.")
