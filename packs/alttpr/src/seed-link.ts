// Where a seed lives on alttpr.com: its hash, as a player pastes it or as a
// link to its page, and the address of its file (read by seed-file.ts).

/** Where alttpr.com keeps a seed's file. */
export const seedFileUrl = (hash: string) =>
  `https://alttpr-patch-data.s3.us-east-2.amazonaws.com/${hash}.json`;

/**
 * A seed's hash: Hashids over the seed's id, 10 characters at least (vt
 * app/Seed.php:14-17 at 219fcafd), in its default alphabet.
 */
export const SEED_HASH = /^[A-Za-z0-9]{10,20}$/;

/**
 * A link to a seed's page: `alttpr.com/h/{hash}`, which redirects to the
 * page in the site's locale, `alttpr.com/en/h/{hash}` (vt routes/web.php:41-43).
 */
const SEED_LINK =
  /^(?:https?:\/\/)?(?:www\.)?alttpr\.com\/(?:[a-z]{2}\/)?h\/([A-Za-z0-9]{10,20})\/?(?:[?#].*)?$/;

/**
 * The hash in what a player pastes: a bare hash, or a link to the seed's
 * page on alttpr.com. Null when it is neither.
 */
export const seedHashOf = (input: string): string | null => {
  const text = input.trim();
  return SEED_HASH.test(text) ? text : (SEED_LINK.exec(text)?.[1] ?? null);
};
