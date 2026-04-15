/**
 * Single source of truth for seeded storefront / admin / designer category slugs.
 * Keep in sync with OnePrint-FE `src/lib/catalogueCategoryRegistry.ts`.
 */
export const CANONICAL_CATEGORIES = [
  { name: 'Apparel', slug: 'apparel', sortOrder: 10 },
  { name: 'Drinkware', slug: 'drinkware', sortOrder: 20 },
  { name: 'Bags', slug: 'bags', sortOrder: 30 },
  { name: 'Stationery', slug: 'stationery', sortOrder: 40 },
  { name: 'Office', slug: 'office', sortOrder: 50 },
  { name: 'Awards', slug: 'awards', sortOrder: 60 },
  { name: 'Promo & events', slug: 'promo', sortOrder: 70 },
  { name: 'Tech accessories', slug: 'tech_accessories', sortOrder: 80 },
  { name: 'Corporate gifting', slug: 'corporate_gifting', sortOrder: 90 },
  { name: 'Corporate', slug: 'corporate', sortOrder: 100 },
  { name: 'Stickers', slug: 'stickers', sortOrder: 110 },
  { name: 'Labels', slug: 'labels', sortOrder: 120 },
  { name: 'Packaging', slug: 'packaging', sortOrder: 130 },
] as const;
