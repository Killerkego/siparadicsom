"""A feladatleírás (PDF 12.2 és I/14) ellenőrzési pontjai, egyenként: indítás, bábuk, dobás és mozgás,
START, mezők, kártyák, pénzhiány, építkezés, kimaradás, győzelem és új játék.
Futtatás a backend mappából: .venv/Scripts/python -m unittest discover -s tests -v"""

import copy
import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from helpers import current, dice_rolls, field_id, new_game, new_lobby, run, settle

import cards
import fields
import main
import play
from config import BOARD, BUILDING_BY_ID, BUILDINGS, FIELD_COUNT, MAX_PLAYERS, RULES
from stories import FIELD_STORIES
from deck import CARDS
from schemas import FigureIn, PlayerIn, PlayerRef, VisibilityIn


def roll(game, player, value):
    """A soron lévő játékos dob (a végponton át, ahogy a böngésző), a kocka értéke `value`."""
    with dice_rolls(value):
        run(main.roll_dice(game["code"], PlayerRef(player_id=player["id"])))
    settle(game)


def finish_pending(game):
    """A függő döntéseket a legegyszerűbben lezárja (nem épít, nem kockáztat, nem száll fel)."""
    answers = {"card": "ok", "build": "no", "gamble": "no", "lift": "no", "trap": "back"}
    while game["pending"]:
        pending = game["pending"]
        choice = answers.get(pending["type"]) or pending["options"][0]
        player = next(p for p in game["players"] if p["id"] == pending["player_id"])
        play.choose(game, player, choice)
        settle(game)


def put(player, field):
    player["position"] = field


class StartTests(unittest.TestCase):
    """Játékindítás 2, 3 és 4 játékossal; azonos kezdőfeltételek."""

    def test_start_with_2_3_and_4_players(self):
        for count in (2, 3, 4):
            with self.subTest(players=count):
                game, ids = new_game(count)
                self.assertEqual(game["status"], "playing")
                self.assertEqual([p["id"] for p in game["players"]], ids)
                self.assertEqual(game["turn"], 0, "a házigazda kezd")
                for p in game["players"]:
                    self.assertEqual(p["money"], RULES["start_money"])
                    self.assertEqual(p["position"], 0, "mindenki a START-ról indul")
                    self.assertEqual(p["buildings"], [])
                    self.assertEqual(p["loan"], 0)
                self.assertEqual(len(game["deck"]), 40, "a 40 lapos pakli inicializálva")
                self.assertEqual(len(set(game["deck"])), 40)

    def test_one_player_cannot_start(self):
        game, ids = new_lobby(1)
        with self.assertRaises(HTTPException) as err:
            run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        self.assertEqual(err.exception.status_code, 409)

    def test_fifth_player_cannot_join(self):
        game, _ = new_lobby(MAX_PLAYERS)
        with self.assertRaises(HTTPException) as err:
            run(main.join_game(game["code"], PlayerIn(name="Ötödik")))
        self.assertEqual(err.exception.status_code, 409)

    def test_only_host_can_start(self):
        game, ids = new_lobby(2)
        with self.assertRaises(HTTPException) as err:
            run(main.start_game(game["code"], PlayerRef(player_id=ids[1])))
        self.assertEqual(err.exception.status_code, 403)

    def test_name_is_required_and_unique(self):
        with self.assertRaises(ValidationError):
            PlayerIn(name="   ")
        game, _ = new_lobby(2)
        with self.assertRaises(HTTPException):
            run(main.join_game(game["code"], PlayerIn(name="játékos 2")))


