// Tooltip and help information for all tracker items and features

export type TooltipData = {
  /** Title of the item/feature */
  title: string;
  /** Brief description */
  description: string;
  /** Game mechanics explanation */
  mechanics?: string;
  /** Progression tips */
  tips?: string;
  /** Keyboard shortcuts (if applicable) */
  shortcuts?: string[];
};

export type DungeonTooltipData = TooltipData & {
  /** Required items to enter */
  requirements?: string[];
  /** Medallion requirement (for special dungeons) */
  medallion?: string;
  /** Number of chests */
  chestCount?: number;
};

// Item tooltips data
export const itemTooltips: Record<string, TooltipData> = {
  // Big Keys for keysanity mode
  bigkey0: {
    description: "Big Key for Eastern Palace - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Eastern Palace and defeating Armos Knights",
    title: "Eastern Palace Big Key",
  },
  bigkey1: {
    description: "Big Key for Desert Palace - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Desert Palace and defeating Lanmolas",
    title: "Desert Palace Big Key",
  },
  bigkey2: {
    description: "Big Key for Tower of Hera - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Tower of Hera and defeating Moldorm",
    title: "Tower of Hera Big Key",
  },
  bigkey3: {
    description: "Big Key for Palace of Darkness - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Palace of Darkness and defeating Helmasaur King",
    title: "Palace of Darkness Big Key",
  },
  bigkey4: {
    description: "Big Key for Swamp Palace - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Swamp Palace and defeating Arrghus",
    title: "Swamp Palace Big Key",
  },
  bigkey5: {
    description: "Big Key for Skull Woods - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Skull Woods and defeating Mothula",
    title: "Skull Woods Big Key",
  },
  bigkey6: {
    description: "Big Key for Thieves' Town - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Thieves' Town and defeating Blind",
    title: "Thieves' Town Big Key",
  },
  bigkey7: {
    description: "Big Key for Ice Palace - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Ice Palace and defeating Kholdstare",
    title: "Ice Palace Big Key",
  },
  bigkey8: {
    description: "Big Key for Misery Mire - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Misery Mire and defeating Vitreous",
    title: "Misery Mire Big Key",
  },
  bigkey9: {
    description: "Big Key for Turtle Rock - required to access the boss",
    mechanics: "In keysanity mode, can be found anywhere in the world",
    tips: "Essential for completing Turtle Rock and defeating Trinexx",
    title: "Turtle Rock Big Key",
  },
  // Medallions
  bombos: {
    description: "Powerful medallion that creates screen-wide explosions",
    mechanics: "Damages all enemies on screen, requires magic power",
    tips: "May be required for Misery Mire or Turtle Rock access",
    title: "Bombos Medallion",
  },
  boomerang: {
    description: "Ranged tool that returns after thrown",
    mechanics: "Levels: None → Boomerang → Magical Boomerang",
    tips: "Can stun enemies, activate switches, and collect distant items",
    title: "Boomerang",
  },
  boots: {
    description: "Allows dashing at high speed",
    mechanics: "Can break certain blocks and cross gaps",
    tips: "Required for many secrets and accessing certain dungeons",
    title: "Pegasus Boots",
  },
  bow: {
    description: "Ranged weapon essential for many puzzles and enemies",
    mechanics: "Levels: None → Bow → Silver Arrows",
    tips: "Silver Arrows are required to damage Ganon in the final battle",
    title: "Bow & Arrows",
  },
  ether: {
    description: "Medallion that reveals hidden blocks and damages enemies",
    mechanics: "Shows invisible platforms and passages",
    tips: "May be required for Misery Mire or Turtle Rock access",
    title: "Ether Medallion",
  },
  firerod: {
    description: "Magic rod that shoots fireballs",
    mechanics: "Can light torches, melt ice blocks, and damage enemies",
    tips: "Useful for Ice Palace and various puzzle rooms",
    title: "Fire Rod",
  },
  flippers: {
    description: "Allows swimming in deep water",
    mechanics: "Access to water areas and Zora's Domain",
    tips: "Opens up many new areas and chest locations",
    title: "Zora's Flippers",
  },
  flute: {
    description: "Magical instrument for fast travel",
    mechanics: "Summons a bird for quick transportation",
    tips: "Learn the 8 warp points by visiting them first",
    title: "Flute",
  },

  // Progression items
  glove: {
    description: "Allows lifting heavy objects",
    mechanics: "Levels: None → Power Glove → Titan's Mitt",
    tips: "Titan's Mitt can lift the heaviest objects in the game",
    title: "Power Glove",
  },

  // Tools and utilities
  hammer: {
    description: "Heavy tool for breaking blocks and stunning enemies",
    mechanics: "Can pound down moles and break certain barriers",
    tips: "Required for Palace of Darkness and some overworld areas",
    title: "Magic Hammer",
  },
  hookshot: {
    description: "Grappling tool for traversal and pulling items",
    mechanics: "Allows crossing gaps and reaching distant objects",
    tips: "Essential for Swamp Palace and many treasure chests",
    title: "Hookshot",
  },
  icerod: {
    description: "Magic rod that creates ice blocks",
    mechanics: "Can freeze enemies and create platforms over water",
    tips: "Essential for some rooms in Misery Mire and overworld secrets",
    title: "Ice Rod",
  },
  lantern: {
    description: "Illuminates dark rooms and lights torches",
    mechanics: "Essential for navigating dark areas safely",
    tips: "Required for most Dark World dungeons and some Light World areas",
    title: "Lamp",
  },
  mirror: {
    description: "Teleports you between Light and Dark Worlds",
    mechanics: "Returns you to corresponding Light World location",
    tips: "Essential for many routing strategies and reaching certain areas",
    title: "Magic Mirror",
  },

  // Special items
  moonpearl: {
    description: "Allows maintaining human form in the Dark World",
    mechanics: "Essential item for Dark World exploration",
    tips: "Required before entering any Dark World area safely",
    title: "Moon Pearl",
  },
  quake: {
    description: "Medallion that creates earthquakes and damages enemies",
    mechanics: "Can stun all enemies and reveal certain secrets",
    tips: "May be required for Misery Mire or Turtle Rock access",
    title: "Quake Medallion",
  },
  shield: {
    description: "Protects against projectiles and some attacks",
    mechanics: "Levels: None → Small → Red → Mirror Shield",
    tips: "Mirror Shield reflects beams and is required for some areas",
    title: "Shield",
  },
  shovel: {
    description: "Tool for digging up buried items",
    mechanics: "Can uncover hidden treasures and secrets",
    tips: "Trade with the Dwarfs to get an upgraded item",
    title: "Shovel",
  },
  // Progressive items
  sword: {
    description: "Your primary weapon, progressively upgrades through the game",
    mechanics: "Levels: None → Fighter's → Master → Tempered → Golden Sword",
    shortcuts: ["Space/Enter to cycle", "Arrow keys to navigate"],
    tips: "Golden Sword requires Tempered Sword + Silver Arrows for Ganon",
    title: "Sword",
  },
};

