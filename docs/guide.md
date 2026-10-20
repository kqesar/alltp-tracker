# User guide

How to use Rando Atlas, game by game, then the features they share: autotracking, voice
commands, the stream view for OBS, offline use and the desktop app.

- [A Link to the Past](#a-link-to-the-past)
- [Super Metroid (Map Rando)](#super-metroid-map-rando)
- [SMZ3 (samus.link)](#smz3-samuslink)
- [Autotracking](#autotracking)
- [Voice commands](#voice-commands)
- [Streaming with OBS](#streaming-with-obs)
- [Offline and install](#offline-and-install)
- [The desktop app](#the-desktop-app)

## A Link to the Past

**Items.** Click a cell to cycle its state, right-click to step it back. Progressive items step through their levels (sword 0→4, gloves 0→2) and wrap round; the rest toggle on and off. Greyed means not obtained, or for a boss not yet beaten. **Undo / Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) take back any change, a new game included.

**Map.** Every marker is colour-coded against the items you hold:

| Colour | Glyph | Meaning |
|---|---|---|
| green | ✓ | reachable now |
| yellow | ? | maybe reachable (a dark room, an unknown medallion, a key that may be anywhere), or only some of a marker's checks |
| light blue | eye | seen but not reachable yet (the Book reads the Pedestal, a ledge item shows from below) |
| red | ✕ | out of logic |
| grey | | already done |

The glyphs mean colour is never the only cue. Click a marker to check its locations (a cave's chests together), or a boss to mark it beaten. Hover or focus a marker to list its checks and their state in a tooltip, and a dungeon's items left; a check not in logic says what it is missing ("Missing: Hammer, or Moon Pearl + Power Glove") and why one is only maybe reachable. On a touch screen, press and hold. **Map: Auto / Side / Stack** sets how the two worlds sit: Auto keeps them side by side while there is room and stacks them on a narrow screen; the choice is remembered on this device.

**Checks.** The **Checks** tab beside **Map** lists every check of the map as a list, by zone, in the same states. It shows what is available or maybe at first; the filters (with their counts), a zone and a search narrow it. Tick a check to mark it done, as a click on its marker does; **Why?** says what a check not available is missing. A dungeon whose counter reaches 0 shows its checks done. The tab you leave open is remembered on this device.

**Run.** The **Run** tab beside **Checks** follows the run as it goes:
- **At a glance**: the run timer's time, the checks done and the bosses beaten.
- **Splits**: each boss in the order it fell, with the time since the last, as a speedrun timer splits a run.
- **Timeline**: every item found and location checked, newest first, timed by the run timer. Whatever you or autotracking marks is timed. Undo takes a time away with its mark, and Redo brings the same time back.
- **From the game**: outside races, while autotracking reads your game, the counts its ROM keeps, as its end credits list them: when the first sword, the boots, the flute and the mirror were found, deaths, save and quits, menu and lag time, and more.

The timeline is saved with the run, in exports too.

**Go mode.** Beside the tabs, ☆ **Go mode: not yet**, ★? **possible** or ★ **in logic** tells whether every step to the run's goal (Ganon, fast Ganon or the Pedestal) is in logic; click it to see what is missing. Goals that end with everything (all dungeons, triforce hunt) have none.

**Run timer.** Beside go mode, the run's time: click it to start, pause, resume or reset it. While autotracking reads your game, it starts as you leave the file select for the game and stops at the goal on its own (**Start and stop with the game**, on by default; connecting mid-run starts nothing). It keeps counting through a reload, and outside races it also shows the game's own play time, counted by the ROM frame by frame.

**Mystery.** The Mystery run type starts with its settings hidden: the goal, the swords, the crystals for Ganon's Tower and for Ganon, the item placement, pool and functionality, and the accessibility. Set each one in the run type dialog's summary as you learn it (a sign, Uncle's gift, the first key found outside its dungeon…), your progress kept, and pick "? Unknown" to hide one again. Autotracking knows a Mystery race seed by its file on alttpr.com: a fresh board switches to Mystery, in the world it holds.
- **Until a setting is known**, the map is cautious. A check that depends on it is *maybe*, never *available*, and anything shown available or out of logic is so whatever it turns out to be. The go mode says "goal unknown" until the goal is set.
- **The world and the dungeon items** are not hidden: you see the world on the first screen, and the dungeon items count each dungeon's items, so the run assumes them until you set them. A change of dungeon items keeps each counter's items found.
- **With autotracking outside races**, the seed's settings are set on their own as it is read. A race seed's are not read, so they stay yours to find.

**Retro.** The bow shoots rupees once you buy an arrow, and a small key opens any dungeon's door. The grid's last row holds an **Arrow shop** and a **Key shop**: mark each when you find a shop that sells it (voice: "tracker arrow shop", "tracker key shop"). Until then the bow shoots only with the silver arrows, and a door behind a small key is *maybe*: the tracker cannot tell which dungeon a key you found was meant for. Once a key shop is found, every key door is in logic, as the randomizer has it.

**Crosskeys: the entrance assistant.** A run with shuffled entrances shows every door and hole the shuffle mixes on the map: an empty dashed ring while you do not know where it leads, filled once you note it, with a glyph for the kind of place (D a dungeon, ↔ a cave with several doors, • a shop or house, ▼ where a hole drops). Click one, search, and pick where it leads: only what the shuffle may put there is offered, a place noted elsewhere says so, and picking it moves it. A hole and the door of the cave it drops into are noted together. The checks inside caves, houses and dungeons leave their usual spots: each place's stand above the first door you note to lead there, so the map shows what you can reach through the doors you know. Pointing at a noted door rings every other door into the same place. The **Entrances** tab lists them all by world, with how many are noted. They are saved with the run and undone like anything else.

**Crosskeys: the logic.** The map follows the logic of the entrance randomizer that fills a Crosskeys seed, its own rules and not the Open world's, through the doors you noted: a check behind a door you have not noted stays out of logic, and a note over the map says so. Note a door and what lies behind it turns available as soon as you can reach it, dungeons and caves included, and the go mode steps through the same world. The logic loads with a Crosskeys run alone. Other shuffles, Inverted's crossed one, and a Crosskeys run whose keys stay in their dungeons still show every check as *maybe*. **Why?** and the tooltips say what a check is missing in items, the events and places on the way included (the floodgate, the frog, a region a door rule asks for), or, when no item would bring it, that it waits on a door you have not noted.

**Boss overlays.** Each boss cell carries three corner buttons: the medallion requirement (top right, Misery Mire and Turtle Rock only), the remaining chest count (bottom left) and the reward, crystal or pendant (bottom right). Click steps them forward, right-click back.

**Keyboard.** The item grid is a single Tab stop: arrow keys move inside it (through a boss's overlays too) and wrap, Home / End jump to the ends of a row, Ctrl+Home / End to the ends of the grid. Space and Enter step the focused control forward, "-" steps it back. Every map marker is a button Tab can reach; "Skip to map" and "Skip to checks" jump to either view.

**Presets.** Pick a run type to set the rules. When a run's dungeon items leave their dungeons (alttpr.com's MC, MCS and Full Shuffle, the last one keysanity), the grid shows each dungeon's map and compass beside its keys, and its counter counts the items those leave room for. Or start from a seed: paste its alttpr.com link (or hash) under **Start from a seed**, and the tracker reads its settings (world, goal, swords, crystals, dungeon items, item placement, item pool and functionality, accessibility) from alttpr.com and offers the run type that holds them. Basic placement, a hard item pool or functionality change what is in logic as the randomizer has it: Ganon wants the silver arrows, no mirror shield, a bottle refills half the magic. The crystals, item placement, pool, functionality and accessibility change in the run type dialog's summary at any time, the run kept (one Undo takes a change back). Progress is saved to the browser automatically, and can be exported or imported as JSON.

## Super Metroid (Map Rando)

Pick **Super Metroid** under **Game** in the run type dialog (Mode); A Link to the Past is the other choice there. Each game keeps its own run on the device: switching and coming back finds it as it was, and the page loads only the game you track. The tracker follows **Map Rando** (maprando.com), the randomizer the community races: about 99 % of racetime.gg's Super Metroid Randomizer races of August to October 2026 were Map Rando seeds.

- **Items**: the beams, the morph ball and suits, the movement items, and how many missile, super missile and power bomb packs and energy and reserve tanks you hold. Click a cell to add one, right-click or "-" to take one away; a cell greys while you hold none.
- **The seed's objectives**: pick its preset in the run type dialog (Bosses, Minibosses, Chozos, Pirates, Metroids, None) or, for a Random seed, tick the ones its pause screen lists. Tick each as you finish it; once all are done, the barriers before Mother Brain are down.
- **The items a seed adds**: the Wall Jump Boots and the split Speed Booster (the Spark and Blue Boosters) take their cells when you turn them on.
- **No map and no logic**: Map Rando reconnects the game's rooms, so follow the game's own map. Export, Import, Undo, Redo and the stream view work as for A Link to the Past.
- **Autotracking**: connected as for A Link to the Past (below), the tracker recognises a Map Rando ROM and follows it: the items you hold (a pack or tank counts from the maximum it raised, so the seed's own pack sizes count right, and an energy tank you disabled from the pause menu still counts), the seed's objectives from its ROM and those done, and whether it adds the Wall Jump Boots or the split Speed Booster. **What I read** names the seed, linked to its maprando.com page, and its settings presets. Map Rando races allow autotracking, so nothing is held back. Like A Link to the Past's, it changes a cell only when the game does and never undoes a mark you set beyond it, and lays nothing outside a game in play (the title screen still holds the last file's items).

## SMZ3 (samus.link)

Pick **SMZ3** under **Game** in the run type dialog. The tracker follows **samus.link**, the randomizer the community races SMZ3 with: 456 of racetime.gg's 475 SMZ3 races of 2025 and 2026 were samus.link seeds, its beta included.

- **Items**: both games' items. Click a cell to add one, right-click or "-" to take one away; the sword, shield, gloves and bottles show their level on the sprite, the packs and tanks their count. Under them, the pendants and crystals found, and Super Metroid's boss tokens with how many Tourian asks for.
- **Two maps, one logic**: Hyrule (its two worlds, as for A Link to the Past) and Zebes. Every location takes the state SMZ3's own logic gives it, ported from the randomizer's source (`tewtal/SMZ3Randomizer`) and held to its official logic tests: available, maybe (it depends on what the tracker cannot know yet, such as a medallion or where an item sits), or out of logic. Click a marker to check its locations.
- **Run type**: a preset (Normal 7/7/4, the weeklies' Normal 7/5/3, Hard, Normal keysanity) or each setting: Super Metroid's logic (Normal or Hard), keysanity, the crystals Ganon's Tower and Ganon ask for, and the bosses Tourian asks for. Set Misery Mire's and Turtle Rock's medallions once you know them, and their dungeons' checks stop being maybes.
- **Keysanity**: each dungeon's big key and small keys take two rows of the grid, as on A Link to the Past's keysanity board, and Super Metroid's keycards a table under the tokens; the logic reads them.
- **Autotracking**: connected as for A Link to the Past (below), the tracker follows your SMZ3 game in both games, whichever one you are in: the items you hold, the rewards and boss tokens found, the keys and keycards, the locations checked on both maps, and the seed's Super Metroid logic and keysanity. Outside races it reads the seed's requirements (the crystals Ganon's Tower and Ganon ask for, the bosses Tourian asks for) and the medallions Misery Mire and Turtle Rock want, where the emulator serves that part of the ROM: RetroArch with bsnes-mercury does not, and the dialog says so rather than guess. In a race seed it never does: SMZ3 has no autotracking specification, and racetime.gg allows autotracking but bans inspecting the ROM otherwise, so the tracker reads only what you see in the game. Dungeon and boss rewards are never read, race or not: a reward counts once found. **What I read** names the seed, which game runs and what was read. Like A Link to the Past's, it changes a value only when the game does, never undoes a mark you set beyond it, and lays nothing outside a game in play.
- Export, Import, Undo, Redo and the stream view work as for the other games.

## Autotracking

The tracker can read your game as you play, through [SNI](https://github.com/alttpo/sni/releases/latest) (or QUsb2Snes) running on your computer: RetroArch with the bsnes-mercury core, an FX Pak Pro, BizHawk or an NWA emulator, on Windows, macOS or Linux. The toolbar's **Autotracking** button opens the setup guide for your system, its steps ticked as the connection gets through them, the failing one opened with what to do. Its dot shows the status at a glance; connecting, losing SNI and reconnecting never interrupt the run with a dialog. Once connected, the tracker connects again each time it opens, on that device, until you disconnect. With OBS, autotrack in the dock: the stream view follows the dock and never connects to SNI itself. Only one tab of the tracker reads the game: open a second and it waits, following the board, and takes over when the first closes.

**The board follows the game.** As you play, the tracker marks what the game shows: items, bosses beaten, checked locations, the chests each dungeon has left, a dungeon's prize once only one fits, and with small keys outside their dungeons (MCS and Full Shuffle) the small keys found. It changes a value only when the game does, and never undoes a mark you set beyond the game, such as a prize you saw on the map before beating its boss. **Sync from game**, in the Autotracking dialog, sets the board to the game, clearing such marks; Undo takes it back. What the game marks is never a step of Undo: undoing your own change keeps the game's. In a Crosskeys run, it notes each door or hole you go through, and the door you come out by: where the seed's ROM says it leads, so the map and the logic follow you without a click. A door the game shows overrides your note for it. Memory keeps only the last door each way, so a door you take while the tracker is closed is not caught up. While small keys stay in their dungeons, a dungeon's counter stays open while a chest may have held one of its small keys, which memory cannot tell from an item. **What I read** lists everything the tracker read, to compare with your game, and what it read that the board has no cell for (magic, heart pieces…).

**The seed sets the run type.** The tracker reads the seed's settings from its ROM (the world, swords, goal, crystals, which dungeon items leave their dungeons), and from the file alttpr.com keeps for the seed what no ROM states (item placement, item pool and functionality, accessibility, and whether the entrances are shuffled, as in Crosskeys), and holds them against the board's run type, once the file has come or could not. On a board with nothing marked yet it switches to the seed's on its own, and says so. With a run on the board it asks instead: **Switch** starts the seed's run type with the game laid on it (one Undo brings your board back), **Keep mine** keeps yours for that seed, on later visits too. The Autotracking dialog says what the seed's settings mean for the run type, and **What I read** lists them. A seed no run type here holds (the Ganonhunt goal, only some dungeon items shuffled) is said, never rounded.

Races: on a race seed, or when its race flag cannot be read, the tracker reads only what [the race-legal autotracking specification](https://link.alttpr.com/autotracking) permits, and shows a **race-legal** badge. Pendants and crystals, the chests inside dungeons, bottles and where entrances lead then stay yours to mark, Sync from game included. A race seed's settings lie outside what races permit, so the tracker reads only the seed's name and logic from the ROM, then asks alttpr.com for the seed's settings by that name, as **Start from a seed** does: they lead to the run type as a ROM's do, and What I read says where they came from. The file alttpr.com keeps for a seed holds its patch too: the tracker downloads it with the rest and reads only the settings. Offline, or for a seed alttpr.com does not have, the run type stays yours to choose.

Safari, and every browser on iOS, cannot reach SNI from this secure site (it counts `ws://localhost` as mixed content): use Firefox, Chrome or Edge, or the [desktop app](#the-desktop-app), which reaches SNI from any Mac. The first time, Firefox and Chrome ask whether the site may reach apps on your device: allow it. SNI listening on another port than 23074? Add `?bridge=<port>` to the tracker's address.

## Voice commands

Mark what you find without leaving the game: say **"tracker"**, then the find. For example, "tracker hook shot", "tracker master sword", "tracker eastern boss", "tracker mire ether", "tracker eastern crystal" or "tracker undo". Open **Voice** beside the run timer and choose **Start listening**.

- **What a command does.** It says what you found, not a click:
  - saying the hookshot again keeps it;
  - "sword" is one level up and never wraps round to none;
  - "eastern chest" takes one item from the count.
  - Each command is one step of Undo, as a click is. The Voice button shows it for a moment, and a screen reader hears it.
- **Talking is safe.** Without "tracker" first, nothing is marked, so talking about an item on stream changes nothing.
- **Private.** Speech is recognized in your browser, by [Vosk](https://alphacephei.com/vosk/), and no sound leaves your computer.
  - The first start downloads the speech model, 40 MB, kept for next time (about 60 MB of the browser's storage; **Remove the speech model** in the dialog frees it).
  - Nothing is downloaded until you turn voice commands on.
  - While listening, the recognizer uses about 15 % of one CPU core.
- **Words the model knows.** It is English only, and its dictionary lacks a few of the game's names, so they are said as words it has. The dialog's **What to say** lists every command:
  - "bom boss" for Bombos (saying "bombos" works);
  - "samaria" for Somaria;
  - "burner" or "blue cane" for Byrna;
  - "aga" for Agahnim;
  - "gannon tower" or "g t" for Ganon's Tower.
- **Where it works.** In Firefox, Chrome and Edge, in a browser tab: an OBS dock has no microphone. Once on, the tracker listens again each time it opens, on that device, until you stop it. Only one tab listens at a time.

## Sharing a run

The toolbar's **Share** button copies a link that holds your run, whatever the game: the run is compressed into the address's fragment (`#run=…`), which the browser never sends to any server. Whoever opens it is asked "Open this shared run?" and chooses **Open** (loaded as an Import is, **Undo** takes it back) or **Keep mine**; nothing is replaced without that answer. A late ALttPR run is too long for a Discord message with its timeline, so the link then leaves the timeline out and says so. [Sharing a run through its URL](share.md) has the format and the measured lengths.

## Streaming with OBS

The stream view, [`?view=obs`](https://kqesar.github.io/alltp-tracker/?view=obs), is the item grid alone on a transparent background. It fills its source, centred, at a size that keeps the pixel art sharp, and follows the run live. The toolbar's **Stream view** button copies its address. In OBS 31 or newer:

1. **Track in a dock**: under *Docks → Custom Browser Docks*, add `https://kqesar.github.io/alltp-tracker/` and track your run there.
2. **Show the grid**: add a *Browser Source* with the stream view's address. At 512 × 448 (512 × 512 with the key cells shown) every icon pixel is drawn whole; double it for a larger grid, or pick any size. Set the size in the source's properties: dragging its handles resamples the image and blurs it.
3. **Check the sync on your first run**: the dock and the source share OBS's browser storage, so the source is expected to follow every click in the dock. Items can also be clicked through the source's *Interact* window.

**Show the run timer**: tick *Show the run timer under the grid* in the **Stream view** dialog, and the address ends in `&timer=1`: the run timer sits under the grid, drawn in the chest counters' pixel font, white while it runs, grey while paused, gold once the goal stopped it. It takes a row of its own, so the sizes become 512 × 512 (512 × 576 with the key cells).

Capturing a browser window instead? Window capture has no transparency: add `&bg=00ff00` (any 3, 4, 6 or 8-digit hex colour) for a solid background to key out with a *Chroma Key* filter. In a browser source, eight digits make a translucent backdrop instead, e.g. `&bg=000000a0`, for busy footage.

Items not yet obtained are greyed in the icon alone, as in the app, so they stay legible over bright and dark scenes alike. Nobody clicks in a browser source, so the stream view takes a new version of the tracker on its own as soon as it is ready.

## Offline and install

After its first visit, the tracker loads and works with no network at all: the browser keeps every file it needs (the code, the item art, the map), and the run stays saved on the device as always. It keeps the games you have opened and no others: a Super Metroid player downloads about 0.45 MB for offline use, an A Link to the Past player about 1.4 MB. Switch to another game while online once, and it works offline from then on; a game never opened online cannot start offline. To give it a window of its own, install it: the install button in the address bar of Chrome or Edge, or **Share → Add to Home Screen** in Safari on iOS.

Reloading the page (F5) while online always shows the latest version. A tracker left open checks for one every hour, when its tab comes back into view and when the network returns, and never reloads in the middle of a run: a notice, "A new version is available", waits for you. **Reload** switches to it and keeps your progress; dismissing it leaves the new version for the next time you open the tracker. A copy started offline is offered the new version too, once the browser has it.


## The desktop app

The tracker also comes as an app for Windows, macOS and Linux, from the [latest release](https://github.com/kqesar/alltp-tracker/releases/latest). It is the same tracker in a window of its own: it reads RetroArch itself, without SNI (turn on RetroArch's Network Commands and use the bsnes-mercury core, as the setup guide says), reaches SNI for an FX Pak Pro, BizHawk or an NWA emulator on every system, Safari's Macs included, and updates itself (a notice, "A new version is available", offers **Restart**, never in the middle of a run). It keeps its own run, apart from the browser's: **Export** (which asks where to save, as any desktop app does) and **Import** move a run between them. The installers still carry the project's former name, ALLTP Tracker.

| System | Download | The first time |
|---|---|---|
| Windows | `…_x64-setup.exe` | The app is not signed yet: Windows SmartScreen says "Windows protected your PC". Choose **More info**, then **Run anyway**. |
| macOS | `…_aarch64.dmg` (Apple silicon) or `…_x64.dmg` (Intel) | The app is not notarized (that needs a paid Apple account): macOS refuses to open it once. Open **System Settings → Privacy & Security**, choose **Open Anyway**, then **Open**. |
| Linux | `….AppImage` (any distribution), `….deb` or `….rpm` | An AppImage runs once made executable: `chmod +x` it, or tick "Allow executing" in its properties. It installs no menu entry, so on its first launch it offers to add itself to your application menu (**Add**; **Not now** is remembered). **More → Remove from application menu** takes it out again. |

**Global shortcuts.** Keys that step the tracker while the emulator has the focus, for A Link to the Past. Open **Shortcuts → Global**, turn on **Use global shortcuts** and bind the controls you want to reach from the game: nothing is bound by default, since a global key is taken from every app. Letters, digits and punctuation need two modifiers (on macOS, Ctrl or Cmd among them: Option types characters; on Windows, not Ctrl+Alt alone: that is AltGr). Numpad keys and F13 to F24 can stand alone, but a numpad key is then taken from every app, digits included, while the shortcuts are on. The tab says what your system does:

- **Windows, macOS, Linux on X11**: the key works as soon as it is bound. One held down steps once.
- **Linux on Wayland (KDE, GNOME 48+, Hyprland)**: your desktop asks you to approve the keys, when you close the dialog; it shows the keys it chose, and **Open shortcut settings** changes them. Tried on KDE Plasma (Wayland); GNOME 48+ and Hyprland are built from the desktops' specification and not yet tried: [tell us](https://github.com/kqesar/alltp-tracker/issues) how it goes.
- **sway, i3 and any other desktop with no such service**: bind a key in your window manager to `alltp-tracker --step advance:hookshot` (the tab lists a command for every control, with a Copy button). The same command works from a Stream Deck or a script, on every system. A second launch never opens a second tracker: it hands the step to the one running.

Not in the app yet: the stream view for OBS, since OBS can neither load the app's pages nor follow its storage; stream with the web tracker in an OBS dock, as above. How the app is built and updated, and how global shortcuts work: [desktop.md](desktop.md).
