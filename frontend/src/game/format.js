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

// építési elem ára a kedvezménnyel, 50 HK-ra kerekítve (ugyanúgy, mint a backendben)
export function buildPrice(building, discount) {
  return Math.round((building.price * (100 - discount)) / 100 / 50) * 50;
}

// egy építési elem állapota a játékosnál: megvan / megvehető / hiányzik az előfeltétele
export function buildState(building, owned) {
  if (owned.includes(building.id)) return 'owned';
  return building.requires.every((r) => owned.includes(r)) ? 'available' : 'locked';
}