// Dungeon tooltips data
export const dungeonTooltips: Record<string, DungeonTooltipData> = {
  agahnim: {
    description: "Wizard boss encountered twice in the game",
    requirements: ["Master Sword or better", "Access to Hyrule Castle"],
    tips: "First fight opens Dark World, second fight in Ganon's Tower",
    title: "Agahnim",
  },
  boss0: {
    chestCount: 3,
    description: "First dungeon in the Light World",
    requirements: ["Bow (for Armos Knights)"],
    tips: "Contains the Bow, essential for progression",
    title: "Eastern Palace",
  },
  boss1: {
    chestCount: 2,
    description: "Desert dungeon requiring special access",
    requirements: ["Book of Mudora", "Lantern (recommended)"],
    tips: "Contains the Power Glove and desert access",
    title: "Desert Palace",
  },
  boss2: {
    chestCount: 2,
    description: "Mountain tower dungeon",
    requirements: ["Lantern", "Access to Death Mountain"],
    tips: "Contains the Moon Pearl, essential for Dark World",
    title: "Tower of Hera",
  },
  boss3: {
    chestCount: 5,
    description: "First Dark World dungeon",
    requirements: ["Lantern", "Moon Pearl", "Hammer (for boss)"],
    tips: "Contains the Hammer and Bow upgrades",
    title: "Palace of Darkness",
  },
  boss4: {
    chestCount: 6,
    description: "Swamp dungeon with hookshot requirement",
    requirements: ["Hookshot", "Moon Pearl", "Lantern"],
    tips: "Complex dungeon with multiple levels and water mechanics",
    title: "Swamp Palace",
  },
  boss5: {
    chestCount: 2,
    description: "Forest dungeon with multiple entrances",
    requirements: ["Moon Pearl", "Fire Rod (for some rooms)"],
    tips: "Has multiple entrance points throughout the Lost Woods",
    title: "Skull Woods",
  },
  boss6: {
    chestCount: 4,
    description: "Village dungeon in Dark World",
    requirements: ["Moon Pearl"],
    tips: "Complex dungeon with many rooms and passages",
    title: "Thieves' Town",
  },
  boss7: {
    chestCount: 3,
    description: "Frozen dungeon with ice mechanics",
    requirements: ["Flippers", "Fire Rod/Bombos", "Moon Pearl"],
    tips: "Fire Rod or Bombos medallion helpful for melting ice",
    title: "Ice Palace",
  },
  boss8: {
    chestCount: 2,
    description: "Desert dungeon requiring medallion",
    medallion: "Check tablet in Desert of Mystery",
    requirements: ["Flute", "Medallion (Ether/Bombos/Quake)", "Moon Pearl"],
    tips: "Medallion requirement is randomized - check the tablet first",
    title: "Misery Mire",
  },
  boss9: {
    chestCount: 5,
    description: "Final dungeon requiring medallion",
    medallion: "Check tablet on Death Mountain",
    requirements: ["Hammer", "Medallion (Ether/Bombos/Quake)", "Moon Pearl"],
    tips: "Medallion requirement is randomized - check the tablet first",
    title: "Turtle Rock",
  },
};