class LobbyListTests(unittest.TestCase):
    """Nyilvános és privát lobbik: a listában csak a várakozó nyilvános játékok szerepelnek."""

    def listed(self):
        return {lobby["code"] for lobby in run(main.list_games())["lobbies"]}

    def test_public_lobby_is_listed_private_is_not(self):
        public, _ = new_lobby(2, public=True)
        private, _ = new_lobby(1)
        self.assertIn(public["code"], self.listed())
        self.assertNotIn(private["code"], self.listed(), "privátba csak kóddal lehet belépni")
        lobby = next(x for x in run(main.list_games())["lobbies"] if x["code"] == public["code"])
        self.assertEqual((lobby["host"], lobby["players"], lobby["max_players"]), ("Játékos 1", 2, MAX_PLAYERS))

    def test_private_lobby_can_be_joined_with_code(self):
        game, _ = new_lobby(1)
        run(main.join_game(game["code"], PlayerIn(name="Kóddal")))
        self.assertEqual(len(game["players"]), 2)

    def test_started_game_is_not_listed(self):
        game, ids = new_lobby(2, public=True)
        run(main.start_game(game["code"], PlayerRef(player_id=ids[0])))
        self.assertNotIn(game["code"], self.listed())

    def test_only_host_can_change_visibility(self):
        game, ids = new_lobby(2)
        with self.assertRaises(HTTPException) as err:
            run(main.set_visibility(game["code"], VisibilityIn(player_id=ids[1], public=True)))
        self.assertEqual(err.exception.status_code, 403)
        run(main.set_visibility(game["code"], VisibilityIn(player_id=ids[0], public=True)))
        self.assertIn(game["code"], self.listed())


class FigureTests(unittest.TestCase):
    """Bábuk: mindenkinek más figura és szín jut, foglalt bábut nem lehet választani."""

    def test_players_get_different_figures_and_colors(self):
        game, _ = new_lobby(4)
        self.assertEqual(len({p["figure"] for p in game["players"]}), 4)
        self.assertEqual(len({p["color"] for p in game["players"]}), 4)

    def test_taken_figure_is_rejected(self):
        game, ids = new_lobby(2)
        taken = game["players"][0]["figure"]
        with self.assertRaises(HTTPException) as err:
            run(main.choose_figure(game["code"], FigureIn(player_id=ids[1], figure=taken)))
        self.assertEqual(err.exception.status_code, 409)


class DiceAndMovementTests(unittest.TestCase):
    """Dobókocka és mozgás: csak a soron lévő dobhat, egyszer, pontosan annyit lép."""

    def test_moves_exactly_the_rolled_value(self):
        for value in range(1, 7):
            with self.subTest(dice=value):
                game, _ = new_game(2)
                player = current(game)
                put(player, 7)  # kiadási mező előtt, a 8-14 között nincs mozgató mező 6-on belül sem
                roll(game, player, value)
                self.assertEqual(player["position"], 7 + value)

    def test_dice_values_are_1_to_6(self):
        from actions import dice

        values = {dice() for _ in range(2000)}
        self.assertEqual(values, {1, 2, 3, 4, 5, 6})

    def test_only_current_player_can_roll(self):
        game, ids = new_game(2)
        with self.assertRaises(HTTPException) as err:
            run(main.roll_dice(game["code"], PlayerRef(player_id=ids[1])))
        self.assertEqual(err.exception.status_code, 403)

    def test_only_one_roll_per_turn(self):
        game, ids = new_game(2)
        roll(game, game["players"][0], 1)  # #1 bevételi mező, a kör végén építkezés jöhet
        with self.assertRaises(HTTPException):
            with dice_rolls(1):
                run(main.roll_dice(game["code"], PlayerRef(player_id=ids[0])))

    def test_no_roll_while_animation_runs(self):
        game, ids = new_game(2)
        player = current(game)
        player["money"] = 0  # nincs megvehető elem: a kör a dobás után azonnal véget ér
        put(player, 7)
        with dice_rolls(1):
            run(main.roll_dice(game["code"], PlayerRef(player_id=ids[0])))
        self.assertEqual(current(game)["id"], ids[1])
        with self.assertRaises(HTTPException) as err:
            run(main.roll_dice(game["code"], PlayerRef(player_id=ids[1])))
        self.assertEqual(err.exception.status_code, 409)

    def test_turn_passes_to_next_player(self):
        game, _ = new_game(3)
        for expected in (1, 2, 0):
            player = current(game)
            put(player, 7)
            roll(game, player, 1)  # #8 semleges
            finish_pending(game)
            self.assertEqual(game["turn"], expected)

    def test_wraps_around_the_board(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, 38)
        roll(game, player, 4)
        self.assertEqual(player["position"], 2)
        self.assertTrue(0 <= player["position"] < FIELD_COUNT)


