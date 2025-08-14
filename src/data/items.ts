// Default item grid layout
export const defaultItemGrid: string[][] = [
  ["flute", "hookshot", "hammer", "firerod", "icerod", "boomerang", "net"],
  ["bow", "lantern", "shield", "sword", "tunic", "agahnim", "boots"],
  ["shovel", "book", "quake", "bombos", "ether", "bigkey0", "boss0"],
  ["powder", "glove", "bottle", "somaria", "byrna", "bigkey1", "boss1"],
  ["mushroom", "cape", "mirror", "moonpearl", "flippers", "bigkey2", "boss2"],
  ["boss3", "boss4", "boss5", "boss6", "boss7", "boss8", "boss9"],
  ["bigkey3", "bigkey4", "bigkey5", "bigkey6", "bigkey7", "bigkey8", "bigkey9"],
];

// Item states - both boolean and numeric
export const items: Record<string, number | boolean> = {
  agahnim: 0,

  // Big keys for keysanity mode (0 = not obtained, 1 = obtained)
  bigkey0: 0, // Eastern Palace
  bigkey1: 0, // Desert Palace
  bigkey2: 0, // Tower of Hera
  bigkey3: 0, // Palace of Darkness
  bigkey4: 0, // Swamp Palace
  bigkey5: 0, // Skull Woods
  bigkey6: 0, // Thieves' Town
  bigkey7: 0, // Ice Palace
  bigkey8: 0, // Misery Mire
  bigkey9: 0, // Turtle Rock

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

  // Big keys minimum values
  bigkey0: 0,
  bigkey1: 0,
  bigkey2: 0,
  bigkey3: 0,
  bigkey4: 0,
  bigkey5: 0,
  bigkey6: 0,
  bigkey7: 0,
  bigkey8: 0,
  bigkey9: 0,
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

  // Big keys maximum values
  bigkey0: 1,
  bigkey1: 1,
  bigkey2: 1,
  bigkey3: 1,
  bigkey4: 1,
  bigkey5: 1,
  bigkey6: 1,
  bigkey7: 1,
  bigkey8: 1,
  bigkey9: 1,
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
