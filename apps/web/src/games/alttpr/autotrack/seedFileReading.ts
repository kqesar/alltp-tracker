// The seed file's parser on its own, so that it splits from the page: Zod and
// the file's schema load as the tracker first asks alttpr.com for a seed's
// file (seedFile.ts imports this module dynamically), not with the tracker.
export { seedFileReading } from "@alltp/pack-alttpr";
