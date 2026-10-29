"""Szezonesemények: mikor jönnek és meddig tartanak, és mit csinál a Csúcsszezon, a Hóvihar és az Ellenőrzés.
Futtatás a backend mappából: .venv/Scripts/python -m unittest discover -s tests -v"""

import unittest

from helpers import current, field_id, new_game

import fields
import seasons
import turns
from config import RULES, SEASON_FIRST_ROUND, SEASON_LENGTH
from store import public_state


def put(player, field):
    player["position"] = field


def end_rounds(game, count):
    """`count` teljes kör eltelik (mindenki egyszer sorra kerül)."""
    for _ in range(count * len(game["players"])):
        turns.next_player(game)


class SeasonScheduleTests(unittest.TestCase):
    def test_round_counter_advances_when_everyone_had_a_turn(self):
        game, _ = new_game(3)
        self.assertEqual(game["round"], 1)
        turns.next_player(game)
        turns.next_player(game)
        self.assertEqual(game["round"], 1)
        turns.next_player(game)  # vissza a kezdőjátékoshoz
        self.assertEqual(game["round"], 2)

    def test_skipped_player_still_counts_the_round(self):
        game, _ = new_game(2)
        game["players"][0]["effects"]["skip_turns"] = 1
        turns.next_player(game)  # a 2. játékos jön
        turns.next_player(game)  # az 1. kimarad: új kör, és újra a 2. jön
        self.assertEqual(game["round"], 2)
        self.assertEqual(game["turn"], 1)

    def test_first_season_comes_on_time_and_lasts(self):
        game, _ = new_game(2)
        end_rounds(game, SEASON_FIRST_ROUND - 2)
        self.assertIsNone(game["season"], "az első esemény előtt nyugalom van")
        end_rounds(game, 1)
        self.assertEqual(game["round"], SEASON_FIRST_ROUND)
        season = game["season"]
        self.assertIn(season["id"], seasons.SEASONS)
        self.assertTrue(season["name"] and season["text"])
        end_rounds(game, season["length"] - 1)
        self.assertEqual(game["season"], season, f"{season['length']} körig tart")
        end_rounds(game, 1)
        self.assertIsNone(game["season"], "utána véget ér")

    def test_season_length_is_random_within_limits(self):
        lengths = set()
        for _ in range(60):
            game, _ = new_game(2)
            seasons.start(game, "peak")
            season = game["season"]
            self.assertEqual(season["until"], game["round"] + season["length"] - 1)
            lengths.add(season["length"])
        self.assertEqual(lengths, set(range(SEASON_LENGTH[0], SEASON_LENGTH[1] + 1)), "minden hossz előfordul")

    def test_no_new_season_while_one_is_running(self):
        game, _ = new_game(2)
        self.assertTrue(seasons.start(game, "blizzard"))
        season = dict(game["season"])
        self.assertFalse(seasons.start(game, "peak"), "amíg tart, újat nem lehet indítani")
        self.assertEqual(game["season"], season)
        game["next_season"] = 0  # akkor sem jön új, ha a menetrend szerint már esedékes lenne
        while game["round"] < season["until"]:
            end_rounds(game, 1)
            self.assertEqual(game["season"]["seq"], season["seq"])

    def test_season_kind_is_random(self):
        kinds = set()
        for _ in range(40):
            game, _ = new_game(2)
            end_rounds(game, SEASON_FIRST_ROUND - 1)
            kinds.add(game["season"]["id"])
        self.assertEqual(kinds, set(seasons.SEASONS), "bármelyik esemény jöhet elsőnek")

    def test_seasons_keep_coming_and_never_repeat_twice_in_a_row(self):
        game, _ = new_game(2)
        seen = []
        for _ in range(60):
            end_rounds(game, 1)
            season = game["season"]
            if season and (not seen or seen[-1]["seq"] != season["seq"]):
                seen.append(season)
        self.assertGreaterEqual(len(seen), 8, "sok kör alatt többször is jön esemény")
        for a, b in zip(seen, seen[1:]):
            self.assertNotEqual(a["id"], b["id"])
            self.assertGreater(b["seq"], a["seq"])
        self.assertEqual({s["id"] for s in seen}, set(seasons.SEASONS), "mind a három előfordul")

    def test_season_is_in_the_public_state(self):
        game, _ = new_game(2)
        seasons.start(game, "peak")
        state = public_state(game)
        self.assertEqual(state["season"]["id"], "peak")
        self.assertEqual(state["round"], game["round"])


class SeasonEffectTests(unittest.TestCase):
    def land(self, game, kind):
        player = current(game)
        put(player, field_id(kind))
        fields.land(game, player, [])
        return player

    def test_peak_season_boosts_income_fields(self):
        game, _ = new_game(2)
        seasons.start(game, "peak")
        player = self.land(game, "bevetel")
        boosted = RULES["income_field"] * (100 + RULES["season_income_boost"]) // 100
        self.assertEqual(player["money"], RULES["start_money"] + boosted)
        self.assertIn("Csúcsszezon", game["field_event"]["note"])

    def test_peak_season_stacks_with_season_party_card(self):
        game, _ = new_game(2)
        seasons.start(game, "peak")
        player = current(game)
        player["effects"]["income_boost"] = 1
        self.land(game, "bevetel")
        boosted = RULES["income_field"] * (100 + RULES["season_income_boost"]) // 100 * 3 // 2
        self.assertEqual(player["money"], RULES["start_money"] + boosted)

    def test_audit_makes_expense_fields_dearer(self):
        game, _ = new_game(2)
        seasons.start(game, "audit")
        player = self.land(game, "kiadas")
        dearer = RULES["expense_field"] * (100 + RULES["season_expense_boost"]) // 100
        self.assertEqual(player["money"], RULES["start_money"] - dearer)

    def test_accountant_halves_the_audit_price(self):
        game, _ = new_game(2)
        seasons.start(game, "audit")
        player = current(game)
        player["effects"]["expense_half"] = 1
        self.land(game, "kiadas")
        dearer = RULES["expense_field"] * (100 + RULES["season_expense_boost"]) // 100
        self.assertEqual(player["money"], RULES["start_money"] - dearer // 2)

    def test_blizzard_closes_the_lifts(self):
        game, _ = new_game(2)
        seasons.start(game, "blizzard")
        self.land(game, "felvono")
        self.assertIsNone(game["pending"], "nincs felvonós döntés")
        self.assertIn("Hóvihar", game["log"][-1])

    def test_effects_stop_after_the_season(self):
        game, _ = new_game(2)
        seasons.start(game, "blizzard")
        end_rounds(game, game["season"]["length"])
        self.assertIsNone(game["season"])
        self.land(game, "felvono")
        self.assertEqual(game["pending"]["type"], "lift")

    def test_other_seasons_do_not_change_fields(self):
        game, _ = new_game(2)
        seasons.start(game, "blizzard")
        player = self.land(game, "bevetel")
        self.assertEqual(player["money"], RULES["start_money"] + RULES["income_field"])


if __name__ == "__main__":
    unittest.main()
