import { FIELD_TYPES, SPECIAL_TYPES } from '../board/fieldTypes';
import boardData from '../data/board.json';

// A tábla mezői (a backend is ugyanebből a fájlból dolgozik)
export const fields = boardData.fields;

// pénzösszeg magyar formában: 6 000 HK
export const hk = (n) => `${n.toLocaleString('hu-HU')} HK`;

// mező rövid neve: "#21 Speciális – Felvonó"
export function fieldName(field) {
  return `#${field.id} ${FIELD_TYPES[field.type].label}${field.special ? ` – ${SPECIAL_TYPES[field.special]}` : ''}`;
}

// az eseménykártyák fajtái (a lapokon is ez a felirat)
export const CARD_KINDS = { nyeremeny: 'Nyeremény', veszteseg: 'Veszteség', elony: 'Előny', hatrany: 'Hátrány' };

// a kártyák függő hatásai a játékoskártyán: rövid felirat és magyarázat
export const EFFECT_LABELS = {
  income_boost: ['🎉', (n) => `Szezonnyitó buli: még ${n} bevételi mezőn +50%`],
  expense_half: ['🧾', (n) => `Könyvelő: még ${n} kiadási mezőn csak a fele`],
  build_discount: ['🤝', (n) => `Szponzor: egy épület 40%-kal olcsóbb, még ${n} körig`],
  build_markup: ['👎', () => 'Negatív visszajelzés: a következő épület 20%-kal drágább'],
  build_block: ['⛔', (n) => `Még ${n}× nem vásárolhat épületet`],
  shield_bad: ['🛡️', (n) => `Lojális ügyfél: egy rossz lap nem számít, még ${n} körig`],
  block_good: ['🚫', (n) => `Kártyablokk: egy jó lap nem számít, még ${n} körig`],
  weak_start: ['📉', (n) => `Gyenge árfolyam: még ${n}× csak 1000 HK a START-on`],
  max_move: ['🚡', () => 'Felvonósztrájk: a következő dobásnál legfeljebb 3 mező'],
  roll_minus: ['🧊', () => 'Jegesedés: a következő dobásból -1'],
  skip_turns: ['⏸️', (n) => `Kimarad ${n} körből`],
};

// egy építési elem állapota a játékosnál: megvan / megvehető / hiányzik az előfeltétele
export function buildState(building, owned) {
  if (owned.includes(building.id)) return 'owned';
  return building.requires.every((r) => owned.includes(r)) ? 'available' : 'locked';
}
