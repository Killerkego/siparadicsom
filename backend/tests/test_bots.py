"""Gépi játékosok: hozzáadás a lobbiban, döntések, és hogy egy teljes játszmát végig tudnak játszani."""

import unittest
from unittest import mock

from fastapi import HTTPException

from helpers import new_lobby, run

import bots
import main
import play
from config import BUILDINGS, MAX_PLAYERS
from schemas import PlayerRef
from store import games


def add_bot(game, host_id):
    return run(main.add_bot(game["code"], PlayerRef(player_id=host_id)))


@mock.patch("bots.kick")  # a tesztben kézzel léptetjük őket, nem a háttérben
class BotTests(unittest.TestCase):
    def test_host_adds_and_removes_bots(self, _):
        game, ids = new_lobby(1)
        add_bot(game, ids[0])
        add_bot(game, ids[0])
        names = [p["name"] for p in game["players"][1:]]
        self.assertEqual(len(set(names)), 2, "a gépi játékosok neve különbözik")
        self.assertTrue(all(bots.is_bot(p) for p in game["players"][1:]))
        self.assertEqual(len({p["figure"] for p in game["players"]}), 3, "a bábuk is különböznek")
        bot_id = game["players"][1]["id"]
        run(main.remove_bot(game["code"], bot_id, PlayerRef(player_id=ids[0])))
        self.assertNotIn(bot_id, [p["id"] for p in game["players"]])

    def test_only_host_adds_bots_and_not_over_the_limit(self, _):
        game, ids = new_lobby(2)
        with self.assertRaises(HTTPException) as err:
            add_bot(game, ids[1])
        self.assertEqual(err.exception.status_code, 403)
        for _ in range(MAX_PLAYERS - 2):
            add_bot(game, ids[0])
        with self.assertRaises(HTTPException) as err:
            add_bot(game, ids[0])
        self.assertEqual(err.exception.status_code, 409)

    def test_one_player_and_a_bot_can_start(self, _):
        game, ids = new_lobby(1)
        add_bot(game, ids[0])
        run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        self.assertEqual(game["status"], "playing")

    def test_game_ends_when_only_bots_are_left(self, _):
        game, ids = new_lobby(1)
        add_bot(game, ids[0])
        run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        run(main.leave_game(game["code"], PlayerRef(player_id=ids[0])))
        self.assertNotIn(game["code"], games)

    def test_bot_only_moves_on_its_own_turn(self, _):
        game, ids = new_lobby(1)
        add_bot(game, ids[0])
        run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        self.assertFalse(bots.step(game), "az ember következik, a gép nem lép")

    def test_bot_repays_its_loan_before_rolling(self, _):
        game, ids = new_lobby(1)
        add_bot(game, ids[0])
        run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        game["turn"] = 1
        bot = game["players"][1]
        bot["loan"], bot["money"] = 1100, 5000
        self.assertTrue(bots.wants_to_repay(bot))
        self.assertTrue(bots.step(game))
        self.assertEqual(bot["loan"], 0)
        # ha nem tudná az egészet kifizetni tartalékkal, nem törleszt (a START-on úgyis megteszi)
        bot["loan"], bot["money"] = 4000, 5000
        self.assertFalse(bots.wants_to_repay(bot))

    def test_bots_play_a_whole_game(self, _):
        """Egy ember és három gép; az ember helyett is a gépi döntés lép. Valaki nyerjen, senki ne akadjon el."""
        for _round in range(3):
            with self.subTest(game=_round):
                game, ids = new_lobby(1)
                for _ in range(3):
                    add_bot(game, ids[0])
                run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
                for _ in range(20000):
                    if game["status"] == "finished":
                        break
                    if not bots.step(game):
                        human = game["players"][game["turn"]]
                        action, choice = bots.decide(game, human)
                        if action == "roll":
                            play.roll(game, human)
                        else:
                            play.choose(game, human, choice)
                self.assertEqual(game["status"], "finished", "a játszma véget ér")
                winner = next(p for p in game["players"] if p["id"] == game["winner_id"])
                self.assertEqual(len(winner["buildings"]), len(BUILDINGS))


if __name__ == "__main__":
    unittest.main()
