"""Az eseménykártyák listája és a pakli. Pontosan 40 lap a PDF 8.1 pontja szerint:
12 nyeremény, 12 veszteség, 8 előny, 8 hátrány. A lapok képe: frontend/public/cards/<id>.jpg,
a hátlapé: hatlap.jpg. A hatásokat a cards.py hajtja végre."""

import random

# kind: nyeremeny / veszteseg / elony / hatrany; a szöveg a lap előlapjáról
CARDS = [
    {"id": "E01", "kind": "elony", "name": "Szezonnyitó buli", "text": "Két bevételi mezőn 50%-kal több HK-t kapsz."},
    {"id": "E02", "kind": "elony", "name": "Üres felvonó", "text": "Még egyszer dobhatsz."},
    {"id": "E03", "kind": "elony", "name": "Szponzor", "text": "Egy épületed fejlesztése 40%-kal olcsóbb. 3 körön belül fejleszd fel."},
    {"id": "E04", "kind": "elony", "name": "Lojális ügyfél", "text": "Egy rossz kártyád egyszer nem számít. 5 körig érvényes."},
    {"id": "E05", "kind": "elony", "name": "Könyvelő", "text": "Kapsz 700 HK-t. Egy kiadási mezőn csak feleannyit fizetsz."},
    {"id": "E06", "kind": "elony", "name": "Helikopter transzfer", "text": "Lépj a START mezőre, és vedd fel a 2000 HK-t."},
    {"id": "E07", "kind": "elony", "name": "Turisztikai vonzás", "text": "Lépj előre 4 mezőt. Ha áthaladsz a START-on, kapsz 4000 HK-t."},
    {"id": "E08", "kind": "elony", "name": "Jósnő", "text": "Húzz 2 kártyát. Az egyiket hajtsd végre, a másikat tedd a pakli aljára."},
    {"id": "H01", "kind": "hatrany", "name": "Elakadás", "text": "Kimaradsz egy körből."},
    {"id": "H02", "kind": "hatrany", "name": "Lavinaösvény", "text": "Lépj vissza 3 mezőt."},
    {"id": "H03", "kind": "hatrany", "name": "IT-rendszer lefagyása", "text": "Egyszer nem vásárolhatsz épületet."},
    {"id": "H04", "kind": "hatrany", "name": "Gyenge árfolyam", "text": "A következő két alkalommal, amikor áthaladsz a START-on, csak 1000 HK-t kapsz."},
    {"id": "H05", "kind": "hatrany", "name": "Felvonósztrájk", "text": "Legfeljebb 3 mezőt léphetsz előre, még akkor is, ha 6-ost dobsz."},
    {"id": "H06", "kind": "hatrany", "name": "Átpártolás", "text": "Ha közvetlenül mögötted áll egy játékos, cseréljetek helyet. Ha nincs, lépj az 1. mezőre."},
    {"id": "H07", "kind": "hatrany", "name": "Rulett", "text": "Dobj egy kockával! 1–2: lépj vissza 3 mezőt. 3–4: kimaradsz egy körből. 5–6: fizess 1500 HK-t."},
    {"id": "H08", "kind": "hatrany", "name": "Kártyablokk", "text": "Egy jó kártyád egyszer nem számít. 5 körig érvényes."},
    {"id": "N01", "kind": "nyeremeny", "name": "Orosz oligarcha", "text": "Kapsz 3200 HK-t."},
    {"id": "N02", "kind": "nyeremeny", "name": "Fesztivál", "text": "Kapsz 2200 HK-t."},
    {"id": "N03", "kind": "nyeremeny", "name": "Az év síterepe", "text": "Kapsz 2500 HK-t."},
    {"id": "N04", "kind": "nyeremeny", "name": "Ereklye eladása", "text": "Kapsz 1800 HK-t."},
    {"id": "N05", "kind": "nyeremeny", "name": "Teltház", "text": "Kapsz 2400 HK-t. Ha van Szállodád vagy Apartmanod, kapsz még 600 HK-t."},
    {"id": "N06", "kind": "nyeremeny", "name": "Nagyvonalú bank", "text": "Kapsz 1600 HK-t."},
    {"id": "N07", "kind": "nyeremeny", "name": "Olimpiai edzőtábor", "text": "Kapsz 2800 HK-t. Ha van Pályarendszered, kapsz még 500 HK-t."},
    {"id": "N08", "kind": "nyeremeny", "name": "Bajnokság", "text": "Kapsz 2000 HK-t."},
    {"id": "N09", "kind": "nyeremeny", "name": "Biztosítás kifizetése", "text": "Kapsz 1500 HK-t."},
    {"id": "N10", "kind": "nyeremeny", "name": "Gourmet hétvége", "text": "Ha van Éttermed, kapsz 3000 HK-t, ha nincs, kapsz 900 HK-t."},
    {"id": "N11", "kind": "nyeremeny", "name": "A hegy királya", "text": "Minden játékos kap 400 HK-t minden saját épülete után."},
    {"id": "N12", "kind": "nyeremeny", "name": "Pezsgős gála", "text": "Kapsz 2300 HK-t."},
    {"id": "V01", "kind": "veszteseg", "name": "Sérült vendég", "text": "Fizess 1500 HK-t."},
    {"id": "V02", "kind": "veszteseg", "name": "Sztrájk", "text": "Fizess 1800 HK-t. Egyszer nem vásárolhatsz épületet."},
    {"id": "V03", "kind": "veszteseg", "name": "Felvonó meghibásodása", "text": "Fizess 2200 HK-t. Ha van Felvonód, csak 1600 HK-t fizess. Egyszer nem vásárolhatsz épületet."},
    {"id": "V04", "kind": "veszteseg", "name": "Lavina", "text": "Fizess 2000 HK-t. Lépj vissza 2 mezőt."},
    {"id": "V05", "kind": "veszteseg", "name": "Jegesedés", "text": "Fizess 1200 HK-t. A következő dobásodból vonj le 1-et."},
    {"id": "V06", "kind": "veszteseg", "name": "Negatív visszajelzés", "text": "Fizess 1400 HK-t. Egy épületed fejlesztése 20%-kal drágább."},
    {"id": "V07", "kind": "veszteseg", "name": "Fellépés lemondása", "text": "Ha van Luxusbárod, fizess 1000 HK-t, ha nincs, fizess 1800 HK-t."},
    {"id": "V08", "kind": "veszteseg", "name": "Kiürítés", "text": "Fizess 1300 HK-t. Kimaradsz egy körből."},
    {"id": "V09", "kind": "veszteseg", "name": "Foglalás lemondása", "text": "Fizess 1600 HK-t."},
    {"id": "V10", "kind": "veszteseg", "name": "Kötelező befizetés", "text": "Minden játékos fizet 700 HK-t."},
    {"id": "V11", "kind": "veszteseg", "name": "Gyenge szezon", "text": "Fizess 600 HK-t minden épületed után, ezen felül további 600 HK-t."},
    {"id": "V12", "kind": "veszteseg", "name": "Túlfoglalás", "text": "Fizess 1800 HK-t. Minden játékosnak, akinek nálad több épülete van, fizess további 400 HK-t."},
]
CARD_BY_ID = {c["id"]: c for c in CARDS}
GOOD_KINDS = ("nyeremeny", "elony")


def is_good(card_id: str) -> bool:
    return CARD_BY_ID[card_id]["kind"] in GOOD_KINDS


def new_deck() -> list[str]:
    """Megkevert pakli a 40 lap azonosítójával (a teteje az első elem)."""
    deck = [c["id"] for c in CARDS]
    random.SystemRandom().shuffle(deck)
    return deck