class StartBonusTests(unittest.TestCase):
    """START: áthaladásért és megállásért jár a bónusz, a kezdő elhelyezésért nem."""

    def test_no_bonus_at_game_start(self):
        game, _ = new_game(2)
        self.assertTrue(all(p["money"] == RULES["start_money"] for p in game["players"]))

    def test_bonus_when_passing_start(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, 38)
        roll(game, player, 4)  # #2 kártyahúzó: a lap hatása előtt nézzük
        self.assertEqual(player["money"], RULES["start_money"] + RULES["start_bonus"])

    def test_bonus_when_landing_on_start(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, 36)
        roll(game, player, 4)
        self.assertEqual(player["position"], 0)
        self.assertEqual(player["money"], RULES["start_money"] + RULES["start_bonus"])

    def test_bonus_only_once_per_pass(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, 39)
        roll(game, player, 2)  # #1 bevételi
        self.assertEqual(player["money"], RULES["start_money"] + RULES["start_bonus"] + RULES["income_field"])


class FieldTests(unittest.TestCase):
    """A kötelező és a speciális mezők hatása."""

    def land_on(self, kind, players=2):
        game, _ = new_game(players)
        player = current(game)
        put(player, field_id(kind))
        fields.land(game, player, [])
        return game, player

    def test_income_field(self):
        game, player = self.land_on("bevetel")
        self.assertEqual(player["money"], RULES["start_money"] + RULES["income_field"])

    def test_expense_field(self):
        game, player = self.land_on("kiadas")
        self.assertEqual(player["money"], RULES["start_money"] - RULES["expense_field"])

    def test_income_and_expense_fields_tell_a_story(self):
        for kind, sign in (("bevetel", 1), ("kiadas", -1)):
            for field in [f["id"] for f in BOARD if f["type"] == kind]:
                with self.subTest(field=field):
                    self.assertTrue(FIELD_STORIES.get(field), "minden bevételi/kiadási mezőhöz van történet")
                    game, _ = new_game(2)
                    player = current(game)
                    put(player, field)
                    fields.land(game, player, [])
                    event = game["field_event"]
                    self.assertEqual((event["field"], event["player_id"]), (field, player["id"]))
                    self.assertIn(event["story"], FIELD_STORIES[field])
                    self.assertEqual(event["amount"], sign * RULES["income_field" if sign > 0 else "expense_field"])

    def test_neutral_field(self):
        game, player = self.land_on("semleges")
        self.assertEqual(player["money"], RULES["start_money"])
        self.assertIsNone(game["pending"])

    def test_card_field_draws_a_card(self):
        game, player = self.land_on("kartya")
        self.assertEqual(game["pending"]["type"], "card")
        self.assertEqual(len(game["deck"]), 39)

    def test_purchase_field_gives_discount(self):
        game, player = self.land_on("vasarlas")
        play.finish_turn(game, player)
        pending = game["pending"]
        self.assertEqual(pending["type"], "build")
        self.assertEqual(pending["discount"], RULES["shop_discount"])
        palya = BUILDING_BY_ID["palya"]
        self.assertEqual(pending["prices"]["palya"], palya["price"] * (100 - RULES["shop_discount"]) // 100)

    def test_school(self):
        game, player = self.land_on("oktatas")
        self.assertTrue(player["in_school"])
        play.finish_turn(game, player)
        finish_pending(game)
        # páratlannal marad és megkapja a fix összeget, párossal továbbmehet
        while current(game) is not player:
            other = current(game)
            put(other, 7)
            roll(game, other, 1)
            finish_pending(game)
        money = player["money"]
        roll(game, player, 3)
        self.assertEqual(player["position"], field_id("oktatas"))
        self.assertEqual(player["money"], money + RULES["school_pay"])
        finish_pending(game)
        while current(game) is not player:
            other = current(game)
            put(other, 7)
            roll(game, other, 1)
            finish_pending(game)
        roll(game, player, 2)
        self.assertFalse(player["in_school"])
        self.assertEqual(player["position"], field_id("oktatas") + 2)

    def test_ski_race(self):
        game, _ = new_game(3)
        player = current(game)
        put(player, field_id("siverseny"))
        with dice_rolls(2, 6, 4):  # a második játékos nyer
            fields.land(game, player, [])
        self.assertEqual(game["players"][1]["money"], RULES["start_money"] + RULES["race_prize"])

    def test_ski_race_tie_is_rerolled(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, field_id("siverseny"))
        with dice_rolls(5, 5, 1, 3):
            fields.land(game, player, [])
        self.assertEqual(game["players"][1]["money"], RULES["start_money"] + RULES["race_prize"])

    def test_gamble_win(self):
        game, player = self.land_on("gambling")
        with dice_rolls(5):
            play.choose(game, player, "yes")
        self.assertEqual(player["money"], RULES["start_money"] + RULES["gamble_prize"])

    def test_gamble_loss_lands_on_expense_field(self):
        for gamble in [f["id"] for f in BOARD if f.get("special") == "gambling"]:
            with self.subTest(field=gamble):
                game, _ = new_game(2)
                player = current(game)
                put(player, gamble)
                fields.land(game, player, [])
                with dice_rolls(2):
                    play.choose(game, player, "yes")
                target = (gamble - RULES["gamble_back"]) % FIELD_COUNT
                self.assertEqual(player["position"], target)
                self.assertEqual(BOARD[target]["type"], "kiadas")
                self.assertEqual(player["money"], RULES["start_money"] - RULES["expense_field"])

    def test_gamble_refused_is_neutral(self):
        game, player = self.land_on("gambling")
        play.choose(game, player, "no")
        self.assertEqual(player["money"], RULES["start_money"])
        self.assertEqual(player["position"], field_id("gambling"))

    def test_lift(self):
        game, player = self.land_on("felvono")
        targets = game["pending"]["targets"]
        self.assertNotIn(field_id("felvono"), targets)
        play.choose(game, player, str(targets[0]))
        self.assertEqual(player["position"], targets[0])
        self.assertEqual(player["money"], RULES["start_money"] - RULES["lift_cost"])

    def test_lift_without_money_is_refused(self):
        game, player = self.land_on("felvono")
        player["money"] = RULES["lift_cost"] - 1
        with self.assertRaises(HTTPException):
            play.choose(game, player, str(game["pending"]["targets"][0]))

    def test_trap_back_lands_on_expense_field(self):
        for trap in [f["id"] for f in BOARD if f.get("special") == "csapda"]:
            with self.subTest(field=trap):
                game, _ = new_game(2)
                owner, victim = game["players"]
                put(owner, trap)
                fields.land(game, owner, [])
                play.choose(game, owner, "back")
                put(victim, trap)
                fields.land(game, victim, [])
                target = (trap - RULES["trap_back"]) % FIELD_COUNT
                self.assertEqual(victim["position"], target)
                self.assertEqual(BOARD[target]["type"], "kiadas")
                self.assertEqual(victim["money"], RULES["start_money"] - RULES["expense_field"])
                self.assertNotIn(str(trap), game["traps"], "a csapda elsül és eltűnik")

    def test_trap_money(self):
        game, _ = new_game(2)
        owner, victim = game["players"]
        trap = field_id("csapda")
        put(owner, trap)
        fields.land(game, owner, [])
        play.choose(game, owner, "money")
        put(victim, trap)
        fields.land(game, victim, [])
        self.assertEqual(victim["money"], RULES["start_money"] - RULES["trap_money"])
        self.assertEqual(owner["money"], RULES["start_money"] + RULES["trap_money"])
        event = game["trap_event"]
        self.assertEqual(
            (event["field"], event["owner_id"], event["victim_id"], event["kind"]),
            (trap, owner["id"], victim["id"], "money"),
            "a lerakó értesítést kap",
        )

    def test_own_trap_does_not_fire(self):
        game, _ = new_game(2)
        owner = game["players"][0]
        trap = field_id("csapda")
        put(owner, trap)
        fields.land(game, owner, [])
        play.choose(game, owner, "back")
        game["pending"] = None
        fields.land(game, owner, [])
        self.assertEqual(owner["position"], trap)
        self.assertEqual(game["pending"]["type"], "trap")

    def test_every_field_has_a_function(self):
        known = {"start", "bevetel", "kiadas", "kartya", "vasarlas", "semleges"}
        for f in BOARD:
            self.assertTrue(f["type"] in known or f.get("special") in fields.SPECIAL_FIELDS, f)
        self.assertEqual(len(BOARD), 40)
        self.assertGreaterEqual(sum(f["type"] == "kartya" for f in BOARD), 4)
        self.assertGreaterEqual(len({f["special"] for f in BOARD if f.get("special")}), 3)


def snapshot(game):
    """A játékosok állapota (pénz, hely, hitel, épületek, kártyahatások) és a csapdák."""
    keys = ("money", "position", "loan", "buildings", "effects", "in_school")
    return copy.deepcopy([{k: p[k] for k in keys} for p in game["players"]] + [game["traps"]])


class CardTests(unittest.TestCase):
    """Mind a 40 eseménykártya: megvan a kötelező elosztás, és mindegyiknek tényleges hatása van."""

    def test_card_categories(self):
        kinds = [c["kind"] for c in CARDS]
        self.assertEqual(len(CARDS), 40)
        self.assertEqual(len({c["id"] for c in CARDS}), 40)
        self.assertEqual(kinds.count("nyeremeny"), 12)
        self.assertEqual(kinds.count("veszteseg"), 12)
        self.assertEqual(kinds.count("elony"), 8)
        self.assertEqual(kinds.count("hatrany"), 8)
        self.assertTrue(all(c["text"] for c in CARDS))

    def draw(self, card_id, players=3):
        """A soron lévő játékos kártyahúzó mezőre lép, a pakli tetején `card_id` van; elfogadja."""
        game, _ = new_game(players)
        # változatos helyzet: van épület, és van, akinek több van
        game["players"][0]["buildings"] = ["palya"]
        game["players"][1]["buildings"] = ["palya", "szalloda"]
        player = current(game)
        put(player, field_id("kartya"))
        game["deck"].remove(card_id)
        game["deck"].insert(0, card_id)
        before = snapshot(game)
        with dice_rolls(1, 1, 1, 1):  # a Rulett dob (a Jósnő két lapja között is lehet)
            fields.land(game, player, [])
            self.assertEqual(game["pending"]["card"], card_id)
            play.choose(game, player, "ok")
            if game["pending"] and game["pending"]["type"] == "card_pick":
                play.choose(game, player, game["pending"]["options"][0])
        return game, player, before

    def test_every_card_has_a_real_effect(self):
        for card in CARDS:
            with self.subTest(card=f"{card['id']} {card['name']}"):
                game, player, before = self.draw(card["id"])
                if card["id"] == "E02":  # Üres felvonó: még egyszer dobhat
                    self.assertIs(current(game), player)
                    self.assertIsNone(game["pending"])
                    continue
                if card["id"] == "H03":  # IT-lefagyás: a mostani kör végi vásárlás elmarad
                    self.assertIsNone(game["pending"], "nem kap építési lehetőséget")
                    self.assertTrue(any("nem vásárolhat" in line for line in game["log"]))
                    continue
                self.assertNotEqual(snapshot(game), before, "a kártya semmit nem változtatott")

    def test_extra_roll_card(self):
        game, player, _ = self.draw("E02")
        roll(game, player, 1)  # nem dob hibát: még egyszer dobhat
        self.assertEqual(player["position"], field_id("kartya") + 1)

    def test_skip_turn_card(self):
        game, player, _ = self.draw("H01", players=2)  # Elakadás: kimarad egy körből
        finish_pending(game)
        other = current(game)
        self.assertIsNot(other, player)
        put(other, 7)
        roll(game, other, 1)
        finish_pending(game)
        self.assertIs(current(game), other, "a kimaradó játékost átugrottuk")
        self.assertEqual(player["effects"]["skip_turns"], 0)

    def test_back_card_does_not_trigger_new_field(self):
        game, player, before = self.draw("H02")  # Lavinaösvény: 3 mező vissza
        self.assertEqual(player["position"], (field_id("kartya") - 3) % FIELD_COUNT)

    def test_loyal_guest_cancels_next_bad_card(self):
        game, _ = new_game(2)
        player = current(game)
        player["effects"]["shield_bad"] = 3
        put(player, field_id("kartya"))
        game["deck"].remove("V01")
        game["deck"].insert(0, "V01")
        fields.land(game, player, [])
        self.assertTrue(game["pending"]["blocked_by"])
        play.choose(game, player, "ok")
        self.assertEqual(player["money"], RULES["start_money"])

    def test_fortune_teller_pick(self):
        game, _ = new_game(2)
        player = current(game)
        put(player, field_id("kartya"))
        for cid in ("N01", "V01", "E08"):
            game["deck"].remove(cid)
            game["deck"].insert(0, cid)
        fields.land(game, player, [])
        play.choose(game, player, "ok")
        pending = game["pending"]
        self.assertEqual(pending["type"], "card_pick")
        self.assertEqual(set(pending["options"]), {"N01", "V01"})
        play.choose(game, player, "N01")
        self.assertGreater(player["money"], RULES["start_money"])
        self.assertEqual(game["deck"][-1], "V01", "a másik lap a pakli aljára került")

    def test_deck_does_not_repeat_until_empty_then_reshuffles(self):
        game, _ = new_game(2)
        drawn = []
        for _ in range(40):
            card = cards.take(game)
            drawn.append(card)
            game["discard"].append(card)
        self.assertEqual(len(set(drawn)), 40)
        self.assertEqual(game["deck"], [])
        again = cards.take(game)
        self.assertIn(again, drawn)
        self.assertEqual(len(game["deck"]), 39)


class MoneyShortageTests(unittest.TestCase):
    """Pénzhiány: a bank hitelt ad kamattal, a START-on törleszt, hitellel nem lehet nyerni."""

    def test_loan_when_money_runs_out(self):
        game, _ = new_game(2)
        player = current(game)
        player["money"] = 100
        put(player, field_id("kiadas"))
        fields.land(game, player, [])
        unit = RULES["loan_unit"]
        borrowed = -(-(RULES["expense_field"] - 100) // unit) * unit  # a hiány, egész egységekre kerekítve
        self.assertGreaterEqual(player["money"], 0)
        self.assertEqual(player["money"], 100 + borrowed - RULES["expense_field"])
        self.assertEqual(player["loan"], borrowed * (100 + RULES["loan_interest"]) // 100)

    def test_loan_is_repaid_at_start(self):
        game, _ = new_game(2)
        player = current(game)
        player["loan"] = 1100
        player["money"] = 500
        put(player, 38)
        roll(game, player, 3)  # START-on át a #1 bevételi mezőre
        self.assertEqual(player["loan"], 0)
        self.assertEqual(player["money"], 500 + RULES["start_bonus"] - 1100 + RULES["income_field"])

    def test_money_never_negative(self):
        game, _ = new_game(2)
        player = current(game)
        player["money"] = 0
        cards.charge(game, player, 4321)
        self.assertGreaterEqual(player["money"], 0)
        self.assertGreater(player["loan"], 0)


class BuildingTests(unittest.TestCase):
    """Építkezés: vásárlási feltételek, előfeltételek, körönként egy elem, visszajelzés."""

    def build_turn(self, money=None, owned=(), field=None):
        game, _ = new_game(2)
        player = current(game)
        if money is not None:
            player["money"] = money
        player["buildings"] = list(owned)
        put(player, field if field is not None else field_id("semleges"))
        play.finish_turn(game, player)
        return game, player

    def test_eight_elements_with_prerequisites(self):
        self.assertEqual(len(BUILDINGS), 8)
        self.assertGreaterEqual(sum(bool(b["requires"]) for b in BUILDINGS), 2)
        total = sum(b["price"] for b in BUILDINGS)
        share = RULES["start_money"] / total
        self.assertTrue(0.2 <= share <= 0.3, f"kezdőtőke {share:.0%}")
        self.assertGreaterEqual(RULES["start_money"], min(b["price"] for b in BUILDINGS))

    def test_successful_purchase(self):
        game, player = self.build_turn()
        play.choose(game, player, "palya")
        self.assertIn("palya", player["buildings"])
        self.assertEqual(player["money"], RULES["start_money"] - BUILDING_BY_ID["palya"]["price"])
        self.assertIsNone(game["pending"])
        self.assertIsNot(current(game), player, "egy vásárlás után a kör véget ér")

    def test_not_enough_money(self):
        # a Pályarendszerre éppen elég, a Szállodára nem
        game, player = self.build_turn(money=BUILDING_BY_ID["palya"]["price"] + 100)
        self.assertIn("szalloda", game["pending"]["blocked"])
        self.assertIn("Nincs elég pénzed", game["pending"]["blocked"]["szalloda"])
        with self.assertRaises(HTTPException) as err:
            play.choose(game, player, "szalloda")
        self.assertEqual(err.exception.status_code, 409)

    def test_missing_prerequisite(self):
        game, player = self.build_turn()
        self.assertIn("Előfeltétel", game["pending"]["blocked"]["felvono"])
        with self.assertRaises(HTTPException):
            play.choose(game, player, "felvono")

    def test_already_owned(self):
        game, player = self.build_turn(owned=["palya"])
        self.assertNotIn("palya", game["pending"]["options"])
        with self.assertRaises(HTTPException):
            play.choose(game, player, "palya")

    def test_prerequisite_unlocks(self):
        game, player = self.build_turn(money=20000, owned=["palya"])
        self.assertIn("felvono", game["pending"]["options"])

    def test_no_buildable_element_skips_decision(self):
        game, player = self.build_turn(money=100)
        self.assertIsNone(game["pending"])
        self.assertIn("nem tud építeni", game["log"][-1])

    def test_purchase_discount_applies(self):
        game, player = self.build_turn(field=field_id("vasarlas"))
        play.choose(game, player, "szalloda")
        price = BUILDING_BY_ID["szalloda"]["price"] * (100 - RULES["shop_discount"]) // 100
        self.assertEqual(player["money"], RULES["start_money"] - price)

    def test_build_block_card_effect(self):
        game, _ = new_game(2)
        player = current(game)
        player["effects"]["build_block"] = 1
        play.finish_turn(game, player)
        self.assertIsNone(game["pending"])
        self.assertEqual(player["effects"]["build_block"], 0)


class VictoryTests(unittest.TestCase):
    """Győzelem: mindhárom feltétel a kör végén; utána nincs több lépés; új játék indítható."""

    def end_turn_with(self, money, loan=0, all_built=True):
        game, _ = new_game(3)
        player = current(game)
        player["buildings"] = [b["id"] for b in BUILDINGS] if all_built else ["palya"]
        player["money"] = money
        player["loan"] = loan
        play.close_turn(game, player)
        return game, player

    def test_win_when_all_three_conditions_hold(self):
        game, player = self.end_turn_with(RULES["win_money"])
        self.assertEqual(game["status"], "finished")
        self.assertEqual(game["winner_id"], player["id"])

    def test_no_win_with_debt(self):
        game, _ = self.end_turn_with(RULES["win_money"] + 5000, loan=1100)
        self.assertEqual(game["status"], "playing")

    def test_no_win_without_enough_money(self):
        game, _ = self.end_turn_with(RULES["win_money"] - 1)
        self.assertEqual(game["status"], "playing")

    def test_no_win_without_all_buildings(self):
        game, _ = self.end_turn_with(RULES["win_money"] * 3, all_built=False)
        self.assertEqual(game["status"], "playing")

    def test_no_actions_after_the_end(self):
        game, _ = self.end_turn_with(RULES["win_money"])
        for p in game["players"]:
            with self.assertRaises(HTTPException) as err:
                run(main.roll_dice(game["code"], PlayerRef(player_id=p["id"])))
            self.assertEqual(err.exception.status_code, 409)

    def test_new_game_after_the_end(self):
        game, _ = self.end_turn_with(RULES["win_money"])
        for p in list(game["players"]):
            run(main.leave_game(game["code"], PlayerRef(player_id=p["id"])))
        fresh, _ = new_game(2)
        self.assertEqual(fresh["status"], "playing")
        self.assertNotEqual(fresh["code"], game["code"])


if __name__ == "__main__":
    unittest.main()
