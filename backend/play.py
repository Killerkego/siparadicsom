"""A játékos lépései: dobás, a várakozó döntések (kártya, építkezés, gambling, felvonó, csapda)
és a fejlesztői lépések. Mindegyik a játékállapotot módosítja; a végpontok a main.py-ban vannak."""

from fastapi import HTTPException

from actions import add_log, dice, dobott, jump, record_action, walk
from config import BUILDING_BY_ID, BUILDINGS, FIELD_COUNT, RULES
from fields import land
from turns import build, build_problem, close_turn, finish_turn


def roll(game: dict, player: dict) -> None:
    """A szerver sorsol, lépteti a bábut és alkalmazza a mezőt; ha nincs döntés, jön a kör vége."""
    if game["pending"]:
        raise HTTPException(409, "Előbb dönts a mezőn.")
    value = dice()
    moves = []
    if player["in_school"]:
        # oktatás: a kör elején fix összeg, és csak páros dobással mehet tovább
        player["money"] += RULES["school_pay"]
        stays = value % 2 == 1
        result = "(páratlan), marad" if stays else "(páros), mehet tovább"
        add_log(game, f"{player['name']} oktatáson: +{RULES['school_pay']} HK, {dobott(value)} {result}.")
        if stays:
            record_action(game, player, value, moves)
            finish_turn(game, player)
            return
        player["in_school"] = False
    moves.append(walk(game, player, value))
    land(game, player, moves)
    record_action(game, player, value, moves)
    if not game["pending"]:
        finish_turn(game, player)


# --- döntések: mindegyik a játékos választását hajtja végre ---


def accept_card(game: dict, player: dict, pending: dict, choice: str) -> None:
    if choice != "ok":
        raise HTTPException(422, "A kártyát az OK gombbal lehet elfogadni.")
    game["pending"] = None
    finish_turn(game, player)


def choose_building(game: dict, player: dict, pending: dict, choice: str) -> None:
    if choice == "no":
        add_log(game, f"{player['name']} most nem épített.")
    else:
        building = BUILDING_BY_ID.get(choice)
        if building is None:
            raise HTTPException(422, "Nincs ilyen építési elem.")
        problem = build_problem(player, building, pending["discount"])
        if problem:
            raise HTTPException(409, problem)
        build(game, player, building, pending["discount"])
    close_turn(game, player)


def gamble(game: dict, player: dict, pending: dict, choice: str) -> None:
    name = player["name"]
    if choice == "no":
        add_log(game, f"{name} nem kockáztatott a gamblingon.")
    elif choice == "yes":
        value = dice()
        moves = []
        if value <= 3:
            moves.append(walk(game, player, -RULES["gamble_back"]))
            add_log(game, f"{name} kockáztatott, {dobott(value)}: bukta, {RULES['gamble_back']} mezőt vissza.")
        else:
            player["money"] += RULES["gamble_prize"]
            add_log(game, f"{name} kockáztatott, {dobott(value)}: nyert, +{RULES['gamble_prize']} HK.")
        record_action(game, player, value, moves)
    else:
        raise HTTPException(422, "Igen vagy nem?")
    game["pending"] = None
    finish_turn(game, player)


def ride_lift(game: dict, player: dict, pending: dict, choice: str) -> None:
    if choice == "no":
        add_log(game, f"{player['name']} nem szállt fel a felvonóra.")
    else:
        target = int(choice) if choice.isdigit() else None
        if target not in pending["targets"]:
            raise HTTPException(422, "Nincs ilyen felvonó.")
        if player["money"] < RULES["lift_cost"]:
            raise HTTPException(409, "Nincs elég pénzed a felvonóra.")
        player["money"] -= RULES["lift_cost"]
        record_action(game, player, None, [jump(player, target)])
        add_log(game, f"{player['name']} felvonóval átment a #{target} mezőre (-{RULES['lift_cost']} HK).")
    game["pending"] = None
    finish_turn(game, player)


def place_trap(game: dict, player: dict, pending: dict, choice: str) -> None:
    if choice not in ("back", "money"):
        raise HTTPException(422, "Mezők vissza vagy pénz?")
    game["traps"][str(player["position"])] = {"owner": player["id"], "kind": choice}
    add_log(game, f"{player['name']} csapdát rakott a #{player['position']} mezőre.")
    game["pending"] = None
    finish_turn(game, player)


DECISIONS = {
    "card": accept_card,
    "build": choose_building,
    "gamble": gamble,
    "lift": ride_lift,
    "trap": place_trap,
}


def choose(game: dict, player: dict, choice: str) -> None:
    """A várakozó döntés végrehajtása (utána az építkezés, végül a következő játékos jön)."""
    pending = game["pending"]
    if not pending:
        raise HTTPException(409, "Most nincs mit eldönteni.")
    DECISIONS[pending["type"]](game, player, pending, choice)


# --- fejlesztői lépések ---


def dev_move(game: dict, player: dict, field: int) -> None:
    """Dobás helyett a megadott mezőre ugrik; a mező hatása és a kör vége ugyanúgy jön, mint dobásnál."""
    if game["pending"]:
        raise HTTPException(409, "Előbb dönts a mezőn.")
    if not 0 <= field < FIELD_COUNT:
        raise HTTPException(422, "Nincs ilyen mező.")
    start = player["position"]
    walk(game, player, (field - start) % FIELD_COUNT)  # előre megy, így a START-bónusz is jár
    player["in_school"] = False
    moves = [{"type": "jump", "from": start, "to": field}]
    add_log(game, f"[fejlesztői] {player['name']} a #{field} mezőre lépett.")
    land(game, player, moves)
    record_action(game, player, None, moves)
    if not game["pending"]:
        finish_turn(game, player)


def dev_build_all(game: dict, player: dict) -> None:
    """Ingyen megépíti a játékos összes elemét."""
    if game["status"] != "playing":
        raise HTTPException(409, "A játék nem fut.")
    player["buildings"] = [b["id"] for b in BUILDINGS]
    add_log(game, f"[fejlesztői] {player['name']} minden elemet megépített.")
    pending = game["pending"]
    if pending and pending["type"] == "build" and pending["player_id"] == player["id"]:
        close_turn(game, player)  # nincs már mit építeni: győzelem ellenőrzése, körváltás
