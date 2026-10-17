// Morse Master words. One tier per difficulty; PLAN in MorseMaster.vue picks the tier per round.
import type { Lang } from '#shared/protocol';

// Word tiers per language; A-Z only (no umlauts: not in the Morse table).
/** Word tier per round. */
export const PLAN = [0, 1, 1, 2, 2, 3];

export const WORDS: Record<Lang, readonly (readonly string[])[]> = {
  en: [
    ['SOS'],
    ['JOTA', 'JOTI', 'CAMP', 'TENT', 'FIRE', 'HIKE', 'KNOT', 'MAP', 'OWL', 'SUN'],
    ['SCOUT', 'RADIO', 'BADGE', 'CANOE', 'TORCH', 'PEACE', 'WORLD'],
    ['PATROL', 'COMPASS', 'LANTERN', 'FRIEND', 'WOGGLE'],
  ],
  de: [
    ['SOS'],
    ['JOTA', 'JOTI', 'ZELT', 'WALD', 'FUNK', 'EULE', 'MOND', 'BOOT'],
    ['LAGER', 'FEUER', 'KARTE', 'FUCHS', 'FAHRT', 'SIPPE', 'STERN'],
    ['KNOTEN', 'KOMPASS', 'LATERNE', 'FREUND', 'FRIEDEN'],
  ],
};
