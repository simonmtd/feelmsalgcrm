/** Shared config for Apollo prospecting filters — used by the UI (labels) and
 *  the server (expanding selections into Apollo search parameters). */

export interface TitleGroup {
  key: string;
  label: string;
  titles: string[];
}

export const TITLE_GROUPS: TitleGroup[] = [
  {
    key: "ceo",
    label: "Daglig leder / CEO",
    titles: [
      "Daglig leder",
      "CEO",
      "Managing Director",
      "General Manager",
      "Founder",
      "Co-Founder",
      "Administrerende direktør",
    ],
  },
  {
    key: "cmo",
    label: "Markedssjef / CMO",
    titles: [
      "Markedssjef",
      "CMO",
      "Marketing Manager",
      "Marketing Director",
      "Markedsansvarlig",
      "Head of Marketing",
    ],
  },
  {
    key: "comms",
    label: "Kommunikasjonssjef",
    titles: ["Kommunikasjonssjef", "Head of Communications", "Communications Manager"],
  },
  {
    key: "sales",
    label: "Salgssjef",
    titles: ["Salgssjef", "Sales Director", "Head of Sales", "Sales Manager"],
  },
];

/** Apollo organization_num_employees_ranges values ("min,max"). */
export const EMPLOYEE_RANGES: { value: string; label: string }[] = [
  { value: "1,10", label: "1–10 ansatte" },
  { value: "11,50", label: "11–50 ansatte" },
  { value: "51,200", label: "51–200 ansatte" },
  { value: "201,500", label: "201–500 ansatte" },
  { value: "501,1000", label: "501–1000 ansatte" },
  { value: "1001,5000", label: "1001–5000 ansatte" },
  { value: "5001,", label: "5000+ ansatte" },
];

/** Areas in Norway. "" = whole country. Values map to Apollo location strings. */
export const NORWAY_AREAS: { value: string; label: string }[] = [
  { value: "", label: "Hele Norge" },
  { value: "Oslo", label: "Oslo" },
  { value: "Viken", label: "Viken" },
  { value: "Bergen", label: "Bergen" },
  { value: "Vestland", label: "Vestland" },
  { value: "Trondheim", label: "Trondheim" },
  { value: "Trøndelag", label: "Trøndelag" },
  { value: "Stavanger", label: "Stavanger" },
  { value: "Rogaland", label: "Rogaland" },
  { value: "Kristiansand", label: "Kristiansand" },
  { value: "Tromsø", label: "Tromsø" },
  { value: "Drammen", label: "Drammen" },
];

/** Expand selected title-group keys into Apollo person_titles. Empty = all. */
export function expandTitles(keys: string[]): string[] {
  const groups = keys.length
    ? TITLE_GROUPS.filter((g) => keys.includes(g.key))
    : TITLE_GROUPS;
  return groups.flatMap((g) => g.titles);
}

/** Build Apollo location strings from a chosen area (empty = whole Norway). */
export function areaToLocations(area: string | null | undefined): string[] {
  const a = (area ?? "").trim();
  return a ? [`${a}, Norway`] : ["Norway"];
}

const VALID_RANGES = new Set(EMPLOYEE_RANGES.map((r) => r.value));
export function validEmployeeRange(v: string | null | undefined): string | null {
  return v && VALID_RANGES.has(v) ? v : null;
}

/**
 * Apollo organization keyword-tags per niche (keyed by slug). We search on the
 * company's INDUSTRY tags, not its name — so "Fashion & klær" pulls Dressmann,
 * Northern Playground, VILLOID etc., not only companies with "fashion" in the
 * name. English terms match Apollo's tag vocabulary even for Norwegian firms.
 */
const NICHE_KEYWORD_TAGS: Record<string, string[]> = {
  "bank-finans": ["banking", "finance", "financial services"],
  bil: ["automotive", "car dealership"],
  "bygg-anlegg": ["construction", "building"],
  design: ["design", "graphic design"],
  eiendom: ["real estate", "property"],
  "film-produksjon": ["film production", "video production", "media production"],
  "it-teknologi": ["information technology", "software"],
  konsulent: ["management consulting", "consulting"],
  "markedsf-ring-reklame": ["marketing", "advertising"],
  "restaurant-servering": ["restaurants", "food & beverage"],
  varehandel: ["retail", "e-commerce"],
  "fashion-klaer": ["apparel", "fashion", "clothing"],
};

/**
 * Best Apollo keyword-tags for a niche. Falls back to the first meaningful word
 * of the Norwegian name when the slug isn't mapped (e.g. a niche added later),
 * so a new niche still searches on something rather than nothing.
 */
export function nicheKeywordTags(slug: string, name: string): string[] {
  const mapped = NICHE_KEYWORD_TAGS[slug];
  if (mapped?.length) return mapped;
  const word = name
    .toLowerCase()
    .split(/[^a-zæøå0-9]+/i)
    .find((w) => w.length >= 3);
  return word ? [word] : [];
}
