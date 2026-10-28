"""A kör menete: ki léphet, a kör végi építkezés, a győzelem ellenőrzése és a körváltás."""

from fastapi import HTTPException

from actions import add_log, animating
from config import BOARD, BUILDING_BY_ID, BUILDINGS, RULES


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


def build_price(building: dict, discount: int) -> int:
    """a vételár a kedvezménnyel, 50 HK-ra kerekítve"""
    return round(building["price"] * (100 - discount) / 100 / 50) * 50


def build_problem(player: dict, building: dict, discount: int) -> str | None:
    """Miért nem veheti meg most a játékos az elemet (None, ha megveheti)."""
    if building["id"] in player["buildings"]:
        return f"A(z) {building['name']} már megvan."
    missing = [BUILDING_BY_ID[r]["name"] for r in building["requires"] if r not in player["buildings"]]
    if missing:
        return f"A(z) {building['name']} előfeltétele: {', '.join(missing)}."
    if player["money"] < build_price(building, discount):
        return f"Nincs elég pénzed: a(z) {building['name']} {build_price(building, discount)} HK."
    return None


def build(game: dict, player: dict, building: dict, discount: int) -> None:
    """Megépíti az elemet (a hívó már ellenőrizte, hogy megveheti)."""
    price = build_price(building, discount)
    player["money"] -= price
    player["buildings"].append(building["id"])
    sale = f", {discount}% kedvezménnyel" if discount else ""
    add_log(game, f"{player['name']} megépítette: {building['name']} (-{price} HK{sale}).")


# --- a kör vége ---


def finish_turn(game: dict, player: dict) -> None:
    """A mező hatásai után: ha van megvehető elem, a játékos dönthet róla, különben lezárul a kör."""
    discount = RULES["shop_discount"] if BOARD[player["position"]]["type"] == "vasarlas" else 0
    options = [b["id"] for b in BUILDINGS if build_problem(player, b, discount) is None]
    if options:
        game["pending"] = {"type": "build", "player_id": player["id"], "discount": discount, "options": options}
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
    game["turn"] = (game["turn"] + 1) % len(game["players"])
