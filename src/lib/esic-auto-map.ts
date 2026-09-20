/**
 * Automatic ESIC branch mapping.
 *
 * The ESIC Branch Manager holds the master list of sub-codes, each tagged with
 * a location. A client site already tells us its city and state, so there is no
 * reason to pick the branch by hand: we match the city first, then fall back to
 * the state's branch. Nothing is guessed beyond these lists — when neither
 * matches, the site stays unmapped instead of being given a wrong sub-code.
 */

export type EsicBranchOption = { id: string; location: string; esic_code?: string | null };

const norm = (v: string | null | undefined) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** City (or district) → branch location in the ESIC master. */
const CITY_TO_BRANCH: Record<string, string> = {
  pune: "PUNE Pune City",
  "pune city": "PUNE Pune City",
  pimpri: "PUNE Pune City",
  "pimpri chinchwad": "PUNE Pune City",
  chakan: "PUNE Chakan",
  ranjangaon: "PUNE Ranjangaon",
  baramati: "Baramati",

  mumbai: "MUMBAI",
  "greater mumbai": "MUMBAI",
  "mumbai suburban": "MUMBAI",
  "navi mumbai": "MUMBAI",
  thane: "MUMBAI",
  palghar: "MUMBAI",
  raigad: "MUMBAI",
  raigarh: "MUMBAI",
  dombivli: "MUMBAI",
  kalyan: "MUMBAI",

  nashik: "NASHIK 1",
  nasik: "NASHIK 1",
  malegaon: "NASHIK 1",
  nagpur: "NAGPUR",
  sangli: "SANGLI",
  kolhapur: "KOLHAPUR",
  solapur: "SOLAPUR",
  satara: "SATARA",
  ahmednagar: "AHMEDNAGAR",
  ahmadnagar: "AHMEDNAGAR",
  jalgaon: "JALGAON",

  ahmedabad: "AHMEDABAD",
  gandhinagar: "AHMEDABAD",
  surat: "SURAT",
  rajkot: "RAJKOT",
  vadodara: "GUJARAT Baroda",
  baroda: "GUJARAT Baroda",

  bengaluru: "BANGALORE (Karnataka)",
  bangalore: "BANGALORE (Karnataka)",
  "bengaluru rural": "BANGALORE (Karnataka)",
  "bangalore rural": "BANGALORE (Karnataka)",
  "bengaluru urban": "BANGALORE (Karnataka)",
  bellur: "Bellur (Karnataka)",

  hyderabad: "Hyderabad",
  secunderabad: "Hyderabad",
  rangareddy: "Hyderabad",
  "ranga reddy": "Hyderabad",

  goa: "GOA",
  "north goa": "GOA",
  "south goa": "GOA",
  panjim: "GOA",
  panaji: "GOA",
  margao: "GOA",
  vasco: "GOA",
  "vasco da gama": "GOA",
  calangute: "GOA",

  udaipur: "UDAIPUR",
  alwar: "Alwar",
  bhopal: "BHOPAL",
  guwahati: "GUWAHATI",
  gurgaon: "GURGAON",
  gurugram: "GURGAON",
};

/** State → branch location used when the city itself is not in the master. */
const STATE_TO_BRANCH: Record<string, string> = {
  maharashtra: "PUNE Pune City",
  gujarat: "AHMEDABAD",
  karnataka: "BANGALORE (Karnataka)",
  telangana: "Hyderabad",
  goa: "GOA",
  rajasthan: "UDAIPUR",
  "madhya pradesh": "BHOPAL",
  haryana: "GURGAON",
  assam: "GUWAHATI",
};

/**
 * Pick the ESIC branch for a site from its city/state.
 * Returns null when the master list has nothing sensible for that location.
 */
export function pickEsicBranchId(
  branches: EsicBranchOption[],
  city: string | null | undefined,
  state: string | null | undefined,
): string | null {
  if (!branches.length) return null;
  const byLocation = new Map(branches.map((b) => [norm(b.location), b.id]));
  const find = (location: string) => byLocation.get(norm(location)) ?? null;

  const cityKey = norm(city);
  if (cityKey) {
    const mapped = CITY_TO_BRANCH[cityKey];
    if (mapped) {
      const id = find(mapped);
      if (id) return id;
    }
    // A branch whose location is literally the city name (master added later).
    const direct = byLocation.get(cityKey);
    if (direct) return direct;
  }

  const stateKey = norm(state);
  if (stateKey) {
    const mapped = STATE_TO_BRANCH[stateKey];
    if (mapped) {
      const id = find(mapped);
      if (id) return id;
    }
  }
  return null;
}
