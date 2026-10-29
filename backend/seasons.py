"""Szezonesemények: néhány körönként az egész hegyre hat valami, mindenkire egyformán.

Egy kör = mindenki egyszer következett (a kezdőjátékosra visszaérve új kör indul). Az első esemény a
SEASON_FIRST_ROUND. körben jön. Hogy melyik esemény jön és hány körig tart (SEASON_LENGTH), az véletlenszerű,
utána SEASON_GAP kör szünet következik (config.py). Két egymás utáni esemény nem lehet ugyanaz, és amíg egy
esemény tart, új nem kezdődhet.

- Csúcsszezon: minden bevételi mezőn +50% (a Szezonnyitó buli erre jön rá).
- Hóvihar: a felvonók zárva, a felvonó mezőn nem lehet átmenni egy másikra.
- Ellenőrzés: minden kiadási mezőn +50% (a Könyvelő ennek a felét engedi el).
"""

import random

from actions import add_log
from config import RULES, SEASON_GAP, SEASON_LENGTH

SEASONS = {
    "peak": {"name": "Csúcsszezon", "text": f"Minden bevételi mezőn +{RULES['season_income_boost']}%."},
    "blizzard": {"name": "Hóvihar", "text": "A felvonók zárva vannak."},
    "audit": {"name": "Ellenőrzés", "text": f"Minden kiadási mezőn +{RULES['season_expense_boost']}%."},
}


def active(game: dict, season_id: str) -> bool:
    season = game.get("season")
    return bool(season) and season["id"] == season_id


def new_round(game: dict) -> None:
    """Új kör: a lejárt esemény véget ér, és ha itt az ideje, új kezdődik."""
    game["round"] += 1
    season = game["season"]
    if season and game["round"] > season["until"]:
        add_log(game, f"Véget ért: {season['name']}.")
        game["season"] = None
    if game["season"] is None and game["round"] >= game["next_season"]:
        start(game, random.choice([s for s in SEASONS if s != game["last_season"]]))


def start(game: dict, season_id: str) -> bool:
    """Elindít egy szezoneseményt a mostani körtől véletlen hosszan (SEASON_LENGTH). Ha már tart egy,
    nem indít újat, és False-t ad vissza."""
    if game["season"]:
        return False
    length = random.randint(*SEASON_LENGTH)
    until = game["round"] + length - 1
    game["season"] = {
        "id": season_id,
        "seq": game["season_seq"] + 1,
        "until": until,
        "length": length,
        **SEASONS[season_id],
    }
    game["season_seq"] = game["season"]["seq"]
    game["last_season"] = season_id
    game["next_season"] = until + 1 + random.randint(*SEASON_GAP)
    add_log(game, f"Szezonesemény – {game['season']['name']}: {game['season']['text']} ({length} körig)")
    return True
