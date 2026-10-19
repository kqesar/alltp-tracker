# Changelog

All notable changes to this project are documented in this file. [release-please](https://github.com/googleapis/release-please) writes it from the [Conventional Commits](https://conventionalcommits.org/) merged since the previous release.

## [2.27.0](https://github.com/kqesar/alltp-tracker/compare/v2.26.1...v2.27.0) (2026-10-19)


### ✨ Features

* **sm:** Super Metroid as Map Rando seeds play it ([c80911a](https://github.com/kqesar/alltp-tracker/commit/c80911acdd5047462956f516f6e089e2d9b34a8d))
* **web:** autotrack Super Metroid's Map Rando seeds ([88abf2c](https://github.com/kqesar/alltp-tracker/commit/88abf2c5e07b057ddcb00b1ec4d834b58b3664b6))
* **web:** track Super Metroid as Map Rando seeds play it ([dc0708e](https://github.com/kqesar/alltp-tracker/commit/dc0708e0f32566ca0b9f7954e29d47c41899a1ea))


### 🐛 Bug Fixes

* **autotrack:** map LoROM ROM over 4 MiB, not 2 ([da9db27](https://github.com/kqesar/alltp-tracker/commit/da9db27989042bbe6f0f9fd3fb736dd3fd811077))
* **web:** keep a wide dialog's header in view ([84fd817](https://github.com/kqesar/alltp-tracker/commit/84fd81782e5d75f2f93c38c48c781393eda0081a))


### 🔧 Code Refactoring

* **web:** share autotracking's lock, dialog loader and fixtures ([e05f406](https://github.com/kqesar/alltp-tracker/commit/e05f406866526404d71a24130a3fbc5ef494f236))

## [2.26.1](https://github.com/kqesar/alltp-tracker/compare/v2.26.0...v2.26.1) (2026-10-19)


### 🔧 Code Refactoring

* **web:** load the tracked game's module on demand ([922c2fb](https://github.com/kqesar/alltp-tracker/commit/922c2fbe0486b7d152c7045f7f3bf917cc066e64))
* **web:** move ALttPR's modules under games/alttpr ([7a153c8](https://github.com/kqesar/alltp-tracker/commit/7a153c8ff37384cec18b7ac15bf3157f928e3cd5))

## [2.26.0](https://github.com/kqesar/alltp-tracker/compare/v2.25.0...v2.26.0) (2026-10-19)


### ✨ Features

* **alttpr:** read from memory the doors and holes Link goes through ([800f941](https://github.com/kqesar/alltp-tracker/commit/800f941b9ce548216f7a760ebb119a7be89f4b3f))
* **web:** note the doors Link goes through in a Crosskeys run ([7276e65](https://github.com/kqesar/alltp-tracker/commit/7276e6538c42994c26836fab0de9ef63d0b7c3de))


### 📚 Documentation

* **alttpr:** a respawn keeps the last door's slot, loading entrance 0 ([9dc9bc6](https://github.com/kqesar/alltp-tracker/commit/9dc9bc6ed3b1b343821246c8f26eb46cefbbaf7d))

## [2.25.0](https://github.com/kqesar/alltp-tracker/compare/v2.24.0...v2.25.0) (2026-10-18)


### ✨ Features

* **alttpr:** the entrance randomizer's rules in the engine's language ([9bb4c26](https://github.com/kqesar/alltp-tracker/commit/9bb4c26037d229dd56ef25ba2c38fe662163bc14))
* **alttpr:** the entrance randomizer's world, held to its own tests ([ef34c4d](https://github.com/kqesar/alltp-tracker/commit/ef34c4d33491310aa7451bcd2e3a3d26d7de099d))
* **web:** Crosskeys checks follow the entrance randomizer's logic ([39fa377](https://github.com/kqesar/alltp-tracker/commit/39fa3776356ab90cfcbe3cd7ea4792b026b3bbf0))
* **web:** say what a Crosskeys check misses, through the doors noted ([9fafe44](https://github.com/kqesar/alltp-tracker/commit/9fafe44ccd2cb6d4e9bc2c560d912909cd5fb744))

## [2.24.0](https://github.com/kqesar/alltp-tracker/compare/v2.23.0...v2.24.0) (2026-10-18)


### ✨ Features

* **alttpr:** the entrance randomizer's entrances and targets ([643aa43](https://github.com/kqesar/alltp-tracker/commit/643aa437cb4d42e033edb8956684460971daaf2b))
* **alttpr:** what each shuffled entrance may lead to ([f444b74](https://github.com/kqesar/alltp-tracker/commit/f444b746fb7f549b8daa21c1103deef3c08e4378))
* **web:** checks follow the entrance noted to their place ([df45086](https://github.com/kqesar/alltp-tracker/commit/df45086220736154a29dab7644708e5ed3a5b97b))
* **web:** note where each shuffled entrance leads ([c61daed](https://github.com/kqesar/alltp-tracker/commit/c61daed71a1504c1ca8f7b4b76dcce19163e8128))


### 🐛 Bug Fixes

* **web:** no entrance marker hidden behind its neighbour ([2d54cd0](https://github.com/kqesar/alltp-tracker/commit/2d54cd0ef631cb8a7b4f77fc95ad0aefd1591af7))

## [2.23.0](https://github.com/kqesar/alltp-tracker/compare/v2.22.0...v2.23.0) (2026-10-18)


### ✨ Features

* **alttpr:** the retro world, its rupee bow and generic keys ([d2eb13b](https://github.com/kqesar/alltp-tracker/commit/d2eb13bc11b625852995842caaac1c0160ecaa0e))
* **web:** Retro runs in logic, with their arrow and key shops ([6180ed7](https://github.com/kqesar/alltp-tracker/commit/6180ed775adc94ea697ddb7a25825ab84f52b38b))


### 🐛 Bug Fixes

* **alttpr:** read no dungeon's small keys with generic keys ([084421c](https://github.com/kqesar/alltp-tracker/commit/084421ce2eb850b2677130fbdff5395175b451ce))
* **web:** no Open logic on a run type the pack does not model ([4295370](https://github.com/kqesar/alltp-tracker/commit/4295370437c83de24689937883e94a417a3edda6))

## [2.22.0](https://github.com/kqesar/alltp-tracker/compare/v2.21.0...v2.22.0) (2026-10-18)


### ✨ Features

* **alttpr:** a Mystery run's settings, hidden until found ([2beb3a9](https://github.com/kqesar/alltp-tracker/commit/2beb3a90759152e283f73286da84e3d76c7b7e3c))
* **engine:** settings not known yet, read both ways ([e19ca68](https://github.com/kqesar/alltp-tracker/commit/e19ca68be5669a322cac36bd23c0a7efcbfbfd04))
* **web:** a Mystery run type, its settings found as the run goes ([022d5ec](https://github.com/kqesar/alltp-tracker/commit/022d5ec954c3327f11b8c56a2935b99baf63e6e4))


### 🐛 Bug Fixes

* **web:** know a Mystery race seed by its file ([3813ccd](https://github.com/kqesar/alltp-tracker/commit/3813ccd9a274da903ffaaa6dc34efa011774776f))
* **web:** tell a seed with shuffled entrances from one without ([486e2f7](https://github.com/kqesar/alltp-tracker/commit/486e2f7267acb62bcfa9e6588d844a5527a13cd5))

## [2.21.0](https://github.com/kqesar/alltp-tracker/compare/v2.20.0...v2.21.0) (2026-10-18)


### ✨ Features

* **web:** mark finds by voice, recognized on the device ([848f59d](https://github.com/kqesar/alltp-tracker/commit/848f59dc4eaa55ba6c8753babd8ff5434c3e8edf))
* **web:** the voice commands' words, grammar and meaning ([54d94b1](https://github.com/kqesar/alltp-tracker/commit/54d94b123d673126b0637b636b158ddadf83813a))

## [2.20.0](https://github.com/kqesar/alltp-tracker/compare/v2.19.0...v2.20.0) (2026-10-18)


### ✨ Features

* **alttpr:** read the ROM's own stats outside races ([8f88899](https://github.com/kqesar/alltp-tracker/commit/8f8889979b3a5719200dfa04ba1c9159f066e9f6))
* **web:** keep when each find of the run happened ([57fbd1b](https://github.com/kqesar/alltp-tracker/commit/57fbd1be13dc84fed74632020dfcf943ec60147d))
* **web:** show the run's splits, timeline and the ROM's stats in a Run tab ([65c8f29](https://github.com/kqesar/alltp-tracker/commit/65c8f2960f8bd09f9cb0745e1c4f221a9d2c3840))

## [2.19.0](https://github.com/kqesar/alltp-tracker/compare/v2.18.0...v2.19.0) (2026-10-18)


### ✨ Features

* **alttpr:** read when a game starts, and its play time outside races ([0b1b9d8](https://github.com/kqesar/alltp-tracker/commit/0b1b9d80db0d1bfacff1d2bf699bc8093e8dd196))
* **web:** show the run timer on stream, in the counters' pixel font ([6889913](https://github.com/kqesar/alltp-tracker/commit/68899131ee4ee56aa49faa9999b55f743cbfc81d))
* **web:** time the run, started and stopped with the game ([dbf869b](https://github.com/kqesar/alltp-tracker/commit/dbf869b2cbcf3b88676ac246ab57b514174e6716))


### 📚 Documentation

* give the stream view's source sizes with Ganon's Tower's row ([d5195c2](https://github.com/kqesar/alltp-tracker/commit/d5195c271fb87b2deebcaec284f710c379d011d4))

## [2.18.0](https://github.com/kqesar/alltp-tracker/compare/v2.17.0...v2.18.0) (2026-10-18)


### ✨ Features

* **web:** count Ganon's Tower's items on its own cell ([490d4de](https://github.com/kqesar/alltp-tracker/commit/490d4de4d013239045009684631d9b107d8c9bec))


### 🐛 Bug Fixes

* **web:** name the locations only an Inverted world has ([723be38](https://github.com/kqesar/alltp-tracker/commit/723be3895aeb0f337a1714daf5136337f778721d))

## [2.17.0](https://github.com/kqesar/alltp-tracker/compare/v2.16.0...v2.17.0) (2026-10-18)


### ✨ Features

* **web:** record the castle dungeons' keys on the grid ([dca8c5b](https://github.com/kqesar/alltp-tracker/commit/dca8c5b41de5f7010878efcdf6a6d279a3ff0d29))

## [2.16.0](https://github.com/kqesar/alltp-tracker/compare/v2.15.0...v2.16.0) (2026-10-18)


### ✨ Features

* **alttpr:** count the Big Red Bomb as an item ([ecd84e6](https://github.com/kqesar/alltp-tracker/commit/ecd84e68cac012b699ab751cf82ad38b2fe2fcc5))
* **alttpr:** lay out Inverted's map and sell its bomb ([12f3fda](https://github.com/kqesar/alltp-tracker/commit/12f3fda929ab39845763b035666ad6894d4ce6f8))
* **alttpr:** lay out the Inverted world and import its tests ([7a1f00e](https://github.com/kqesar/alltp-tracker/commit/7a1f00e353b3db0aabb1a7215b754e3d0ee20dd1))
* **alttpr:** port the Inverted dungeons ([876622e](https://github.com/kqesar/alltp-tracker/commit/876622ec1a1a15a9eeda2d08c53be2c44c777448))
* **alttpr:** port the Inverted overworld and escape ([a674cf5](https://github.com/kqesar/alltp-tracker/commit/a674cf5c9d0fb652d9561542200689db949a9151))
* **web:** track Inverted runs ([4536280](https://github.com/kqesar/alltp-tracker/commit/45362800a9975fdea50b7c09dd6b6a41ff821931))


### 🔧 Code Refactoring

* **alttpr:** let a derived module set a boss's rule again ([efe20d0](https://github.com/kqesar/alltp-tracker/commit/efe20d03ee5bbe2d0034b783d473cbc1aa140259))

## [2.15.0](https://github.com/kqesar/alltp-tracker/compare/v2.14.0...v2.15.0) (2026-10-18)


### ✨ Features

* **alttpr:** model the item pool and the item functionality ([a92850d](https://github.com/kqesar/alltp-tracker/commit/a92850d3b221306bc7ec2679aa5d81fa75a95d95))
* **alttpr:** read a seed's item placement, pool, functionality and accessibility ([08ca235](https://github.com/kqesar/alltp-tracker/commit/08ca2358165d9b7a0e9f7add8a8e164b06bd94ae))
* **web:** make item placement, pool, functionality and accessibility run settings ([00d642a](https://github.com/kqesar/alltp-tracker/commit/00d642ac890a66b92f64d8b5ac40e998018e145e))
* **web:** take a seed's logic settings from its file on alttpr.com ([f89dce0](https://github.com/kqesar/alltp-tracker/commit/f89dce0bab0d80919b5724ddabbd06bf6da36dd8))
* **web:** track maps, compasses and small keys outside their dungeons apart ([7e7cfc6](https://github.com/kqesar/alltp-tracker/commit/7e7cfc6049c3aea62492fc37e49cc8712d53e693))
* **web:** tune a run's crystals and logic settings in place ([0593dd8](https://github.com/kqesar/alltp-tracker/commit/0593dd81fec26234ef76842cbc71ad01475ef295))


### 📚 Documentation

* describe dungeon items by alttpr.com's levels ([5298ac1](https://github.com/kqesar/alltp-tracker/commit/5298ac148efae9f5060505eb2148b8e6c14a4ffa))
* describe the logic settings a seed's file brings ([bd15461](https://github.com/kqesar/alltp-tracker/commit/bd154616083b2e58c2918f761972ee025b863590))
* describe tuning a run's settings in place ([80a9a08](https://github.com/kqesar/alltp-tracker/commit/80a9a08457cce2d98f21a76bc68d55a50d2988be))

## [2.14.0](https://github.com/kqesar/alltp-tracker/compare/v2.13.0...v2.14.0) (2026-10-17)


### ✨ Features

* **alttpr:** read a seed's settings from its file on alttpr.com ([36960e9](https://github.com/kqesar/alltp-tracker/commit/36960e9e4acf126a7f2cb6d32b582c6cb3e87f16))
* **web:** start a run from a seed's alttpr.com link ([23e75e1](https://github.com/kqesar/alltp-tracker/commit/23e75e1c1855318b7c0ca2bae18fd4fd56f1d559))
* **web:** take a race seed's settings from its file on alttpr.com ([06cef95](https://github.com/kqesar/alltp-tracker/commit/06cef95697a97494be1441cabf6250933f0d4d68))


### 🐛 Bug Fixes

* **web:** give each crystal count its own row in the run's settings ([adc472b](https://github.com/kqesar/alltp-tracker/commit/adc472b9a01505ddeef65c4dbde2d7f38fbee952))


### 📚 Documentation

* describe seeds read from their file on alttpr.com ([b5aac64](https://github.com/kqesar/alltp-tracker/commit/b5aac64bffc902c878cf1cb6866607f394eb850f))

## [2.13.0](https://github.com/kqesar/alltp-tracker/compare/v2.12.0...v2.13.0) (2026-10-17)


### ✨ Features

* **alttpr:** define go mode per goal from upstream's win condition ([91da1bd](https://github.com/kqesar/alltp-tracker/commit/91da1bd5c5ead119ddfeb826ed1b70765c6c7a8b))
* **alttpr:** read a seed's settings from its ROM ([f03c442](https://github.com/kqesar/alltp-tracker/commit/f03c4425184537e871d83cc8cfa7f1894f1d0d93))
* **web:** carry swordless and the crystal counts in a run's settings ([50b2b37](https://github.com/kqesar/alltp-tracker/commit/50b2b372782360f73a288ec2a87702f913a025b2))
* **web:** list every check in a Checks tab beside the map ([2af9e0b](https://github.com/kqesar/alltp-tracker/commit/2af9e0b1670302073dc9d7021b3c83ac185b4285))
* **web:** say in the tooltip what a check is missing ([43b04ad](https://github.com/kqesar/alltp-tracker/commit/43b04add5bccd4ba8d14fb93d07f8c1ec73d4e00))
* **web:** say what a seed's settings mean for the run type ([13c360a](https://github.com/kqesar/alltp-tracker/commit/13c360ac3fec51676d059cee7554480506e86917))
* **web:** show the run's go mode beside the map's tabs ([1dbf4b6](https://github.com/kqesar/alltp-tracker/commit/1dbf4b6e0e758d9fa6e40786c40fbee40b309c92))
* **web:** switch the run type to the seed's, read from its ROM ([4f9d102](https://github.com/kqesar/alltp-tracker/commit/4f9d102c9cd2deceab5d3e60723cb82c3d77c594))
* **web:** work out what each check is missing, off the click's path ([1097943](https://github.com/kqesar/alltp-tracker/commit/10979432fffb76ce0527f8cfc9e28294be169a59))


### 🐛 Bug Fixes

* **web:** keep a run's settings through a new game ([0db8f1c](https://github.com/kqesar/alltp-tracker/commit/0db8f1c2f72a6d62d6d3bf25a4d6d298316e209a))


### 📚 Documentation

* describe how the seed sets the run type ([352e81b](https://github.com/kqesar/alltp-tracker/commit/352e81b9399450282f8cb23459b5ba304a9c3f3f))
* describe the Checks list, go mode and the run's analysis ([8d9d1ed](https://github.com/kqesar/alltp-tracker/commit/8d9d1ede655a27511117fade12b6a7ae33401b26))


### 🔧 Code Refactoring

* **web:** share the setup guide's tabs ([93888c8](https://github.com/kqesar/alltp-tracker/commit/93888c89766e6a2a3892cd613af080bfbe861eb9))
* **web:** stack the page's notices ([23be02d](https://github.com/kqesar/alltp-tracker/commit/23be02dbd0cbe8a5b00d4c7b17caa79776c4593e))

## [2.12.0](https://github.com/kqesar/alltp-tracker/compare/v2.11.0...v2.12.0) (2026-10-16)


### ✨ Features

* **alttpr:** decode items, checks, bosses and events from memory ([3cf2d9a](https://github.com/kqesar/alltp-tracker/commit/3cf2d9aabe9669ba7047a5d7efb5975788d5841f))
* **alttpr:** map the ALttPR memory for autotracking ([3379b68](https://github.com/kqesar/alltp-tracker/commit/3379b68e4fb5a6562c939d2417d55600497fd1a0))
* **alttpr:** map the app's legacy ids, markers and dungeons to the pack ([a96bd38](https://github.com/kqesar/alltp-tracker/commit/a96bd3829702173dc0450159dd204e9fb7613657))
* **alttpr:** place every check of the world on a map marker ([dad8c71](https://github.com/kqesar/alltp-tracker/commit/dad8c7116b9280579a126d0700affcb588297c99))
* **alttpr:** port Location::canFill and where dungeon items may sit ([2f1d070](https://github.com/kqesar/alltp-tracker/commit/2f1d07080e96dc2d2a7d022352c5aa69bbbf9f24))
* **alttpr:** read a dungeon counter by the pigeonhole principle ([05d0992](https://github.com/kqesar/alltp-tracker/commit/05d09928f293e3cd74f31b625a9dd1054137f282))
* **alttpr:** read untracked keys through a sound key model ([29e397c](https://github.com/kqesar/alltp-tracker/commit/29e397c985283aa82b7a243bacb1c637eed144c8))
* **alttpr:** recognise alttpr.com seeds and read the race flag safely ([e209f8d](https://github.com/kqesar/alltp-tracker/commit/e209f8da18cf010cf5527cb03143ea3f1a8fad00))
* **alttpr:** take the ALttPR v1.2 race profile over from the autotrack tests ([a0d6340](https://github.com/kqesar/alltp-tracker/commit/a0d63401b39e341729d4410dfc23448dcee3df31))
* **alttpr:** turn what the player records into the rules' state ([9d85003](https://github.com/kqesar/alltp-tracker/commit/9d85003476cc2101aec2817c9d8ecb23ad460c36))
* **autotrack:** fit the setup guide to a picked device before one attaches ([4676fa4](https://github.com/kqesar/alltp-tracker/commit/4676fa49cc38f24b5fd40df3d96c0aec9f6a7816))
* **web:** autotrack from one tab of the tracker at a time ([5ff0be8](https://github.com/kqesar/alltp-tracker/commit/5ff0be880fefd9106c322a136e5e53d1b6b1c997))
* **web:** draw dungeon counts from 7 to 14 ([a0c2385](https://github.com/kqesar/alltp-tracker/commit/a0c2385b9d0a8639eea512ba92621cd8d0cd746e))
* **web:** draw the map from the alttpr pack ([765f9d0](https://github.com/kqesar/alltp-tracker/commit/765f9d08434251333b79a6244ef105a827aea5ec))
* **web:** lay what autotracking reads on the board ([8203d1c](https://github.com/kqesar/alltp-tracker/commit/8203d1c959f462b00b5d07645df62dd2417f043d))
* **web:** name what autotracking read that the board leaves alone ([2650848](https://github.com/kqesar/alltp-tracker/commit/2650848a2bde50e28eb93b6e6d52d51f776a1a36))
* **web:** read a run's settings as the alttpr pack's ([1752dcc](https://github.com/kqesar/alltp-tracker/commit/1752dccbe9c16ccf91471103442b0c000503221c))
* **web:** run one autotracking session per page, lazily, from the tracker ([3620e43](https://github.com/kqesar/alltp-tracker/commit/3620e437732c653cf49503d88d81bf8ea1e4f430))
* **web:** save checked locations by the pack's ids (version 6) ([d6cd1c4](https://github.com/kqesar/alltp-tracker/commit/d6cd1c4fcc1c68a8d8de3ccb71a7346f1c8be9e4))
* **web:** set up and watch autotracking from the toolbar ([be0ba01](https://github.com/kqesar/alltp-tracker/commit/be0ba016f8533cc090eec5fd8efa2a34a9a1e25a))
* **web:** show a location seen but not reachable yet as its own state ([8e42d5d](https://github.com/kqesar/alltp-tracker/commit/8e42d5d2ccd5a41a304d362dbed64549f91d5b2f))
* **web:** solve the run with the alttpr pack ([ff3bc76](https://github.com/kqesar/alltp-tracker/commit/ff3bc76ee2a17c1cd00b3dbecf9d4a41c28520fc))
* **web:** track each dungeon's map and compass in keysanity ([726bbfe](https://github.com/kqesar/alltp-tracker/commit/726bbfe9f1de8cad974a8ceb6e00bae806bcfb48))


### 🐛 Bug Fixes

* **autotrack:** read a drop after a working read as a lost connection ([d97d85b](https://github.com/kqesar/alltp-tracker/commit/d97d85b5584395a9b43c97d6ded973b37be09a80))
* **web:** take each dungeon's small keys from the pack, none for Eastern ([623c124](https://github.com/kqesar/alltp-tracker/commit/623c124320e7fd8d2a63738dc2d7f4c085a9ba90))


### 📚 Documentation

* **autotrack:** point at the race profile's new home in the pack ([4e5e638](https://github.com/kqesar/alltp-tracker/commit/4e5e6381295972599ff8f95b33705f89d85f6d3d))
* **claude:** describe the autotracking UI, its store and the fold order ([9b4f61a](https://github.com/kqesar/alltp-tracker/commit/9b4f61a7f17dac1002319931379e5bde0b16d858))
* describe how the board follows the game ([d8f2ec6](https://github.com/kqesar/alltp-tracker/commit/d8f2ec68acdac8d432a069f81d417efd3d2c258b))
* point to the in-app autotracking setup ([27f8652](https://github.com/kqesar/alltp-tracker/commit/27f8652462a485c7a2b84de72016e7255df6fa23))


### 🔧 Code Refactoring

* **web:** drop the 2017 logic for the alttpr pack's ([8ae724b](https://github.com/kqesar/alltp-tracker/commit/8ae724b6baf15c2d403f613a91bbad07b1d59ab4))
* **web:** read the tracker's items through one table of the pack's ([c2f980a](https://github.com/kqesar/alltp-tracker/commit/c2f980a9f6b569902fe4fb673e476a4ee4cfc89f))

## [2.11.0](https://github.com/kqesar/alltp-tracker/compare/v2.10.1...v2.11.0) (2026-10-16)


### ✨ Features

* **alttpr:** derive Palace of Darkness's key fact from the items ([b613dbb](https://github.com/kqesar/alltp-tracker/commit/b613dbba168b0efcd9e81919bb645b10d3f6a115))
* **alttpr:** each boss's canBeat from Boss.php, and the boss of each dungeon ([3943403](https://github.com/kqesar/alltp-tracker/commit/394340397e20be3f3454b76c349e897ee6eeb737))
* **alttpr:** medallion pads as knowledge in the state ([5eca633](https://github.com/kqesar/alltp-tracker/commit/5eca633d39b23e8993d5a076d0d127187d898363))
* **alttpr:** model the items as the randomizer counts them ([3ac1e03](https://github.com/kqesar/alltp-tracker/commit/3ac1e035e623c0d6ea1046d57209f4779b77fa3f))
* **alttpr:** port Desert Palace ([311cc72](https://github.com/kqesar/alltp-tracker/commit/311cc72ec2dcd03e0c90fb07475142bf1cabde7d))
* **alttpr:** port East Death Mountain from LightWorld/DeathMountain/East.php ([2151427](https://github.com/kqesar/alltp-tracker/commit/2151427ec50b9047b3798ab9e5eadd7cb1476294))
* **alttpr:** port Eastern Palace, the pilot region, against its upstream cases ([72435a3](https://github.com/kqesar/alltp-tracker/commit/72435a388420926882e8ebb9ddc927eeda3aeacb))
* **alttpr:** port Ganon's Tower from GanonsTower.php ([445f222](https://github.com/kqesar/alltp-tracker/commit/445f222a480371a4cf01b69403a81b8fcfc26882))
* **alttpr:** port Hyrule Castle Tower, held to HyruleCastleTowerTest ([acfdb28](https://github.com/kqesar/alltp-tracker/commit/acfdb286658985a3c4f646f20fa8cdfa4ff10480))
* **alttpr:** port Ice Palace, against its upstream cases ([62eae68](https://github.com/kqesar/alltp-tracker/commit/62eae68c4c9fa50c803850bde184e5e8cd008bd6))
* **alttpr:** port Misery Mire from MiseryMire.php ([b1d647c](https://github.com/kqesar/alltp-tracker/commit/b1d647c85288679eb1375699aa352a310198fc14))
* **alttpr:** port North East Dark World and Ganon, from DarkWorld/NorthEast.php ([fea34ff](https://github.com/kqesar/alltp-tracker/commit/fea34ffc3b362d812ec9db60a0431cfb9c74b1ce))
* **alttpr:** port North West Dark World, from DarkWorld/NorthWest.php ([2b71f15](https://github.com/kqesar/alltp-tracker/commit/2b71f15f0104cd84554098f1cd17bbf4c9de134c))
* **alttpr:** port Open's escape, held to OpenTest ([ca42f6e](https://github.com/kqesar/alltp-tracker/commit/ca42f6e6d0754c578b1367a40d59b706aca982cc))
* **alttpr:** port Palace of Darkness ([9c13684](https://github.com/kqesar/alltp-tracker/commit/9c1368439309d62b5dfb79191548b7fb65e90be8))
* **alttpr:** port Skull Woods ([cf25b25](https://github.com/kqesar/alltp-tracker/commit/cf25b253cc4d2a5928c87aebe6c17d71defccf06))
* **alttpr:** port South Dark World, from DarkWorld/South.php ([aa9bc1b](https://github.com/kqesar/alltp-tracker/commit/aa9bc1ba51ecdbe29dedf01945f54035c05423d3))
* **alttpr:** port Swamp Palace ([8a6bf37](https://github.com/kqesar/alltp-tracker/commit/8a6bf37f5b0dfd5b200ff1e9a3c5a2c14cba9e87))
* **alttpr:** port the Dark World's East Death Mountain, Hookshot and Superbunny caves ([4ef88d5](https://github.com/kqesar/alltp-tracker/commit/4ef88d5853bbe6c56eb88b87fe19ef6088da6bf8))
* **alttpr:** port the Dark World's West Death Mountain, Spike Cave ([5611be8](https://github.com/kqesar/alltp-tracker/commit/5611be8c1a614781e2ad40da5be2e90df239747d))
* **alttpr:** port the fairy fountains' prizes from Fountains.php ([5742ce2](https://github.com/kqesar/alltp-tracker/commit/5742ce215dc032098f6e1e9c1d50991ac83df56d))
* **alttpr:** port the medallion pads from Medallions.php ([5c807be](https://github.com/kqesar/alltp-tracker/commit/5c807be862bc8b551bed8c6e77d1d36a98187289))
* **alttpr:** port the Mire, from DarkWorld/Mire.php ([e43db30](https://github.com/kqesar/alltp-tracker/commit/e43db30ca99dce648bb230100e1e10f65ee33b86))
* **alttpr:** port the North East Light World, Sahasrahla to Zora's waterfall ([d2110bf](https://github.com/kqesar/alltp-tracker/commit/d2110bf8e64ae2247da6a83950e3539a04ea872b))
* **alttpr:** port the North West Light World, the Lost Woods to the graveyard ([3e72e4f](https://github.com/kqesar/alltp-tracker/commit/3e72e4f5fa37a796d423bb1875787f880ed8437d))
* **alttpr:** port the South Light World, Link's House to the desert and the lake ([b178af5](https://github.com/kqesar/alltp-tracker/commit/b178af5dce4336c61d9bf09aae6daefe74648f17))
* **alttpr:** port the Standard escape, held to HyruleCastleEscapeTest ([5f6f854](https://github.com/kqesar/alltp-tracker/commit/5f6f854289563ad4224051c9a0daad92be9b6b57))
* **alttpr:** port Thieves' Town ([b39a4b1](https://github.com/kqesar/alltp-tracker/commit/b39a4b1292d391097e753041778ee283c3742ea5))
* **alttpr:** port Tower of Hera, its two ways in as parts of the module ([9c42e34](https://github.com/kqesar/alltp-tracker/commit/9c42e348a95de3f7ae7e434f0a2be0a40d7bc76a))
* **alttpr:** port Turtle Rock from TurtleRock.php, with its three ways in ([38f0ee3](https://github.com/kqesar/alltp-tracker/commit/38f0ee387568b2c30a0660449a995cf736d29d3d))
* **alttpr:** port West Death Mountain from LightWorld/DeathMountain/West.php ([4c8e169](https://github.com/kqesar/alltp-tracker/commit/4c8e169eab2694a68d189d253aa423b7cc657c42))
* **alttpr:** settings the rules compile with, from World.php ([94e363b](https://github.com/kqesar/alltp-tracker/commit/94e363b213c8a693d2d572759c54e4f876d38860))
* **alttpr:** the item helpers of ItemCollection.php as named rules ([ee2317b](https://github.com/kqesar/alltp-tracker/commit/ee2317bb73863463088c7205cad43e9d64f21f0c))
* **alttpr:** the world model, from Region.php and the two worlds ([208265b](https://github.com/kqesar/alltp-tracker/commit/208265bf669a94bf115d381ec2700b443f252af5))
* **autotrack:** add the session state machine and its diagnostics ([6200cc4](https://github.com/kqesar/alltp-tracker/commit/6200cc4ceaaf78587f6755729745222457cadd0b))
* **autotrack:** add the usb2snes transport and read planning ([a67c62a](https://github.com/kqesar/alltp-tracker/commit/a67c62a3d45ccf7da95b0718897c01ef19ae97ae))
* **autotrack:** model the setup guide and a copyable diagnostic report ([313f1a4](https://github.com/kqesar/alltp-tracker/commit/313f1a48070f8efb4ddb1909d2c019dd1302ee79))
* **autotrack:** poll a pack's ranges with Race Mode compliant by construction ([a3c7b4a](https://github.com/kqesar/alltp-tracker/commit/a3c7b4a8aac1b7fda6ddc90a731ce9e3fd03dca0))
* **engine:** add compile-time settings to the requirement language ([a7edfe3](https://github.com/kqesar/alltp-tracker/commit/a7edfe3941e6eca375aa241551415f3a469b5d1b))
* **engine:** explain a location's value with its route and a trace ([4d8ef66](https://github.com/kqesar/alltp-tracker/commit/4d8ef661405d0c66760be5ccdcf888b9530a4d10))
* **engine:** let location requirements reach() another region ([7f744f2](https://github.com/kqesar/alltp-tracker/commit/7f744f2eaf2254656c2f6f70f3300179af371523))
* **engine:** list what blocks a location with analyze().blockers ([3ad9050](https://github.com/kqesar/alltp-tracker/commit/3ad905080c0e8b032e5dc76fda89c22f8d5a13e7))
* **engine:** solve what the player can see into a visible channel ([43d1666](https://github.com/kqesar/alltp-tracker/commit/43d1666364d14368cb7ff98efaed1386ec18f826))
* **web:** add a stream view for OBS browser sources ([42f762c](https://github.com/kqesar/alltp-tracker/commit/42f762cad3f5ab94a9bec406aa047ef449cb795b))
* **web:** draw missing items greyed in the app as on stream ([24c87b6](https://github.com/kqesar/alltp-tracker/commit/24c87b62d4a3b0b61577957049a1b1728f560f35))
* **web:** draw the favicon and app icons as pixel-art Triforce ([d401303](https://github.com/kqesar/alltp-tracker/commit/d401303cd5ff1ac32dbff14775c3e7acd19f4605))
* **web:** fold the secondary toolbar actions into a More menu ([eedba0d](https://github.com/kqesar/alltp-tracker/commit/eedba0d25ac360cbd578f10989dd1abe1e37d8d3))
* **web:** give the item icons a 1-game-pixel black outline ([feb7eb5](https://github.com/kqesar/alltp-tracker/commit/feb7eb58d3f2e642ca41bf69ec7dd3508d9a2aa8))
* **web:** give the keysanity keys the items' black outline ([2044642](https://github.com/kqesar/alltp-tracker/commit/2044642ea94a7b3d86731ffeb53042c44f6f90ad))
* **web:** grey a boss not beaten like a missing item ([a6709b6](https://github.com/kqesar/alltp-tracker/commit/a6709b6297151334b76ed697bc1fa1d1c2ea15a2))
* **web:** grey a key not found like a missing item, with no box ([5b86340](https://github.com/kqesar/alltp-tracker/commit/5b863405c8d36b6d327cf39a54056a22334a5fc0))
* **web:** keep a keyboard shortcut keymap as a device preference ([ada6b80](https://github.com/kqesar/alltp-tracker/commit/ada6b80ab1e50ada6a95db637c156014c011e9dd))
* **web:** let the stream view take new versions on its own ([b0cf5e4](https://github.com/kqesar/alltp-tracker/commit/b0cf5e48eddcd3cd31f630b46adca2a58a91f9b2))
* **web:** open the stream view from the toolbar ([f0bd4ec](https://github.com/kqesar/alltp-tracker/commit/f0bd4ec222539450b55197bcd11cd1a82910d4f2))
* **web:** rebind the keyboard shortcuts in a dialog ([c6f94e6](https://github.com/kqesar/alltp-tracker/commit/c6f94e613539a394d02399f260f1d18064e7c2e5))
* **web:** show the latest version on reload, offer it to open tabs ([4f17246](https://github.com/kqesar/alltp-tracker/commit/4f1724652a026cd28dd3a99134a94f11fcbf5b9b))
* **web:** step grid controls with keyboard shortcuts ([f3c7485](https://github.com/kqesar/alltp-tracker/commit/f3c748575e63b052a651077ac25d0ee60a9afe6a))
* **web:** take the item shortcuts in the stream view too ([013d19e](https://github.com/kqesar/alltp-tracker/commit/013d19ec952ee70192e7216fa98c59aace7356af))
* **web:** work offline and install as an app ([f724898](https://github.com/kqesar/alltp-tracker/commit/f72489892516abfcacacdb92d70bdc9a06af7f7b))


### 🐛 Bug Fixes

* **alttpr:** name the state's names once, for every compiled world ([4ea1827](https://github.com/kqesar/alltp-tracker/commit/4ea1827a57881438373652d0e7148218dd69d23e))
* **autotrack:** end a refused connection on its error event too ([96398fe](https://github.com/kqesar/alltp-tracker/commit/96398fe65e2061c19c80cff59d5b10328bc62758))
* **autotrack:** read the version SNI actually reports ([6166614](https://github.com/kqesar/alltp-tracker/commit/6166614039fc2b19c295a58a6dc29c0e2d69b54e))
* **claude:** run the Biome hook in the worktree an agent edits ([f00727a](https://github.com/kqesar/alltp-tracker/commit/f00727ac3cbc7f37a204350f2f60d185e5462281))
* **web:** check every image for a backdrop, not a hand-picked list ([1451082](https://github.com/kqesar/alltp-tracker/commit/14510822602dc9f5e89bcea43d2fc55660899a07))
* **web:** draw the chest counts and the missing sword and shield opaque ([284fcc0](https://github.com/kqesar/alltp-tracker/commit/284fcc0abe732b12717c48508ba53530613fa3c9))
* **web:** fold the toolbar by its measured fit, not by breakpoints ([ce604ec](https://github.com/kqesar/alltp-tracker/commit/ce604ec8f541057374a13434c4e2a6782fb53d64))
* **web:** fold the toolbar further until it holds on two rows ([93b2afd](https://github.com/kqesar/alltp-tracker/commit/93b2afd690825a05cad4017e572978880ef55841))
* **web:** give the bottle icons a transparent background ([3b77679](https://github.com/kqesar/alltp-tracker/commit/3b776799620f77374c525180ab8fd1b59633bec8))
* **web:** keep the skip links hidden at any text size ([e62735c](https://github.com/kqesar/alltp-tracker/commit/e62735cb7b0e6f5f3344c38fe9c106ed97da55ec))
* **web:** let a press on a tooltip reach the item it covers ([6d7c84c](https://github.com/kqesar/alltp-tracker/commit/6d7c84c39f9eb90c64e8f41ef643ae355f0b3bf5))
* **web:** say Cmd+Z on a Mac ([648bcf0](https://github.com/kqesar/alltp-tracker/commit/648bcf08f785535fdec3ae40974cabd131d1fc81))
* **web:** show the focus ring on the toolbar buttons ([c41a64d](https://github.com/kqesar/alltp-tracker/commit/c41a64da2d9b19b6cf9610251259517029c585a8))
* **web:** show the toolbar labels only where they fit on one row ([86398fa](https://github.com/kqesar/alltp-tracker/commit/86398fa7b8cb2523232579386d1237d490e558c3))


### ⚡ Performance Improvements

* **web:** load the shortcuts dialog's code apart from the app ([d618569](https://github.com/kqesar/alltp-tracker/commit/d6185693ef30ac7017085cc17f0060f0877f6018))


### 📚 Documentation

* **autotrack:** cover the RetroArch AppImage in the Linux setup guide ([2727f10](https://github.com/kqesar/alltp-tracker/commit/2727f1089241411bcde66ecbeb21cd2ca8bb4dac))
* **autotrack:** document the architecture, diagnostic codes and sources ([0181e1e](https://github.com/kqesar/alltp-tracker/commit/0181e1e9b3fc13ea157522dc81055d125688e707))
* **autotrack:** record what a real SNI and RetroArch session showed ([76f3e24](https://github.com/kqesar/alltp-tracker/commit/76f3e24f9f8e9da503587d4f3414f183e5449f63))
* **claude:** add the logic-drift skill ([8b5abda](https://github.com/kqesar/alltp-tracker/commit/8b5abdaa9214cdc9425ff0a0d7e3e4d8099502ae))
* **claude:** list the autotrack workspace and its commit scope ([8acb2f7](https://github.com/kqesar/alltp-tracker/commit/8acb2f7524972d269276b00e5c11bfa5f854d944))
* **claude:** note the stream view and the service worker ([681f1d4](https://github.com/kqesar/alltp-tracker/commit/681f1d48368a1043e5a386dc4510aca6915566f8))
* describe the alttpr pack and add its area rule ([6b1a922](https://github.com/kqesar/alltp-tracker/commit/6b1a922672354f3c25e89e25d704255385209e7b))
* **engine:** drop the settled wiring question ([f7146c4](https://github.com/kqesar/alltp-tracker/commit/f7146c416731449bbd9d6de1c5a4e4783547b395))
* explain streaming with OBS ([952a47a](https://github.com/kqesar/alltp-tracker/commit/952a47abd0f0333aae511ae30c36fff5b15d6b2b))


### 🔧 Code Refactoring

* **web:** name the grid rows shown on screen ([d43eae4](https://github.com/kqesar/alltp-tracker/commit/d43eae43aef4975035ffff1a521d77284808e7cd))
* **web:** share the board's key guard and the medallion step ([dc18acc](https://github.com/kqesar/alltp-tracker/commit/dc18acc6f1d2b5a77080d7eede644c03aeba91bd))

### [2.10.1](https://github.com/kqesar/alltp-tracker/compare/v2.10.0...v2.10.1) (2026-10-16)


### 🐛 Bug Fixes

* **build:** run the pinned lint-staged and commitlint from the hooks ([f898cb2](https://github.com/kqesar/alltp-tracker/commit/f898cb222b035971d306c6bef4434e90b180424b))


### 📚 Documentation

* **claude:** add the engine's rules ([d1f647c](https://github.com/kqesar/alltp-tracker/commit/d1f647cb4d783af8aebb174bd6bdbd5985242700))
* describe the workspace layout ([a19d71e](https://github.com/kqesar/alltp-tracker/commit/a19d71eed0378b0f3ecac767ba4c39b0529d8dc9))

## [2.10.0](https://github.com/kqesar/alltp-tracker/compare/v2.9.0...v2.10.0) (2026-10-16)


### 🐛 Bug Fixes

* **assets:** give item icons a transparent background ([a787eed](https://github.com/kqesar/alltp-tracker/commit/a787eed38f5a8161bd727a82660c7809255bce5f))


### ✨ Features

* **engine:** add a small ALttP sample world ([9992393](https://github.com/kqesar/alltp-tracker/commit/9992393e27e9e45cc46cb296c49baa6eddc0282b))
* **engine:** add the @alltp/engine workspace package with Kleene logic ([c1f6e38](https://github.com/kqesar/alltp-tracker/commit/c1f6e3845516c9d3dc485dd7422f41285626d187))
* **engine:** compile worlds and solve region/location availability ([c5f224a](https://github.com/kqesar/alltp-tracker/commit/c5f224ab5e03617252e571de41fa2ee688116ae7))
* **engine:** load helper/group rules and evaluate requirements ([f7ca2ff](https://github.com/kqesar/alltp-tracker/commit/f7ca2ffec7d85169963c5aed743480ce4e60ca75))
* **engine:** parse and print the requirement DSL ([9e891ae](https://github.com/kqesar/alltp-tracker/commit/9e891aeb3419fc951a6308a92d4b473cec81f2bf))


### 📚 Documentation

* **engine:** document the design, DSL grammar, solver and Phase 2 questions ([2edee41](https://github.com/kqesar/alltp-tracker/commit/2edee418002690d1bdfc3dea4b4fdc16cad0fe8c))

## [2.9.0](https://github.com/kqesar/alltp-tracker/compare/v2.8.1...v2.9.0) (2026-10-16)


### 🔧 Code Refactoring

* **store:** serializable progress, one boss source, persist v2 ([c7ca268](https://github.com/kqesar/alltp-tracker/commit/c7ca2687d13ec336454423c2c619732179cff74d))


### 📚 Documentation

* flag the static, front-only platform when it starts to block ([b555a71](https://github.com/kqesar/alltp-tracker/commit/b555a71f9c3d62db2c7e9aa6413ab385152f7334))
* keep the architecture fitted to the need ([f412ddb](https://github.com/kqesar/alltp-tracker/commit/f412ddb8045e325f3315967227ee0d2c478baafa))
* keep the tracker's design current ([1853bf3](https://github.com/kqesar/alltp-tracker/commit/1853bf33c852c2ec2db3aad37d814fec07190b2f))
* set the quality bar for the tracker in CLAUDE.md ([c08b8ff](https://github.com/kqesar/alltp-tracker/commit/c08b8ff97684b12a999814363d2b9e4186a72599))


### ✨ Features

* **layout:** fluid shell with an in-flow toolbar ([b1f4ff9](https://github.com/kqesar/alltp-tracker/commit/b1f4ff94fbd6b50470f6f98588bf3ec8310642ac))
* **map:** two-world map with button markers ([8d3315a](https://github.com/kqesar/alltp-tracker/commit/8d3315a706a2eed741ba15d26718b93e7952a606))
* **save:** validate imports, confirm before overwriting, native dialogs ([0538b3d](https://github.com/kqesar/alltp-tracker/commit/0538b3dd81290c2cf2ed3dec3097fb0c14d0df56))
* **store:** undo/redo and cross-tab sync ([b66e17b](https://github.com/kqesar/alltp-tracker/commit/b66e17b88b298917483412f9ab757fe6e861dfdc))
* **tracker:** boss cells, right-click, roving keyboard navigation ([8d77674](https://github.com/kqesar/alltp-tracker/commit/8d7767466cc157f70fbcdcafae87ba90d0d228a3))
* **ui:** anchored tooltip replaces the caption bar ([f0021fa](https://github.com/kqesar/alltp-tracker/commit/f0021faa0f25361264d6455e52a94cb2c4d27815))
* **ui:** compact toolbar and header on small screens ([6f2c93f](https://github.com/kqesar/alltp-tracker/commit/6f2c93f0449b68d3f29a476557dc13b7ed7bd8e6))


### 🐛 Bug Fixes

* **a11y:** name header links by their visible text ([a56ff2b](https://github.com/kqesar/alltp-tracker/commit/a56ff2b1e9db02dd2da359ec3bc385f7efd5718e))
* announce boss state correctly and gate bosses on keysanity ([3bbc704](https://github.com/kqesar/alltp-tracker/commit/3bbc704115666e083450a36d1e92d958a94770a5))
* **data:** remove the duplicate West of Sanctuary chest ([3f0b5d7](https://github.com/kqesar/alltp-tracker/commit/3f0b5d72f92735f517e6574ad4405d56fd4469bc))
* **lint:** sort tsconfig.node.json and keep Playwright output out of Biome ([9474604](https://github.com/kqesar/alltp-tracker/commit/9474604fef289eb9341de0bbab0ec1f8de7445be))

### [2.8.1](https://github.com/kqesar/alltp-tracker/compare/v2.8.0...v2.8.1) (2026-09-07)


### 🐛 Bug Fixes

* **css:** align biome schema version and drop unused .caption selectors ([0bd76b4](https://github.com/kqesar/alltp-tracker/commit/0bd76b4162e02289cfa572c887da05a4979cb0c9))
* **dependabot:** move commit-message onto the multi-ecosystem group ([d9aa0a8](https://github.com/kqesar/alltp-tracker/commit/d9aa0a80e7c4b49b56bebadec59642b1ecbafb85))
* **test:** restore coverage and typecheck under vitest 5 ([8bb6a6d](https://github.com/kqesar/alltp-tracker/commit/8bb6a6d9c3536ad3c529f5f829f477ca22c22cca))

## [2.8.0](https://github.com/kqesar/alltp-tracker/compare/v2.7.1...v2.8.0) (2026-09-07)


### ✨ Features

* add docket and github actions ([#157](https://github.com/kqesar/alltp-tracker/issues/157)) ([1bb54ba](https://github.com/kqesar/alltp-tracker/commit/1bb54ba2fa45b05c5f347c99130ee1b381253d89))

### [2.7.1](https://github.com/kqesar/alltp-tracker/compare/v2.7.0...v2.7.1) (2026-08-10)


### 🔧 Code Refactoring

* halve the codebase, fix the mobile tap bug, and make the map layout reachable ([#149](https://github.com/kqesar/alltp-tracker/issues/149)) ([f9be8aa](https://github.com/kqesar/alltp-tracker/commit/f9be8aab2937483479a5dad4d57f5ac2c1d940e6))

## [2.7.0](https://github.com/kqesar/alltp-tracker/compare/v2.6.0...v2.7.0) (2026-06-30)


### ✨ Features

* show the active run settings in the preset modal ([#138](https://github.com/kqesar/alltp-tracker/issues/138)) ([7022fb1](https://github.com/kqesar/alltp-tracker/commit/7022fb15f893fb01efca02cbeecefc60ca92738d))

## [2.6.0](https://github.com/kqesar/alltp-tracker/compare/v2.5.0...v2.6.0) (2026-06-30)


### ✨ Features

* run-type preset selection framework ([#136](https://github.com/kqesar/alltp-tracker/issues/136)) ([41ba75d](https://github.com/kqesar/alltp-tracker/commit/41ba75d59665c6ecda13fe66a54a6f3d708dbcd5))

## [2.5.0](https://github.com/kqesar/alltp-tracker/compare/v2.4.1...v2.5.0) (2026-06-30)


### ✨ Features

* coherent color system and real modal dialogs ([#134](https://github.com/kqesar/alltp-tracker/issues/134)) ([f2a3b74](https://github.com/kqesar/alltp-tracker/commit/f2a3b742f5946f52897a81907e22c163c61ede3c))

### [2.4.1](https://github.com/kqesar/alltp-tracker/compare/v2.4.0...v2.4.1) (2026-06-30)


### 🔧 Code Refactoring

* replace remaining magic numbers with named constants ([#132](https://github.com/kqesar/alltp-tracker/issues/132)) ([54d419e](https://github.com/kqesar/alltp-tracker/commit/54d419e976b6e933114ee24d21d3ee9d69ef366f))

## [2.4.0](https://github.com/kqesar/alltp-tracker/compare/v2.3.19...v2.4.0) (2026-06-30)


### ✨ Features

* persist tracker progress and add save controls ([#126](https://github.com/kqesar/alltp-tracker/issues/126)) ([472c403](https://github.com/kqesar/alltp-tracker/commit/472c40316fd6b23ad3d4228eb0ddc860aa9ec600))

### [2.3.19](https://github.com/kqesar/alltp-tracker/compare/v2.3.18...v2.3.19) (2026-06-29)


### 🐛 Bug Fixes

* remove old code ql ([#121](https://github.com/kqesar/alltp-tracker/issues/121)) ([1ccd9c6](https://github.com/kqesar/alltp-tracker/commit/1ccd9c6b6031151af2cd57a23b0484e9f78f38b2))

### [2.3.18](https://github.com/kqesar/alltp-tracker/compare/v2.3.17...v2.3.18) (2026-01-05)

### [2.3.17](https://github.com/kqesar/alltp-tracker/compare/v2.3.16...v2.3.17) (2026-01-05)

### [2.3.16](https://github.com/kqesar/alltp-tracker/compare/v2.3.15...v2.3.16) (2026-01-05)

### [2.3.15](https://github.com/kqesar/alltp-tracker/compare/v2.3.14...v2.3.15) (2026-01-04)

### [2.3.14](https://github.com/kqesar/alltp-tracker/compare/v2.3.13...v2.3.14) (2026-01-04)

### [2.3.13](https://github.com/kqesar/alltp-tracker/compare/v2.3.12...v2.3.13) (2026-01-04)

### [2.3.12](https://github.com/kqesar/alltp-tracker/compare/v2.3.11...v2.3.12) (2025-10-27)

### [2.3.11](https://github.com/kqesar/alltp-tracker/compare/v2.3.10...v2.3.11) (2025-10-27)

### [2.3.10](https://github.com/kqesar/alltp-tracker/compare/v2.3.9...v2.3.10) (2025-10-27)

### [2.3.9](https://github.com/kqesar/alltp-tracker/compare/v2.3.8...v2.3.9) (2025-09-22)

### [2.3.8](https://github.com/kqesar/alltp-tracker/compare/v2.3.7...v2.3.8) (2025-09-17)

### [2.3.7](https://github.com/kqesar/alltp-tracker/compare/v2.3.6...v2.3.7) (2025-08-26)


### 🐛 Bug Fixes

* remove 2 badges ([#67](https://github.com/kqesar/alltp-tracker/issues/67)) ([79671b5](https://github.com/kqesar/alltp-tracker/commit/79671b52cb60e4f7e827636f054169a07c964c11))

### [2.3.6](https://github.com/kqesar/alltp-tracker/compare/v2.3.5...v2.3.6) (2025-08-26)


### 📚 Documentation

* add professional status badges to README ([#65](https://github.com/kqesar/alltp-tracker/issues/65)) ([398d82e](https://github.com/kqesar/alltp-tracker/commit/398d82e1466782311cdf18f47377a34f2a7ef5dd))

### [2.3.5](https://github.com/kqesar/alltp-tracker/compare/v2.3.4...v2.3.5) (2025-08-25)

### [2.3.4](https://github.com/kqesar/alltp-tracker/compare/v2.3.3...v2.3.4) (2025-08-25)

### [2.3.3](https://github.com/kqesar/alltp-tracker/compare/v2.3.2...v2.3.3) (2025-08-25)

### [2.3.2](https://github.com/kqesar/alltp-tracker/compare/v2.3.1...v2.3.2) (2025-08-18)

### [2.3.1](https://github.com/kqesar/alltp-tracker/compare/v2.3.0...v2.3.1) (2025-08-15)


### 🐛 Bug Fixes

* useless break and variable medaillon ([#50](https://github.com/kqesar/alltp-tracker/issues/50)) ([89ebe87](https://github.com/kqesar/alltp-tracker/commit/89ebe87c9bb473a1ebbcb13ebff207fba9528ec2))

## [2.3.0](https://github.com/kqesar/alltp-tracker/compare/v2.2.1...v2.3.0) (2025-08-14)


### ✨ Features

* add big keys management ([#47](https://github.com/kqesar/alltp-tracker/issues/47)) ([098b9ec](https://github.com/kqesar/alltp-tracker/commit/098b9ec71807d3abe1fdfe1f721f52b03a69e79d))
* add little keys management ([#48](https://github.com/kqesar/alltp-tracker/issues/48)) ([85eee48](https://github.com/kqesar/alltp-tracker/commit/85eee480065985ce43fab50373e4db1cf9189f3a))

### [2.2.1](https://github.com/kqesar/alltp-tracker/compare/v2.2.0...v2.2.1) (2025-08-14)


### 🐛 Bug Fixes

* remove tooltip and align tracker ([68c9a88](https://github.com/kqesar/alltp-tracker/commit/68c9a8810d5ff20077be0cad18829b60f71d4a9f))

## [2.2.0](https://github.com/kqesar/alltp-tracker/compare/v2.1.0...v2.2.0) (2025-08-14)


### 🐛 Bug Fixes

* fix some bugs ([4b09909](https://github.com/kqesar/alltp-tracker/commit/4b0990999f9b3112a6ce35708b5cf605aa191022))
* update path zelda triforce ([5dc51cb](https://github.com/kqesar/alltp-tracker/commit/5dc51cb11d07ec89004bdeff11febfb5d14eb5ed))


### ✨ Features

* add more mobile responsive ([4c83465](https://github.com/kqesar/alltp-tracker/commit/4c83465c0da974146c36a9e9243bc2bb296b39c1))
* Add tooltip Modal to help to use tracker ([865a0a6](https://github.com/kqesar/alltp-tracker/commit/865a0a617a14b1dca87f82e1694155640eafd668))
* **tracker:** enhance tracker navigation ([2441f3f](https://github.com/kqesar/alltp-tracker/commit/2441f3ff1520bab8a478235efb2e7f59072c05c3))

## [2.1.0](https://github.com/kqesar/alltp-tracker/compare/v2.0.2...v2.1.0) (2025-08-10)


### 🔧 Code Refactoring

* split in dedicated css files and add header bare ([21a8446](https://github.com/kqesar/alltp-tracker/commit/21a84461228a28936b123804292bde1ac5c5a6c4))


### ✨ Features

* give more compliant for w3c and a11y ([8fe44d2](https://github.com/kqesar/alltp-tracker/commit/8fe44d25fdd40bb306fb22c47b77bc2041d29b6e))
* move table layout to grid layout ([b390406](https://github.com/kqesar/alltp-tracker/commit/b390406c9a92afad2606c11c89b99e60096a33b6))


### ⚡ Performance Improvements

* improve w3c standard to full grid css layout ([1fa12ea](https://github.com/kqesar/alltp-tracker/commit/1fa12ea4311ed0a9efa09d25661085eb115d8478))

### [2.0.2](https://github.com/kqesar/alltp-tracker/compare/v2.0.1...v2.0.2) (2025-08-10)

### [2.0.1](https://github.com/kqesar/alltp-tracker/compare/v1.3.0...v2.0.1) (2025-08-10)

## [1.3.0](https://github.com/kqesar/alltp-tracker/compare/v1.2.6...v1.3.0) (2025-08-10)


### 🐛 Bug Fixes

* add more img in caption [#19](https://github.com/kqesar/alltp-tracker/issues/19) ([26da441](https://github.com/kqesar/alltp-tracker/commit/26da441d9eeac562154ce0e33db8848de8749f89))
* change import, update instructions and fix tests ([ffb5fc6](https://github.com/kqesar/alltp-tracker/commit/ffb5fc63d4fc2911e37b57a4d0f956556c0ef817))


### 🔧 Code Refactoring

* Add DungeonBoss component ([2a3fbcb](https://github.com/kqesar/alltp-tracker/commit/2a3fbcb2d59114f4cbf3524345a04b499d7fbf02))
* add more components for map ([75be449](https://github.com/kqesar/alltp-tracker/commit/75be44945e73ade1e3420c7e7454b8c63f626efc))
* create TrackerGrid and sub-folders ([3466b9c](https://github.com/kqesar/alltp-tracker/commit/3466b9c02daca89d62acda168a12f93841d4474b))
* delete duplicate component and update import ([ea3d117](https://github.com/kqesar/alltp-tracker/commit/ea3d117f251e0747ac93c50da65629c0ad766710))
* get functions and data from store ([c2753df](https://github.com/kqesar/alltp-tracker/commit/c2753df2b33ff41d461aca906f33e6aaed865486))
* **items:** create corner table component ([7f952cc](https://github.com/kqesar/alltp-tracker/commit/7f952ccc17dedc76facb5b939c6622f54e067fcd))
* move asset path ([0646ced](https://github.com/kqesar/alltp-tracker/commit/0646ced9350b32063e97e430a25ff88df1ba3cd6))
* move chest overlay rendering ([3657580](https://github.com/kqesar/alltp-tracker/commit/365758059bfa0779519c545f73f1e5b12e3b2700))
* move grid item and grid row ([a35513b](https://github.com/kqesar/alltp-tracker/commit/a35513b9a98ba2f628339c1fe96bdd812ba1fa26))
* move medaillon overlay rendering ([e2ef948](https://github.com/kqesar/alltp-tracker/commit/e2ef948795314de569bdd5940d75e3a1a3c24f10))
* move regular item and boss item ([0457243](https://github.com/kqesar/alltp-tracker/commit/045724343fcadd3bcb786d3c28c37c1ca4ff8f6f))
* move reward overlay rendering ([11ce55d](https://github.com/kqesar/alltp-tracker/commit/11ce55d7d64a73e29882b402a939513560527a2c))
* optimize styles ([595b0d0](https://github.com/kqesar/alltp-tracker/commit/595b0d053ab84457311ee9caf53688620a0da97f))
* put hardcoded style in css files ([eabba40](https://github.com/kqesar/alltp-tracker/commit/eabba401d3bb469d27cf857d369aea754e6ed751))
* remove index.ts and avoid export file ([f11085c](https://github.com/kqesar/alltp-tracker/commit/f11085c8cf19278ce54f9b519972e6ecf9ebd922))
* remove useless css classes ([c76a980](https://github.com/kqesar/alltp-tracker/commit/c76a98009031aa9c4397bce5658d9e2cba27d154))
* replace test extension to spec ([0690624](https://github.com/kqesar/alltp-tracker/commit/06906241e6642cca9c64da9458c8a64adb88f176))


### ✨ Features

* add test coverage in PR ([d35e93c](https://github.com/kqesar/alltp-tracker/commit/d35e93cc6536e80f99b74960241d079c0000a77f))
* add zustand ([a722ef4](https://github.com/kqesar/alltp-tracker/commit/a722ef4d8a17dec8a864df3189f3db9b55b46a6b))

### [1.2.6](https://github.com/kqesar/alltp-tracker/compare/v1.2.5...v1.2.6) (2025-08-07)

### [1.2.5](https://github.com/kqesar/alltp-tracker/compare/v1.2.4...v1.2.5) (2025-08-07)

### [1.2.4](https://github.com/kqesar/alltp-tracker/compare/v1.2.3...v1.2.4) (2025-08-06)


### 🐛 Bug Fixes

* use proper asset paths with BASE_URL for GitHub Pages ([2695e2d](https://github.com/kqesar/alltp-tracker/commit/2695e2db5538e366813c66775a4e36b5b0e458cf))

### [1.2.3](https://github.com/kqesar/alltp-tracker/compare/v1.2.2...v1.2.3) (2025-08-06)


### 🐛 Bug Fixes

* resolve all linting and TypeScript errors ([484eef6](https://github.com/kqesar/alltp-tracker/commit/484eef67a2125172de904776c0cb07746a98986f))

### [1.2.2](https://github.com/kqesar/alltp-tracker/compare/v1.2.1...v1.2.2) (2025-08-06)


### 🐛 Bug Fixes

* use gh-pages branch deployment to bypass environment protection ([9f5a638](https://github.com/kqesar/alltp-tracker/commit/9f5a638f8bd9eb0f7a6fded82d7c35f51630d0b9))

### [1.2.1](https://github.com/kqesar/alltp-tracker/compare/v1.2.0...v1.2.1) (2025-08-06)


### 🐛 Bug Fixes

* simplify GitHub Pages deployment workflow ([3a7298d](https://github.com/kqesar/alltp-tracker/commit/3a7298da1e61ae3e3954c94583b28095638e62b0))

## [1.2.0](https://github.com/kqesar/alltp-tracker/compare/v1.1.1...v1.2.0) (2025-08-06)


### ✨ Features

* add automated GitHub Pages deployment workflow ([bca71c2](https://github.com/kqesar/alltp-tracker/commit/bca71c2b4be2104bacffd7fa80420a30cf92a85e))

### [1.1.1](https://github.com/kqesar/alltp-tracker/compare/v1.1.0...v1.1.1) (2025-08-06)

## 1.1.0 (2025-08-06)


### ✨ Features

* add chests ([5b61f7b](https://github.com/kqesar/alltp-tracker/commit/5b61f7b5a6793549536e47b9865b150af763a41e))
* add dependabot [#20](https://github.com/kqesar/alltp-tracker/issues/20) ([83c5fad](https://github.com/kqesar/alltp-tracker/commit/83c5fad3d37efe5cb87b86cab9bf4466116eb280))
* add react version ([6a82206](https://github.com/kqesar/alltp-tracker/commit/6a82206e673d2e25dd276172d063b9b177afaa55))
* add rewards management ([b43fc70](https://github.com/kqesar/alltp-tracker/commit/b43fc70dcd77579c11148398c55c3d2d9c8e2d9a))
* add tailwind ([17fd06d](https://github.com/kqesar/alltp-tracker/commit/17fd06dcb2d9bb14bc89d68678391de5911ffb9e))
* bump packages and remove yarn ([cbb33ea](https://github.com/kqesar/alltp-tracker/commit/cbb33ea53c30b250b80c01106fb0d9fcb83c8203))
* bump sass ([4db8f30](https://github.com/kqesar/alltp-tracker/commit/4db8f30018b50d76f60fede033624f1e33307a4d))
* evolve react version ([5f67908](https://github.com/kqesar/alltp-tracker/commit/5f67908c7e729132999ea06859f113e9f299efda))
* medaillon management ([de560dc](https://github.com/kqesar/alltp-tracker/commit/de560dca43b8b410d643d9a4c46c5c83669f915e))
* optimize app.tsx ([2172d8a](https://github.com/kqesar/alltp-tracker/commit/2172d8ae361958a8491aebf6b5581533e3d72ab2))
* remove codeQL workflow ([1e5e74e](https://github.com/kqesar/alltp-tracker/commit/1e5e74e010959fb5d1e351f4c66e555b8056e2db))
* remove settings ([d4ca121](https://github.com/kqesar/alltp-tracker/commit/d4ca121d06147f206b54b9f2b3dcc39772b8a85b))
* update License ([fda378e](https://github.com/kqesar/alltp-tracker/commit/fda378e2e85aff932200bb7153b92ef1db855936))
* update vscode config, delete useless file and update README ([0761dc2](https://github.com/kqesar/alltp-tracker/commit/0761dc2e15bc675759d1fd9dfcc3e5570023bd67))


### 🐛 Bug Fixes

* fix URL to git clone repository [#24](https://github.com/kqesar/alltp-tracker/issues/24) ([0157b68](https://github.com/kqesar/alltp-tracker/commit/0157b68cfe22ee2e09b7fd5c5b4e919454b116b2))
* **global:** fix test stup file ([92fa835](https://github.com/kqesar/alltp-tracker/commit/92fa8359123cb41c8715d8cc813700fa2ab8836d))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### ✨ Features

- **react**: Add React 19 version with TypeScript support
- **tracker**: Add item tracking with visual feedback system
- **map**: Add interactive map with chest and dungeon tracking
- **bosses**: Add boss overlays with medallion, chest count, and reward tracking
- **medallions**: Add medallion management for Misery Mire and Turtle Rock
- **rewards**: Add crystal/pendant reward tracking for each dungeon boss
- **ui**: Add dynamic caption system with hover information
- **build**: Add Vite build system with HMR
- **styling**: Add Tailwind CSS for modern styling
- **testing**: Add Vitest with React Testing Library
- **quality**: Add Biome for linting and formatting

### 🐛 Bug Fixes

- **css**: Fix CSS import paths and styling issues
- **images**: Fix image links for lumberjack tree
- **build**: Fix asset paths for production builds
- **dependencies**: Update vulnerable dependencies

### 📚 Documentation

- **readme**: Add comprehensive documentation for installation and usage
- **license**: Update MIT license with correct copyright information
- **deps**: Add dependabot configuration for automated dependency updates

### 🔧 Code Refactoring

- **legacy**: Migrate from legacy JavaScript to modern React with TypeScript
- **components**: Refactor code into modular, reusable components
- **state**: Implement proper state management with React hooks
- **variables**: Change var declarations to let/const for better scoping

### 📦 Build System

- **vite**: Replace Grunt with Vite for modern build tooling
- **typescript**: Add TypeScript configuration for type safety
- **pnpm**: Switch from yarn to pnpm for package management

### 👷 CI/CD

- **github**: Add GitHub workflows for automated testing and deployment
- **codeql**: Add CodeQL analysis for security scanning
- **dependabot**: Configure automated dependency updates

---

## Previous Legacy Commits (Pre-React)

### Legacy Features (2017-2023)
- Initial tracker implementation with vanilla JavaScript
- SCSS styling with Grunt build system
- Basic item tracking functionality
- Overworld chest tracking
- Dungeon boss tracking
- Live reload development setup

### Legacy Fixes
- CSS path corrections
- Image loading fixes
- Dependency security updates
- Build system improvements

---

*This changelog follows the [Conventional Commits](https://conventionalcommits.org/) specification.*
