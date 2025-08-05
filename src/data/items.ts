// Default item grid layout
export const defaultItemGrid: string[][] = [
  ["", "hookshot", "hammer", "firerod", "icerod", "boomerang", ""],
  ["bow", "lantern", "flute", "sword", "tunic", "shield", "boss0"],
  ["flute", "book", "mirror", "bombos", "ether", "quake", "boss1"],
  ["shovel", "glove", "bottle", "somaria", "byrna", "boots", "boss2"],
  ["powder", "mushroom", "cape", "mirror", "moonpearl", "flippers", "agahnim"],
  ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
];

// Item states - both boolean and numeric
export const items: Record<string, number | boolean> = {
  agahnim: 0,

  blank: false,
  bombos: false,
  book: false,
  boomerang: 0,
  boots: false,

  boss0: 1,
  boss1: 1,
  boss2: 1,
  boss3: 1,
  boss4: 1,
  boss5: 1,
  boss6: 1,
  boss7: 1,
  boss8: 1,
  boss9: 1,
  bottle: 0,
  bow: 0,
  byrna: false,
  cape: false,

  // Dynamic chest counters for bosses
  chest0: 3,
  chest1: 2,
  chest2: 2,
  chest3: 5,
  chest4: 6,
  chest5: 2,
  chest6: 4,
  chest7: 3,
  chest8: 2,
  chest9: 5,

  dungeon: 0,

  ether: false,
  firerod: false,
  flippers: false,
  flute: false,
  glove: 0,
  hammer: false,
  hookshot: false,
  icerod: false,
  lantern: false,
  mirror: false,
  moonpearl: false,
  mushroom: false,
  net: false,
  powder: false,
  quake: false,

  // Individual rewards for each boss (0-4: dungeon0.png to dungeon4.png)
  reward0: 0,
  reward1: 0,
  reward2: 0,
  reward3: 0,
  reward4: 0,
  reward5: 0,
  reward6: 0,
  reward7: 0,
  reward8: 0,
  reward9: 0,
  shield: 0,
  shovel: false,
  somaria: false,
  sword: 0,
  tunic: 1,
};

// Dungeon chest counts
export const dungeonchests: Record<number, number> = {
  0: 3,
  1: 2,
  2: 2,
  3: 5,
  4: 6,
  5: 2,
  6: 4,
  7: 3,
  8: 2,
  9: 5,
};

// Item minimum values
export const itemsMin: Record<string, number> = {
  agahnim: 0,
  boomerang: 0,

  boss0: 1,
  boss1: 1,
  boss2: 1,

  boss3: 1,
  boss4: 1,
  boss5: 1,
  boss6: 1,
  boss7: 1,
  boss8: 1,
  boss9: 1,

  bottle: 0,
  bow: 0,

  // Chest minimum values
  chest0: 0,
  chest1: 0,
  chest2: 0,
  chest3: 0,
  chest4: 0,
  chest5: 0,
  chest6: 0,
  chest7: 0,
  chest8: 0,
  chest9: 0,

  dungeon: 0,

  glove: 0,

  // Reward minimum values
  reward0: 0,
  reward1: 0,
  reward2: 0,
  reward3: 0,
  reward4: 0,
  reward5: 0,
  reward6: 0,
  reward7: 0,
  reward8: 0,
  reward9: 0,
  shield: 0,
  sword: 0,
  tunic: 1,
};

// Item maximum values
export const itemsMax: Record<string, number> = {
  agahnim: 1,
  boomerang: 3,

  boss0: 2,
  boss1: 2,
  boss2: 2,

  boss3: 2,
  boss4: 2,
  boss5: 2,
  boss6: 2,
  boss7: 2,
  boss8: 2,
  boss9: 2,

  bottle: 4,
  bow: 3,

  chest0: 3,
  chest1: 2,
  chest2: 2,
  chest3: 5,
  chest4: 6,
  chest5: 2,
  chest6: 4,
  chest7: 3,
  chest8: 2,
  chest9: 5,

  dungeon: 4,

  glove: 2,

  // Reward maximum values (0-4 for dungeon0.png to dungeon4.png)
  reward0: 4,
  reward1: 4,
  reward2: 4,
  reward3: 4,
  reward4: 4,
  reward5: 4,
  reward6: 4,
  reward7: 4,
  reward8: 4,
  reward9: 4,
  shield: 3,
  sword: 4,
  tunic: 3,
};
