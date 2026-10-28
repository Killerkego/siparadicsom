"""Teljes játékok szimulálása 2, 3 és 4 játékossal (PDF 12.1 lezárhatóság, 12.2 játékteszt).
Egy egyszerű bot játszik: mindig a legolcsóbb megvehető elemet építi, a többi döntést véletlenül hozza.
Minden lépés után ellenőrzi, hogy a játékállapot szabályos marad; a végén kiírja, hány játék ért
véget győzelemmel és átlagosan hány kör alatt."""

import random
import sys
import unittest
from unittest import mock

from helpers import DICE_USERS, new_game, settle

import play
from config import BUILDING_BY_ID, BUILDINGS, FIELD_COUNT, RULES
from turns import acting_player

GAMES_PER_COUNT = 40
MAX_ROUNDS = 300  # ennyi teljes kör (mindenki egyszer) után a szimuláció feladja


def bot_choice(game, rng):
    pending = game["pending"]
    kind = pending["type"]
    if kind == "card":
        return "ok"
    if kind == "card_pick":
        return rng.choice(pending["options"])
    if kind == "build":
        return min(pending["options"], key=lambda b: pending["prices"][b])
    if kind == "gamble":
        return rng.choice(["yes", "no"])
    if kind == "lift":
        player = next(p for p in game["players"] if p["id"] == pending["player_id"])
        if player["money"] < RULES["lift_cost"]:
            return "no"
        return rng.choice([str(t) for t in pending["targets"]] + ["no"])
    if kind == "trap":
        return rng.choice(["back", "money"])
    raise AssertionError(f"ismeretlen döntés: {kind}")


def cards_in_play(game):
    """A pakliban, a dobott lapok között és a döntésre váró lapok együtt mindig a 40 lap."""
    held = []
    pending = game["pending"]
    if pending and pending["type"] == "card":
        held.append(pending["card"])
    if pending and pending["type"] == "card_pick":
        held.extend(pending["options"])
    return game["deck"] + game["discard"] + held


class SimulationTests(unittest.TestCase):
    def check_state(self, game):
        for p in game["players"]:
            self.assertGreaterEqual(p["money"], 0, "a pénz nem lehet negatív (pénzhiánynál hitel jön)")
            self.assertGreaterEqual(p["loan"], 0)
            self.assertTrue(0 <= p["position"] < FIELD_COUNT)
            self.assertEqual(len(p["buildings"]), len(set(p["buildings"])), "egy elem csak egyszer")
            for b in p["buildings"]:
                for r in BUILDING_BY_ID[b]["requires"]:
                    self.assertIn(r, p["buildings"][: p["buildings"].index(b)], "előfeltétel előbb")
            self.assertTrue(all(v >= 0 for v in p["effects"].values()))
        self.assertEqual(sorted(cards_in_play(game)), sorted(c for c in cards_in_play(game)))
        self.assertEqual(len(cards_in_play(game)), 40, "egy kártya sem veszhet el")
        if game["status"] == "finished":
            winner = next(p for p in game["players"] if p["id"] == game["winner_id"])
            self.assertEqual(len(winner["buildings"]), len(BUILDINGS))
            self.assertGreaterEqual(winner["money"], RULES["win_money"])
            self.assertEqual(winner["loan"], 0)

    def play_game(self, players, seed):
        rng = random.Random(seed)
        roll = lambda: rng.randint(1, 6)  # noqa: E731
        patches = [mock.patch(target, roll) for target in DICE_USERS]
        for p in patches:
            p.start()
        try:
            game, ids = new_game(players)
            turns = 0
            while game["status"] == "playing" and turns < MAX_ROUNDS * players:
                player = acting_player(game, game["players"][game["turn"]]["id"])
                play.roll(game, player)
                settle(game)
                self.check_state(game)
                while game["pending"] and game["status"] == "playing":
                    chooser = next(p for p in game["players"] if p["id"] == game["pending"]["player_id"])
                    play.choose(game, chooser, bot_choice(game, rng))
                    settle(game)
                    self.check_state(game)
                turns += 1
            return game, turns
        finally:
            for p in patches:
                p.stop()

    def test_full_games_with_2_3_and_4_players(self):
        summary = []
        for players in (2, 3, 4):
            finished, rounds = 0, []
            for seed in range(GAMES_PER_COUNT):
                with self.subTest(players=players, seed=seed):
                    game, turns = self.play_game(players, seed)
                    if game["status"] == "finished":
                        finished += 1
                        rounds.append(turns / players)
            avg = sum(rounds) / len(rounds) if rounds else 0
            summary.append(
                f"{players} játékos: {finished}/{GAMES_PER_COUNT} játék ért véget győzelemmel, "
                f"átlagosan {avg:.0f} kör alatt (min {min(rounds, default=0):.0f}, max {max(rounds, default=0):.0f})"
            )
            self.assertEqual(finished, GAMES_PER_COUNT, f"{players} játékossal nem minden játék zárult le")
        print("\n" + "\n".join(summary), file=sys.stderr)


if __name__ == "__main__":
    unittest.main()
