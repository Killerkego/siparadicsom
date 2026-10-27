// Mezőtípusok: felirat és elvárt darabszám
export const FIELD_TYPES = {
  start: { label: 'START', count: 1 },
  bevetel: { label: 'Bevételi', count: 7 },
  kiadas: { label: 'Kiadási', count: 7 },
  kartya: { label: 'Kártyahúzó', count: 6 },
  vasarlas: { label: 'Vásárlási', count: 4 },
  semleges: { label: 'Semleges', count: 4 },
  specialis: { label: 'Speciális', count: 11 },
};

// Speciális mezők altípusai (spec_mezok.md)
export const SPECIAL_TYPES = {
  felvono: 'Felvonó',
  oktatas: 'Oktatás',
  siverseny: 'Síverseny',
  csapda: 'Csapda',
  gambling: 'Gambling',
};

export function countByType(fields) {
  const counts = {};
  for (const f of fields) counts[f.type] = (counts[f.type] ?? 0) + 1;
  return counts;
}
