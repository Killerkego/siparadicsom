"""Alapműveletek: kockadobás, napló, a mozgás rögzítése az animációhoz, lépés, fizetés és hitel."""

import secrets

from config import (
    CARD_MS,
    DICE_MS,
    FIELD_COUNT,
    JUMP_MS,
    LOG_LENGTH,
    RACE_RESULT_MS,
    RACE_ROUND_MS,
    RULES,
    STEP_MS,
)
from store import now_ms


def dice() -> int:
    return secrets.randbelow(6) + 1


def dobott(value: int) -> str:
    """'dobott' elé a szám tárgyragos alakja: 1-et, 2-t, 3-at, ..."""
    return {1: "1-et", 2: "2-t", 3: "3-at", 4: "4-et", 5: "5-öt", 6: "6-ot"}[value] + " dobott"


def add_log(game: dict, text: str) -> None:
    game["log"] = (game["log"] + [text])[-LOG_LENGTH:]


# --- mozgás és animáció ---


def action_duration(action: dict) -> int:
    moves = sum(JUMP_MS if m["type"] == "jump" else abs(m["steps"]) * STEP_MS for m in action["moves"])
    race = action.get("race")
    race_ms = len(race["rounds"]) * RACE_ROUND_MS + RACE_RESULT_MS if race else 0
    return (DICE_MS if action["dice"] else 0) + moves + (CARD_MS if action.get("card") else 0) + race_ms


def animating(game: dict) -> bool:
    """Tart-e még az utolsó mozgás animációja (addig senki nem léphet)."""
    return animation_left(game) > 0


def animation_left(game: dict) -> int:
    """Hány ms van még hátra az utolsó mozgás animációjából (0, ha már véget ért)."""
    action = game["last_action"]
    if action is None:
        return 0
    return max(0, action["at"] + action_duration(action) - now_ms())


def record_action(game: dict, player: dict, dice_value: int | None, moves: list[dict]) -> None:
    """Elmenti a mozgást, amit minden böngésző ugyanabban az időben lejátszik."""
    if dice_value is None and not moves:
        return
    game["last_action"] = {
        "seq": (game["last_action"] or {}).get("seq", 0) + 1,
        "at": now_ms(),
        "player_id": player["id"],
        "dice": dice_value,
        "moves": moves,
        "card": game.pop("card_draw", False),  # a mozgás végén kártyát húz (animáció)
        "race": game.pop("race_draw", None),  # síverseny a mozgás végén: a dobási körök és a győztes
    }


def walk(game: dict, player: dict, steps: int, bonus: int | None = None) -> dict:
    """Előre (pozitív) vagy hátra (negatív) lépteti a bábut. Előre a START-on át bónusz jár
    (`bonus`: kártya által megadott összeg a szokásos helyett)."""
    start = player["position"]
    if steps > 0 and start + steps >= FIELD_COUNT:
        start_bonus(game, player, bonus)
    player["position"] = (start + steps) % FIELD_COUNT
    return {"type": "walk", "from": start, "steps": steps}


def start_bonus(game: dict, player: dict, amount: int | None = None) -> None:
    """A START-on járó pénz (Gyenge árfolyam után kevesebb), utána a bank levonja a hitelt."""
    if amount is None:
        amount = RULES["start_bonus"]
        if player["effects"]["weak_start"]:
            player["effects"]["weak_start"] -= 1
            amount = RULES["weak_start_bonus"]
    player["money"] += amount
    add_log(game, f"{player['name']} áthaladt a START-on: +{amount} HK.")
    repay_loan(game, player)


def jump(player: dict, target: int) -> dict:
    """Átugrik a megadott mezőre (felvonó, fejlesztői lépés)."""
    move = {"type": "jump", "from": player["position"], "to": target}
    player["position"] = target
    return move


# --- pénz ---


def pay(game: dict, player: dict, amount: int) -> None:
    """Kötelező fizetés. Ha nincs rá elég pénz, a bank kölcsönad (loan_unit egységekben, kamattal),
    így a játékos sosem kerül megoldhatatlan helyzetbe."""
    if player["money"] < amount:
        unit = RULES["loan_unit"]
        borrowed = -(-(amount - player["money"]) // unit) * unit
        owed = borrowed * (100 + RULES["loan_interest"]) // 100
        player["money"] += borrowed
        player["loan"] += owed
        add_log(game, f"{player['name']} hitelt vett fel: +{borrowed} HK, {owed} HK-t kell visszafizetnie.")
    player["money"] -= amount


def repay_loan(game: dict, player: dict) -> None:
    """A START-on a bank visszaveszi a hitelt, amennyit a játékos pénze fedez."""
    amount = min(player["loan"], player["money"])
    if amount <= 0:
        return
    player["money"] -= amount
    player["loan"] -= amount
    rest = f", még {player['loan']} HK hitel maradt" if player["loan"] else ", a hitel rendezve"
    add_log(game, f"{player['name']} törlesztett {amount} HK-t{rest}.")
