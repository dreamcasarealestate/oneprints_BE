/** Apparel-only designer marketplace — tokens stored in `designers.specializations`. */

export type ApparelGender = 'men' | 'women';

export const APPAREL_CATEGORY_SLUG = 'apparel';

export const APPAREL_DESIGNER_SUBTYPES: Record<
  ApparelGender,
  { slug: string; label: string }[]
> = {
  men: [
    { slug: 'shirts', label: 'Shirts' },
    { slug: 'pants', label: 'Pants' },
    { slug: 'hoodies', label: 'Hoodies' },
    { slug: 't-shirts', label: 'T-shirts' },
    { slug: 'polos', label: 'Polos' },
    { slug: 'jackets', label: 'Jackets & outerwear' },
    { slug: 'shorts', label: 'Shorts' },
    { slug: 'activewear', label: 'Activewear' },
  ],
  women: [
    { slug: 't-shirts', label: 'T-shirts' },
    { slug: 'tops', label: 'Tops & blouses' },
    { slug: 'dresses', label: 'Dresses' },
    { slug: 'skirts', label: 'Skirts' },
    { slug: 'pants', label: 'Pants & trousers' },
    { slug: 'hoodies', label: 'Hoodies & sweatshirts' },
    { slug: 'ethnic-wear', label: 'Ethnic wear' },
    { slug: 'co-ords', label: 'Co-ords & sets' },
  ],
};

export function apparelDesignerToken(
  gender: ApparelGender,
  subtypeSlug: string,
): string {
  return `apparel:${gender}:${subtypeSlug.trim().toLowerCase()}`;
}

const TOKEN_RE = /^apparel:(men|women):([a-z0-9-]+)$/i;

export function parseApparelDesignerToken(
  token: string,
): { gender: ApparelGender; subtype: string } | null {
  const m = TOKEN_RE.exec(token?.trim() ?? '');
  if (!m) return null;
  const gender = m[1].toLowerCase() as ApparelGender;
  const subtype = m[2].toLowerCase();
  return { gender, subtype };
}

export function isValidApparelDesignerToken(token: string): boolean {
  const p = parseApparelDesignerToken(token);
  if (!p) return false;
  const row = APPAREL_DESIGNER_SUBTYPES[p.gender].find((x) => x.slug === p.subtype);
  return !!row;
}

export function isApparelGender(value: unknown): value is ApparelGender {
  return value === 'men' || value === 'women';
}

export function isSubtypeForGender(
  gender: ApparelGender,
  subtypeSlug: string,
): boolean {
  const s = subtypeSlug.trim().toLowerCase();
  return APPAREL_DESIGNER_SUBTYPES[gender].some((x) => x.slug === s);
}

export function labelForApparelDesignerToken(token: string): string | null {
  const p = parseApparelDesignerToken(token);
  if (!p) return null;
  const row = APPAREL_DESIGNER_SUBTYPES[p.gender].find((x) => x.slug === p.subtype);
  if (!row) return null;
  const g = p.gender === 'men' ? "Men's" : "Women's";
  return `${g} · ${row.label}`;
}
