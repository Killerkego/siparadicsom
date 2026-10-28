"""Rövid történetek a bevételi és kiadási mezőkhöz: miért jön vagy megy a pénz. Mezőnként több is van,
a szerver véletlenszerűen választ egyet, és minden böngésző ugyanazt mutatja. A mezők neve a táblán
(frontend/src/board/tileArt.js) ugyanaz, mint az itteni megjegyzésekben."""

FIELD_STORIES: dict[int, list[str]] = {
    # --- bevételi mezők ---
    1: [  # Sífelszerelés-bolt
        "Megjött az első nagy havazás, és percek alatt elfogytak a sisakok és a szemüvegek a boltod polcairól.",
        "Egy svéd síklub az egész csapatának nálad vett új felszerelést.",
        "A tavalyi modellek kiárusítása hatalmas sikert aratott.",
    ],
    3: [  # Hütte
        "Tele volt a Hütte: a fagyos síelők egymás után rendelték a forralt bort és a gulyáslevest.",
        "Egy esküvői társaság egy egész estére kibérelte a Hüttét.",
        "A házi császármorzsa híre bejárta a völgyet, sorban álltak érte.",
    ],
    11: [  # Síkölcsönző
        "Iskolai sítábor érkezett: mind a negyven gyerek nálad bérelt lécet.",
        "Egy influenszer a kölcsönződ lécein forgatott videót, másnap megrohamoztak a bérlők.",
        "Hétvégére az utolsó snowboardot is kikölcsönözték.",
    ],
    16: [  # Téli vásár
        "A téli vásáron az összes kézzel kötött sapka elkelt a standodról.",
        "A mézeskalácsos sátradnál egész este kígyózott a sor.",
        "Egy turistabusz pont a vásár közepén állt meg, és mindenki vásárolt valamit.",
    ],
    21: [  # Síbérlet-pénztár
        "Szikrázó napsütés: rekordszámú napijegy fogyott a pénztárnál.",
        "Egy cég az összes dolgozójának szezonbérletet vett.",
        "Elkezdődött az iskolai szünet, a családok megrohamozták a bérletpénztárt.",
    ],
    28: [  # Csillagvizsgáló
        "Meteorraj volt az éjjel: a csillagvizsgáló teraszán egy hely sem maradt üresen.",
        "Egy egyetemi csoport egész hétre kibérelte a távcsöveket.",
        "A holdfényes túrára az utolsó jegy is elkelt.",
    ],
    31: [  # Hótalpas túra
        "A vezetett hótalpas túrán egy szarvascsordát is láttak, a vendégek bőkezűen adtak borravalót.",
        "Egy wellnesshotel minden vendégének lefoglalta a reggeli hótalpas sétát.",
        "A naplementés túrára háromszor annyian jelentkeztek, mint máskor.",
    ],
    # --- kiadási mezők ---
    4: [  # Rezsiszámla
        "Megjött a havi villanyszámla: a felvonók és a hóágyúk éjjel-nappal mentek.",
        "A nagy hideg miatt egész héten csúcsra volt járatva a fűtés.",
        "A vízmű megemelte a díjait, a hóágyúk pedig rengeteg vizet fogyasztanak.",
    ],
    7: [  # Felvonószerelő
        "Megsérült egy drótkötél a felvonón, a szerelőnek sürgősen ki kellett jönnie.",
        "Esedékes volt a kötelező éves felülvizsgálat: minden kabint át kellett nézni.",
        "A fagyban leállt a felvonó motorja, ki kellett hívni a szerelőt.",
    ],
    13: [  # Síwaxoló műhely
        "Elfogyott a wax, és a sürgősen rendelt utánpótlás drága volt.",
        "Az új élezőgép az első héten elromlott, javítani kellett.",
        "A kölcsönzős lécek talpát teljesen fel kellett újítani.",
    ],
    17: [  # Elveszett felszerelés
        "Egy vendég nálad hagyta a drága síbakancsát, és neked kellett utánaküldened.",
        "Eltűnt három pár léc a kölcsönzőből, pótolni kellett őket.",
        "A szél elsodorta a pályajelző táblákat, újakat kellett venni.",
    ],
    22: [  # Adóhivatal
        "Megérkezett a negyedéves iparűzési adó csekkje.",
        "Az adóellenőrzés talált egy elírást a könyvelésben, bírság lett belőle.",
        "Lejárt az idegenforgalmi adó befizetési határideje.",
    ],
    27: [  # Hóágyú
        "Kevés hó esett, ezért a hóágyúknak egész éjjel dolgozniuk kellett.",
        "Eltömődött az egyik hóágyú fúvókája, cserélni kellett.",
        "Enyhe idő jött, újra be kellett havazni a pályákat.",
    ],
    33: [  # Hómobil
        "Elszakadt a hómobil lánctalpa egy jeges kanyarban.",
        "Tankolni kellett a hómobilt, és a hegyen drága az üzemanyag.",
        "Kötelező szervizre kellett vinni a mentő hómobilt.",
    ],
}
