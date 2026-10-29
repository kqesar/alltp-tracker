# Changelog

All notable changes to this project are documented in this file. [release-please](https://github.com/googleapis/release-please) writes it from the [Conventional Commits](https://conventionalcommits.org/) merged since the previous release.

## [2.65.1](https://github.com/kqesar/alltp-tracker/compare/v2.65.0...v2.65.1) (2026-10-29)


### 🐛 Bug Fixes

* **autotrack:** read no byte between race ranges in Race Mode ([7ef8c47](https://github.com/kqesar/alltp-tracker/commit/7ef8c475f0f573f7de5d85f397af527e23478549))
* **autotrack:** read the mode before a race tick plans ([a640a16](https://github.com/kqesar/alltp-tracker/commit/a640a16201e6de8f60383d79c4193ce7a732d819))

## [2.65.0](https://github.com/kqesar/alltp-tracker/compare/v2.64.0...v2.65.0) (2026-10-29)


### ✨ Features

* **alttpr:** know a met boss, from the player or the boss room ([8455618](https://github.com/kqesar/alltp-tracker/commit/8455618ff3d9ca1509056e23c9dae76f8f390c17))
* **web:** mark a dungeon's boss under boss shuffle ([6e19785](https://github.com/kqesar/alltp-tracker/commit/6e19785f053b451e981d18d0c56708651d98b70c))


### 🐛 Bug Fixes

* **web:** letter an unknown boss, and name the marked one in the tooltip ([cf7682d](https://github.com/kqesar/alltp-tracker/commit/cf7682dce47e9ffcab3103aff893f5e8e14fc2d9))

## [2.64.0](https://github.com/kqesar/alltp-tracker/compare/v2.63.0...v2.64.0) (2026-10-29)


### ✨ Features

* **alttpr:** pool the full entrance shuffle apart from the crossed one ([b1adadb](https://github.com/kqesar/alltp-tracker/commit/b1adadb3b5e69962a2da5b2a5e945d3fa6474ab2))


### 🐛 Bug Fixes

* **web:** name the real cause of an unmodelled run, and pool entrances per shuffle ([d9e3392](https://github.com/kqesar/alltp-tracker/commit/d9e33924f061620b0be0414ccc1f6bbea4d0d8c1))

## [2.63.0](https://github.com/kqesar/alltp-tracker/compare/v2.62.0...v2.63.0) (2026-10-29)


### ✨ Features

* **alttpr:** read a Triforce Hunt's pieces and its go mode count ([c9a06bb](https://github.com/kqesar/alltp-tracker/commit/c9a06bb8c9c81bad5a66a9ec8a77ab28e7ba256c))
* **web:** count a Triforce Hunt's pieces on the board, with its go mode ([ce2a2bf](https://github.com/kqesar/alltp-tracker/commit/ce2a2bfac5531e334dd19b1b7aa15e4ef7707fba))


### 📚 Documentation

* describe the Triforce Hunt cell, its go mode and its autotracking ([27f1fef](https://github.com/kqesar/alltp-tracker/commit/27f1fef4564fe157beda18bf1c6a5f45c7d81319))

## [2.62.0](https://github.com/kqesar/alltp-tracker/compare/v2.61.2...v2.62.0) (2026-10-28)


### ✨ Features

* **alttpr:** read every boss a slot may hold under boss shuffle ([a70787f](https://github.com/kqesar/alltp-tracker/commit/a70787fe060dfb88f3485d1b78baa438c55fbbcc))
* **web:** know a run's boss shuffle, from the run type or the seed ([433335b](https://github.com/kqesar/alltp-tracker/commit/433335bb14e51b0fbff2526b3cf4f1c1abba70f7))

## [2.61.2](https://github.com/kqesar/alltp-tracker/compare/v2.61.1...v2.61.2) (2026-10-28)


### 🐛 Bug Fixes

* **alttpr:** read a Retro spoiler's bare Key instead of refusing it as multiworld ([a620cd6](https://github.com/kqesar/alltp-tracker/commit/a620cd66856e9060c9b5283a95493fbc22d866ea))
* **alttpr:** read a spoiler playthrough's sphere 0 as the start, not a malformed one ([a8cbcb3](https://github.com/kqesar/alltp-tracker/commit/a8cbcb3d3b4fb880b5d5079880c399b7ee595431))
* **web:** hide the review's waits for Retro, where no door is solved from keys ([ae115de](https://github.com/kqesar/alltp-tracker/commit/ae115de67ca7a2d082715994c62ceb2791951535))

## [2.61.1](https://github.com/kqesar/alltp-tracker/compare/v2.61.0...v2.61.1) (2026-10-28)


### 🐛 Bug Fixes

* **web:** do not carry a finished run timer into the seed's run ([7f9100f](https://github.com/kqesar/alltp-tracker/commit/7f9100fe2ff5b85e7afc7d26a3e3cb2b0bb7c5b1))

## [2.61.0](https://github.com/kqesar/alltp-tracker/compare/v2.60.2...v2.61.0) (2026-10-28)


### ✨ Features

* **alttpr:** read the heart pieces toward the next heart, in Race Mode too ([54bce8a](https://github.com/kqesar/alltp-tracker/commit/54bce8a51684fb4af1cf66be722265c9008e90d6))
* **web:** count the heart pieces toward the next heart on the hearts counter ([a23e721](https://github.com/kqesar/alltp-tracker/commit/a23e72178446d0df0f76d2ef3c5038067bfd26c0))


### 🐛 Bug Fixes

* **web:** give every row of the shortcuts table an icon that exists ([5394774](https://github.com/kqesar/alltp-tracker/commit/53947741b84c4295bf687632dee78a5a918cdd3d))


### 📚 Documentation

* describe the heart pieces on the hearts counter ([8757922](https://github.com/kqesar/alltp-tracker/commit/8757922aa05c181718fdda94533b99ca44fbc18b))

## [2.60.2](https://github.com/kqesar/alltp-tracker/compare/v2.60.1...v2.60.2) (2026-10-28)


### 🐛 Bug Fixes

* **web:** forget the pads and bomb of an earlier run when the run changes ([44b3b84](https://github.com/kqesar/alltp-tracker/commit/44b3b84ba50a7f1bfad67f2ca712bd20d62d9030))
* **web:** lay the game on a run replaced under a connected session ([b3cf356](https://github.com/kqesar/alltp-tracker/commit/b3cf3567ef268a786619fcec384ad3082c324f2c))
* **web:** the goal ends a run whose timer never started ([a425f8f](https://github.com/kqesar/alltp-tracker/commit/a425f8f9305056ea620f3f918781a9a922f8e582))

## [2.60.1](https://github.com/kqesar/alltp-tracker/compare/v2.60.0...v2.60.1) (2026-10-28)


### 🐛 Bug Fixes

* **alttpr:** count Link's 3 starting hearts, as vt pre-collects them ([fa6889e](https://github.com/kqesar/alltp-tracker/commit/fa6889e9ff3b40c26319ed615d5a27bf37fc5456))
* **web:** word the hearts as on screen, the 3 Link starts with among them ([d421194](https://github.com/kqesar/alltp-tracker/commit/d4211943225057a87b303fc5f0c7cc19b0519cca))


### 📚 Documentation

* say Basic's dungeons wait for 7 and 12 hearts on screen ([31aab91](https://github.com/kqesar/alltp-tracker/commit/31aab91d52d4ea5461c828511ccb60bddf5bb208))

## [2.60.0](https://github.com/kqesar/alltp-tracker/compare/v2.59.0...v2.60.0) (2026-10-28)


### ✨ Features

* **web:** pack an ALttPR link's settings, so 300 finds fit a chat message ([d9f2f3f](https://github.com/kqesar/alltp-tracker/commit/d9f2f3fbfcfb9d5c7929708fc6afc4f640acc9d3))


### 📚 Documentation

* describe link 4's settings and the lengths it measures ([8040043](https://github.com/kqesar/alltp-tracker/commit/80400430aa69e54788b7f053654cab64b1b7a587))


### 🔧 Code Refactoring

* **web:** let a link layout index a table more than the ones before ([aed7041](https://github.com/kqesar/alltp-tracker/commit/aed7041a9c3a1a992b4e9145a2bd166657152291))

## [2.59.0](https://github.com/kqesar/alltp-tracker/compare/v2.58.0...v2.59.0) (2026-10-28)


### ✨ Features

* **web:** offer a reload for a link a newer tracker wrote ([8a8f9f6](https://github.com/kqesar/alltp-tracker/commit/8a8f9f688e9c3405a57b980825dbb2d9212e46d4))
* **web:** pack an ALttPR link's timeline in bits, each drift as a change ([52eba13](https://github.com/kqesar/alltp-tracker/commit/52eba130e7ae1d3365412fc81d58d6db3808e24e))


### 🐛 Bug Fixes

* **web:** write link 2 for a save without a find ([6107669](https://github.com/kqesar/alltp-tracker/commit/61076696fd36cfb15aaa900968ffbb20b9000785))


### 📚 Documentation

* describe link 3's timeline and the lengths it measures ([6d6f216](https://github.com/kqesar/alltp-tracker/commit/6d6f216dbde2e5e16a4be7c78af4cd310b797584))
* say how a newer tracker's link reads, and when link 2 is still written ([698ba6b](https://github.com/kqesar/alltp-tracker/commit/698ba6b037e1e327c1421117cf4b534063d5cc1d))


### 🔧 Code Refactoring

* **web:** let a link codec write a later layout and read the earlier ones ([6eea68f](https://github.com/kqesar/alltp-tracker/commit/6eea68fb0977a7327d1ba18b443a56866a063157))

## [2.58.0](https://github.com/kqesar/alltp-tracker/compare/v2.57.0...v2.58.0) (2026-10-28)


### ✨ Features

* **web:** offer the full link when Share leaves the timeline out ([13de4ee](https://github.com/kqesar/alltp-tracker/commit/13de4ee0ff20b60768698f78998f23ac07d2f8e6))


### 🐛 Bug Fixes

* **web:** count a beaten boss's prize as taken in the review ([46e41df](https://github.com/kqesar/alltp-tracker/commit/46e41dfaea5d39e0baebfad364ed77ea9b937c5f))
* **web:** say when a reviewed run came without its timeline ([1f834de](https://github.com/kqesar/alltp-tracker/commit/1f834dea12e944df4960a2601752af2d57f801a7))


### 📚 Documentation

* say why a late link drops its timeline, and what the review does then ([1ba9b3d](https://github.com/kqesar/alltp-tracker/commit/1ba9b3dd13175c13f78b1f65428f40e114176262))

## [2.57.0](https://github.com/kqesar/alltp-tracker/compare/v2.56.0...v2.57.0) (2026-10-28)


### ✨ Features

* **alttpr:** count the bosses' weapons and Ganon's among Basic's margins ([16e21f8](https://github.com/kqesar/alltp-tracker/commit/16e21f86b199a16b7255cc9521426307f7448e73))
* **alttpr:** count Turtle Rock's laser bridge among Basic's margins ([ffcf88a](https://github.com/kqesar/alltp-tracker/commit/ffcf88a0749a55b0b9f3853e9d087b1cbb964182))
* **web:** name the margin that holds a place back ([73afcc2](https://github.com/kqesar/alltp-tracker/commit/73afcc2b6a920a59885fe671db712786a4969c99))


### 📚 Documentation

* list Basic placement's margins and what is kept out ([7667559](https://github.com/kqesar/alltp-tracker/commit/766755932f4da2b79f61e12630781a80c0741202))
* list the laser bridge among Basic's margins ([074d0e1](https://github.com/kqesar/alltp-tracker/commit/074d0e1bd495b1762521bde6f30be345b59349b0))

## [2.56.0](https://github.com/kqesar/alltp-tracker/compare/v2.55.0...v2.56.0) (2026-10-28)


### ✨ Features

* **alttpr:** solve a run without basic placement's safety margin ([6dc5682](https://github.com/kqesar/alltp-tracker/commit/6dc568281c0d300e061db5e1bf5d6f3b51b09cbb))
* **web:** show what basic placement's margin alone holds back as doable ([491290b](https://github.com/kqesar/alltp-tracker/commit/491290b731d7ba309099d736dca2f4af67d349c0))


### 📚 Documentation

* say what Basic placement's safety margin state means ([34799c4](https://github.com/kqesar/alltp-tracker/commit/34799c4f907ee95a70c5e02c7a94d7c72965399d))

## [2.55.0](https://github.com/kqesar/alltp-tracker/compare/v2.54.1...v2.55.0) (2026-10-28)


### ✨ Features

* **alttpr:** read every logic alttpr.com offers from a seed's file ([e205ea3](https://github.com/kqesar/alltp-tracker/commit/e205ea3a0bf1a88a16261d3855aacb8297b049f1))
* **web:** keep a glitched seed's logic in its run, said not modelled ([ac1450a](https://github.com/kqesar/alltp-tracker/commit/ac1450aa5f2580bac4d96c7c070c93f91def43ac))
* **web:** name the trick under a check it opens in the Checks list ([aec4432](https://github.com/kqesar/alltp-tracker/commit/aec4432008674617194af965944734dcadfd0530))


### 📚 Documentation

* say where tricks show and what a glitched seed's run does ([7335c67](https://github.com/kqesar/alltp-tracker/commit/7335c67e89594c73cf9d5df78f86dd0bee411f95))

## [2.54.1](https://github.com/kqesar/alltp-tracker/compare/v2.54.0...v2.54.1) (2026-10-28)


### 🐛 Bug Fixes

* **alttpr:** count wild small keys from the game's own key counter ([e9f67ad](https://github.com/kqesar/alltp-tracker/commit/e9f67ad4c9b1b10a7f2d648fd3fc7bdf2d5746b4))
* **alttpr:** report the key count read, before Hera's take-back ([903fe82](https://github.com/kqesar/alltp-tracker/commit/903fe82ae94fa51de09fc018d40e6dd8c97cb641))
* **web:** read no small key count with generic keys ([59f5cf8](https://github.com/kqesar/alltp-tracker/commit/59f5cf8a92508cac9ce186d37614313099f9154e))


### 📚 Documentation

* **alttpr:** say how autotracking counts wild small keys ([6588ff8](https://github.com/kqesar/alltp-tracker/commit/6588ff89c1da1aa5726191cbfb72e8ea2962df41))
* **alttpr:** say what the key count tells, and where it is not read ([22e6f6d](https://github.com/kqesar/alltp-tracker/commit/22e6f6df86323ba0546737bc06992ec5a398f469))

## [2.54.0](https://github.com/kqesar/alltp-tracker/compare/v2.53.0...v2.54.0) (2026-10-28)


### ✨ Features

* **web:** list the items go mode still misses, crystals aside ([13b4d16](https://github.com/kqesar/alltp-tracker/commit/13b4d1688eaea9b62b195f294827a9d63f6f434a))


### 📚 Documentation

* say what the go mode lists, crystals aside ([acfdab9](https://github.com/kqesar/alltp-tracker/commit/acfdab94c6c191cce3e87e58662b4d6c21622e9f))

## [2.53.0](https://github.com/kqesar/alltp-tracker/compare/v2.52.1...v2.53.0) (2026-10-28)


### ✨ Features

* **alttpr:** read in a race what v2.0 permits, and follow what no cell drew ([dec757d](https://github.com/kqesar/alltp-tracker/commit/dec757dbfc7ebbca88d25676f3a3d0d60bc16cd8))


### 🐛 Bug Fixes

* **alttpr:** never read in a race whether the flute was activated ([da59b13](https://github.com/kqesar/alltp-tracker/commit/da59b13cf51e62c36471ef1c56baa33f276b0033))
* **web:** decode a remembered race as a race ([bc3c09f](https://github.com/kqesar/alltp-tracker/commit/bc3c09fbf27a1f6573549f1c1a732709902ce40f))
* **web:** never let Standard's escape stick, nor reach a race ([fdbb412](https://github.com/kqesar/alltp-tracker/commit/fdbb4122f807c688622f737bc6c8fa447de6c0d4))


### 📚 Documentation

* **alttpr:** say what a race reads under v2.0, and what the logic follows ([bbfbc73](https://github.com/kqesar/alltp-tracker/commit/bbfbc73857afb095a179bdc3dbd45e8465eaae4a))
* **web:** name no release in the review's word on older race runs ([7dca5fb](https://github.com/kqesar/alltp-tracker/commit/7dca5fbecf847c0b2ee29e3b6485d309f58f995f))

## [2.52.1](https://github.com/kqesar/alltp-tracker/compare/v2.52.0...v2.52.1) (2026-10-28)


### 📚 Documentation

* **alttpr:** say what autotracking gives the rules, and how keys are counted ([45f404c](https://github.com/kqesar/alltp-tracker/commit/45f404c6fe22305b2e69a5842578a1621ce299f7))

## [2.52.0](https://github.com/kqesar/alltp-tracker/compare/v2.51.0...v2.52.0) (2026-10-28)


### ✨ Features

* **web:** track Link's hearts on the tunic's cell ([e070596](https://github.com/kqesar/alltp-tracker/commit/e0705962a82a8285c227d8d1644cc1ef956e34ff))


### 🐛 Bug Fixes

* **alttpr:** read hearts and bombs a tracker does not know as maybe ([b3f6dfb](https://github.com/kqesar/alltp-tracker/commit/b3f6dfb51c4e54726337d66ee70aa09ae42aa1c0))
* **web:** date a review's hearts and bombs by the log, never the board ([4dd4f89](https://github.com/kqesar/alltp-tracker/commit/4dd4f898a404a5dad924ae2381180d1cabd770fe))
* **web:** know the escape's Ten Bombs once autotracking reads them ([b524654](https://github.com/kqesar/alltp-tracker/commit/b5246545844dd90016eeaf86877fa1c510f4070f))
* **web:** say a whole heart by voice, 4 on screen from not set ([5f82ca7](https://github.com/kqesar/alltp-tracker/commit/5f82ca7bd562bbf017614e49ddcdcd7497a8d3ef))
* **web:** stop the hearts cell at not set and at 20 ([66ce741](https://github.com/kqesar/alltp-tracker/commit/66ce741fb747f3f04265edfdaa780dfd421ca200))


### 📚 Documentation

* **alttpr:** say Race Mode reads the heart count, and quote v2.0 once ([bf1f4cf](https://github.com/kqesar/alltp-tracker/commit/bf1f4cf26da938350e0f065fe1f72b35856a3d33))
* describe the hearts cell and counts the board may not know ([1606544](https://github.com/kqesar/alltp-tracker/commit/16065444edd6e9715068fe041261f16034d23d71))


### 🔧 Code Refactoring

* **web:** share the heart items' power, and ask waysOf for what is held ([cd21345](https://github.com/kqesar/alltp-tracker/commit/cd213454946c0083940753cfdd35167179fe4d0b))

## [2.51.0](https://github.com/kqesar/alltp-tracker/compare/v2.50.1...v2.51.0) (2026-10-28)


### ✨ Features

* **alttpr:** list the checks that cost rupees ([42635d6](https://github.com/kqesar/alltp-tracker/commit/42635d68fbb26298bd3dd65206f094d8a3faf03d))
* **web:** show a paid check's price after its name ([5e879ba](https://github.com/kqesar/alltp-tracker/commit/5e879bae25d0cefd690bd6f96f9520d2e3331b4e))


### 📚 Documentation

* describe the checks that cost rupees ([dc23bf4](https://github.com/kqesar/alltp-tracker/commit/dc23bf4cb4453305774d0d1d5961376d2c3a52a6))

## [2.50.1](https://github.com/kqesar/alltp-tracker/compare/v2.50.0...v2.50.1) (2026-10-28)


### 🐛 Bug Fixes

* **web:** leave a dungeon's unopened checks unticked when its counter is 0 ([5bdb2b5](https://github.com/kqesar/alltp-tracker/commit/5bdb2b545a5e2c8e0b8126626b22290cd4ada0a4))


### 📚 Documentation

* say when a dungeon's counter ticks its checks ([11cf1f5](https://github.com/kqesar/alltp-tracker/commit/11cf1f5d9089e350e2dbf7afc1d07a3aeee00100))

## [2.50.0](https://github.com/kqesar/alltp-tracker/compare/v2.49.0...v2.50.0) (2026-10-28)


### ✨ Features

* **web:** turn Export and Share off in Race Mode ([485a039](https://github.com/kqesar/alltp-tracker/commit/485a03962c9ec6ce8a314ee9db61c9df95664fc3))


### 🐛 Bug Fixes

* **web:** keep the remembered race through Undo and for a flag in doubt ([4a80ff7](https://github.com/kqesar/alltp-tracker/commit/4a80ff7b8f1ddc533250116010aaf93678fd9dad))
* **web:** make Export and Share follow Race Mode in every state ([b28c6c2](https://github.com/kqesar/alltp-tracker/commit/b28c6c21764b850c6c3e42f6df391afdf2d820d4))
* **web:** remember a race read from the seed through a Disconnect ([22c9e37](https://github.com/kqesar/alltp-tracker/commit/22c9e3751d160750035fb909b8eaa117f78ee31d))
* **web:** show Race Mode held by memory, and keep the focus on Copy ([11c9617](https://github.com/kqesar/alltp-tracker/commit/11c9617f0113abfbaf166fb1abdbf7681037dee5))


### 📚 Documentation

* describe the remembered race ([1c7d065](https://github.com/kqesar/alltp-tracker/commit/1c7d065e2d8218327333ec61a99ef8ea7b8c76b8))
* describe the Share dialog and the More menu in Race Mode ([af03b19](https://github.com/kqesar/alltp-tracker/commit/af03b19072ece556337ffbf474aa40d419017e2c))
* describe Undo, a flag in doubt and the memory badge ([f82dfcf](https://github.com/kqesar/alltp-tracker/commit/f82dfcfd1965a090cce794cd8357d5e7bb589d02))
* say in the area rules how Race Mode turns Export and Share off ([e8cf1cb](https://github.com/kqesar/alltp-tracker/commit/e8cf1cbf46a44b5e28151e664dae71fd2f6772d0))

## [2.49.0](https://github.com/kqesar/alltp-tracker/compare/v2.48.3...v2.49.0) (2026-10-27)


### ✨ Features

* **web:** show how long each needed item waited in an ALttPR run review ([799899f](https://github.com/kqesar/alltp-tracker/commit/799899f02d51404313399ac14cd90d2afb48bbc9))


### 🐛 Bug Fixes

* **web:** count no break from a find made before the run timer started ([4a948d9](https://github.com/kqesar/alltp-tracker/commit/4a948d9cf57a55068162b99b4e89273b1dc865a4))
* **web:** describe a waiting item's dungeon as it stood when the item was in logic ([7a7cf1c](https://github.com/kqesar/alltp-tracker/commit/7a7cf1ce3ca802c36c2c8dad2a3bd991a64e302a))
* **web:** hide a review's waits for shuffled bosses and glitched logic ([a6142ab](https://github.com/kqesar/alltp-tracker/commit/a6142ab3c5169e5faf627cd8189a858a9c543500))
* **web:** let a keyboard reach the SMZ3 review's playthrough table ([d586646](https://github.com/kqesar/alltp-tracker/commit/d58664691a0203180a0009c56f28791f30f85a07))
* **web:** let a review's column shrink below its widest content ([6c17c54](https://github.com/kqesar/alltp-tracker/commit/6c17c54ea84c0e9157dd00e4c87bad40b530e199))
* **web:** list items taken but never in logic, outside the chain ([1714594](https://github.com/kqesar/alltp-tracker/commit/1714594dbcb1d64d662f11184d7464e5a8915309))
* **web:** name the review's dungeons table apart from its section ([40171e1](https://github.com/kqesar/alltp-tracker/commit/40171e13a52102d1485019c77053509784e8d733))
* **web:** never say nothing waited above dungeon items that did ([749e7a3](https://github.com/kqesar/alltp-tracker/commit/749e7a3c1b83a52f9ed5014eee050de6d635c4b9))
* **web:** read a review's prizes and medallions from the log ([201d78f](https://github.com/kqesar/alltp-tracker/commit/201d78fbc71ebe3b64052454017ce3304d819968))
* **web:** say Race Mode, not a hand run, when a review's dungeon chests went unread ([dff310e](https://github.com/kqesar/alltp-tracker/commit/dff310ebdf084fc579c8bcbd5819ca4526a8a617))
* **web:** time a review's places with the keys where the log put them ([fd5ebe7](https://github.com/kqesar/alltp-tracker/commit/fd5ebe74cc927873a17282ae9425219d20f4517a))
* **web:** word the review's import prompt without late or in order ([e80f954](https://github.com/kqesar/alltp-tracker/commit/e80f954f0af8c96131071f9c9d573e04047d1f26))


### 📚 Documentation

* describe the review's fixes: Race Mode, items never in logic, the dungeon sentence ([8369e06](https://github.com/kqesar/alltp-tracker/commit/8369e06252788f35f639ab00f35f23832b43f76e))
* describe the waits of an ALttPR run review ([80cdedf](https://github.com/kqesar/alltp-tracker/commit/80cdedf1cfdfacf86c8aabfe6095f68b033933f6))
* say in the area rules what the review's waits show ([ea8d55d](https://github.com/kqesar/alltp-tracker/commit/ea8d55db2fc72b006a132f19171da7334b8ccfff))

## [2.48.3](https://github.com/kqesar/alltp-tracker/compare/v2.48.2...v2.48.3) (2026-10-27)


### 🐛 Bug Fixes

* **alttpr:** keep the seed type out of Race Mode ([668d682](https://github.com/kqesar/alltp-tracker/commit/668d682e8db413aadb99ff5e24247842e2c6b127))
* **sm:** read only items and boss kills in Race Mode ([cbd5d5a](https://github.com/kqesar/alltp-tracker/commit/cbd5d5a5eedbd28b5ff7c82b41e2a6a2c01f3400))
* **sm:** read only the equipment words the items count needs ([3a122a0](https://github.com/kqesar/alltp-tracker/commit/3a122a03cfd864531ad58d0e95f9b72d59810f61))
* **sm:** tell only boss kills among the objectives in Race Mode ([0327edf](https://github.com/kqesar/alltp-tracker/commit/0327edf514f852e3ed4a6d69ffa591834b5aa8c9))
* **smz3:** tell no crystal's kind in Race Mode ([ba97b17](https://github.com/kqesar/alltp-tracker/commit/ba97b17f915895201700d08b8342442f83c737eb))
* **web:** call Map Rando's race badge Race Mode, not race-legal ([4656134](https://github.com/kqesar/alltp-tracker/commit/4656134f7ff9288be831cf4ba2d85ee17b70d51f))
* **web:** decode nothing a race forbids in a Super Metroid race reading ([533884c](https://github.com/kqesar/alltp-tracker/commit/533884c54493bd19c836f8b3c3ea6faa50c5c52c))
* **web:** fail closed while autotracking has not read the race flag ([5a6605f](https://github.com/kqesar/alltp-tracker/commit/5a6605f617619e419cf5d89de43e024f730d5742))
* **web:** give the Run tab's columns its free height, not the review line ([bb1e9c7](https://github.com/kqesar/alltp-tracker/commit/bb1e9c72427afc6f139859382ed2ab1b25255124))
* **web:** hold Super Metroid's Race Mode to boss kills and no seed name ([52798a8](https://github.com/kqesar/alltp-tracker/commit/52798a83ed5a6f1991594c24f2a89afc37547015))
* **web:** keep SMZ3's crystals and seed name out of Race Mode ([eef3514](https://github.com/kqesar/alltp-tracker/commit/eef35144b0054a004b4cc7058e539cbe9bea7944))
* **web:** leave Super Metroid's run timer to the player in Race Mode ([13300b6](https://github.com/kqesar/alltp-tracker/commit/13300b64ba40c305bffc6fe4750e4d22c44ec930))
* **web:** leave the places checked out of the timeline in Race Mode ([d4fcde8](https://github.com/kqesar/alltp-tracker/commit/d4fcde81a71c3a1092270bffd0048f8b3fd0cf5b))
* **web:** relay only the grid and timer of a run in Race Mode ([c84ce12](https://github.com/kqesar/alltp-tracker/commit/c84ce129a7d3a5d8d75d46e0d01dfce8f90b4aef))
* **web:** save Super Metroid's Off as off, with no save version bump ([cabc17c](https://github.com/kqesar/alltp-tracker/commit/cabc17c7e0b3870d37dcb27be6b1f5e20910aec3))
* **web:** say only what is true of Race Mode in its texts and docs ([aec3a8c](https://github.com/kqesar/alltp-tracker/commit/aec3a8c8a2d766c4a2bcac6224e3cff1c5774909))
* **web:** send the overlay API no time in Race Mode ([9cda0ee](https://github.com/kqesar/alltp-tracker/commit/9cda0ee7bea7994ad59b02f3f409c2ba9809a2b3))
* **web:** show no seed name in the readout in Race Mode ([dce1ea3](https://github.com/kqesar/alltp-tracker/commit/dce1ea36d59923d8883a1b50d862386d4ed54bc5))
* **web:** turn Super Metroid's Race Mode on by default ([72db910](https://github.com/kqesar/alltp-tracker/commit/72db91013da47ee8432aaccf71aca160e77e60d0))


### 📚 Documentation

* say in the area rules how each game's Race Mode decides ([fefd9ad](https://github.com/kqesar/alltp-tracker/commit/fefd9ad4337de3a53d7109e91520f95548326dc4))
* say in the area rules how Race Mode fails closed ([8c35229](https://github.com/kqesar/alltp-tracker/commit/8c35229fd60c998fcc90e31c77930d9d30735b53))
* say in the area rules what Race Mode keeps back ([6d54ebf](https://github.com/kqesar/alltp-tracker/commit/6d54ebf5e8b6ec44e311c6775446c5f5f27a1433))
* say what Race Mode keeps back in each game ([5616c4c](https://github.com/kqesar/alltp-tracker/commit/5616c4cad0a3826bb5b6ed216e4c7e00b6078f97))
* say what Race Mode now does for Super Metroid, overlays and live follow ([88e9a84](https://github.com/kqesar/alltp-tracker/commit/88e9a844366becf33cb04069d5e33b64e9982195))

## [2.48.2](https://github.com/kqesar/alltp-tracker/compare/v2.48.1...v2.48.2) (2026-10-27)


### 🐛 Bug Fixes

* **alttpr:** keep Link's position out of Race Mode's memory window ([bb8ef80](https://github.com/kqesar/alltp-tracker/commit/bb8ef806a936ab8d2b5eae2a7b44a5f5db30c96a))


### 📚 Documentation

* say Race Mode never reads where Link is ([e7a619b](https://github.com/kqesar/alltp-tracker/commit/e7a619b18e6bf6f45e81c924d1ac4daf4c421db6))

## [2.48.1](https://github.com/kqesar/alltp-tracker/compare/v2.48.0...v2.48.1) (2026-10-27)


### 🐛 Bug Fixes

* **web:** give a run ended on real time the game's final time ([9a7d6b6](https://github.com/kqesar/alltp-tracker/commit/9a7d6b6964bc953d09e90f494b070e713cb01764))

## [2.48.0](https://github.com/kqesar/alltp-tracker/compare/v2.47.0...v2.48.0) (2026-10-27)


### ✨ Features

* **alttpr:** rebuild a dark room in the game's own graphics ([e38f9b5](https://github.com/kqesar/alltp-tracker/commit/e38f9b5e47df3ac1fccdc9e8224f9c9ddb3440b1))
* **autotrack:** read bytes at addresses the game tells, on demand ([9ea650b](https://github.com/kqesar/alltp-tracker/commit/9ea650b1593477a75ac93a240fff4f1f3191c444))
* **web:** draw a dark room in the game's own graphics ([5e585f3](https://github.com/kqesar/alltp-tracker/commit/5e585f3741e3f66b461002167e51d2ea4fc77ff5))


### 🐛 Bug Fixes

* **alttpr:** draw the sword or shield Link has now, and forget a ROM's ([e1f5c00](https://github.com/kqesar/alltp-tracker/commit/e1f5c00e39b77b30bef304713f22f78be2a1a2c3))
* **alttpr:** hold Link's sprite to the footprint read with it ([bd99134](https://github.com/kqesar/alltp-tracker/commit/bd99134818add21c6fefa8b585309cf232bd602d))
* **alttpr:** never read again a sheet that did not unpack ([d0284c1](https://github.com/kqesar/alltp-tracker/commit/d0284c1dc2c86736388ed9ea401efa00f4b0f475))
* **alttpr:** retry a failed read of the room's graphics while it moves ([7bb9231](https://github.com/kqesar/alltp-tracker/commit/7bb9231116d042cec359fab6931d554372aec7ba))
* **autotrack:** open a switch's gates anew when it comes back on ([e4e43ef](https://github.com/kqesar/alltp-tracker/commit/e4e43ef6ff4eb619610fea234e5898f2b0151286))
* **autotrack:** read only the open gated ranges of a group ([f746c62](https://github.com/kqesar/alltp-tracker/commit/f746c628ed588c98b44ef3cc3e86e75605dfeef1))
* **autotrack:** skip a gated range only when the device refuses it ([23f2c22](https://github.com/kqesar/alltp-tracker/commit/23f2c22c8b9fe5a3d212a7ddcd0af42fe099bcdd))
* **web:** draw Link's marker when his sprite is off his footprint ([cef5492](https://github.com/kqesar/alltp-tracker/commit/cef54923289452700f78be931baa920820bbfaaf))
* **web:** keep the dark room's picture at a whole factor, marks on it ([5218d95](https://github.com/kqesar/alltp-tracker/commit/5218d95b48c74bd7a87593693931538731208cc3))
* **web:** keep the dark room's picture inside its panel on a phone ([95683d3](https://github.com/kqesar/alltp-tracker/commit/95683d34df61b7a738e67de9c45ee9f876cf91cb))
* **web:** scale the dark room's picture again on a height-only resize ([fe2d137](https://github.com/kqesar/alltp-tracker/commit/fe2d13786f75fdca8aaadadbc66e1a936513482e))


### ⚡ Performance Improvements

* **alttpr:** keep the dark room's picture in its one request a tick ([d361799](https://github.com/kqesar/alltp-tracker/commit/d361799938cc1f65e239da2079232cc6ce7f3467))
* **autotrack:** drop an on-demand read the host no longer wants ([57d3885](https://github.com/kqesar/alltp-tracker/commit/57d3885200237889bef3969db5aa3d70b7e3b63a))
* **web:** make the dark room's image once, not at every step of Link's ([4feb2e4](https://github.com/kqesar/alltp-tracker/commit/4feb2e4d62dc98b27443dd836fb4ba8fbbc0ae8b))


### 📚 Documentation

* describe the dark room in the game's own graphics ([7808ffe](https://github.com/kqesar/alltp-tracker/commit/7808ffefc4f02e73b1d905e89ffb942315ee2520))
* say what a failed read of the dark room's graphics does ([ceb6f77](https://github.com/kqesar/alltp-tracker/commit/ceb6f773b366b75f344fc880d590c652eae88440))


### 🔧 Code Refactoring

* **alttpr:** export the picture's ROM layout from the pack's entry ([318fc14](https://github.com/kqesar/alltp-tracker/commit/318fc1456214c63386da4931f6cd25c01a874517))

## [2.47.0](https://github.com/kqesar/alltp-tracker/compare/v2.46.0...v2.47.0) (2026-10-26)


### ✨ Features

* **alttpr:** read and decode a dark room's map ([6e403a4](https://github.com/kqesar/alltp-tracker/commit/6e403a4e49cdab68bdf2249f6a22f8f1fea812a3))
* **autotrack:** opt-in and gated ranges, read alone or together ([f07334a](https://github.com/kqesar/alltp-tracker/commit/f07334a0a681cb7df3da40fd0bff068a862109d1))
* **web:** show a dark room's plan and Link's place in it ([67d4755](https://github.com/kqesar/alltp-tracker/commit/67d47559f47e7ebd8a4e149fb6e9f1d72fbf1da7))


### 📚 Documentation

* **alttpr:** describe the dark room map, its reads and its limits ([c830e7a](https://github.com/kqesar/alltp-tracker/commit/c830e7a2c50b003c544d845eb62486bd6fa4632b))
* say alttpr.com shows Save Spoiler once the base ROM is loaded ([9c1ecb3](https://github.com/kqesar/alltp-tracker/commit/9c1ecb36df44dd89a99e23cfa56b072f288af221))

## [2.46.0](https://github.com/kqesar/alltp-tracker/compare/v2.45.0...v2.46.0) (2026-10-26)


### ✨ Features

* **sm:** read which locations the player collected ([7334dd3](https://github.com/kqesar/alltp-tracker/commit/7334dd3d407af83f8e68ea0a07ba8cef15c4ed28))
* **web:** review a Super Metroid run place by place ([772eab1](https://github.com/kqesar/alltp-tracker/commit/772eab1639fe9a57cc97abbff2fa5601e1141f7c))


### 🐛 Bug Fixes

* **autotrack:** forget forbidden ranges when Race Mode comes on ([fc49d36](https://github.com/kqesar/alltp-tracker/commit/fc49d36636b91de9ccc47c64d91f79ea445fceb2))
* **web:** word the review banner for each game's board ([99168b0](https://github.com/kqesar/alltp-tracker/commit/99168b03a5ed10cd9d3c636db6df26a8772703b3))


### 📚 Documentation

* **sm:** describe the place-by-place review ([5d665aa](https://github.com/kqesar/alltp-tracker/commit/5d665aa299ee173911ea018d60e5c919e055a984))

## [2.45.0](https://github.com/kqesar/alltp-tracker/compare/v2.44.0...v2.45.0) (2026-10-26)


### ✨ Features

* **alttpr:** read alttpr.com spoiler logs ([135a664](https://github.com/kqesar/alltp-tracker/commit/135a66403f2ad4bb72ba4603ff5f2b54a60fceb2))
* **sm:** read Map Rando spoiler logs ([dcabec2](https://github.com/kqesar/alltp-tracker/commit/dcabec2889ea8f0dc3d6cf6761d5f292f7719c85))
* **sm:** tell another randomizer's spoiler log apart ([5a66672](https://github.com/kqesar/alltp-tracker/commit/5a6667289d50d06a44a17e298551856ce0b7a59b))
* **smz3:** read samus.link spoiler logs ([09fcafb](https://github.com/kqesar/alltp-tracker/commit/09fcafbd08f01a4f6390e7b7ab5ad8bc29ab48be))
* **smz3:** read the seed's guid outside races ([9491def](https://github.com/kqesar/alltp-tracker/commit/9491deffe58956851821db9a5821fbbfc8f35720))
* **spoiler:** add the spoiler log review package ([b7de208](https://github.com/kqesar/alltp-tracker/commit/b7de208eb4922447c5a9cd58997e5d4f000dfea5))
* **web:** remember each run's seed ([8a2a875](https://github.com/kqesar/alltp-tracker/commit/8a2a8754f248ff2d03e407da477afa23166776d8))
* **web:** review a finished ALttPR run with its spoiler log ([53ac625](https://github.com/kqesar/alltp-tracker/commit/53ac6250e5a6e1ab20d96317ad318a6b82a64836))
* **web:** review a finished Map Rando run with its spoiler log ([eec41b2](https://github.com/kqesar/alltp-tracker/commit/eec41b2accb944ed7c8d2807e256ecac421a222f))
* **web:** review a finished SMZ3 run with its spoiler log ([a17cc6e](https://github.com/kqesar/alltp-tracker/commit/a17cc6e8a04c7be319819ea8793eef1a7e960bf1))
* **web:** show what each ALttPR location held in a review ([f8be2bc](https://github.com/kqesar/alltp-tracker/commit/f8be2bc502adb9a2021570c0be942257ec3c8cb5))


### 🐛 Bug Fixes

* **alttpr:** import the spoiler name tables as JSON modules ([19316b4](https://github.com/kqesar/alltp-tracker/commit/19316b49d49ae2f546045413bb133833c51d03eb))
* **smz3:** say a ROM is a ROM when reading a spoiler log ([b36aa1c](https://github.com/kqesar/alltp-tracker/commit/b36aa1cae9c7420254be7da2fcd2fedd2682dd85))
* **web:** draw a dungeon map's find with the map's own image ([dca667f](https://github.com/kqesar/alltp-tracker/commit/dca667f862a3e962cb2ea01b9c6cc26bd4c6e7e6))


### ⚡ Performance Improvements

* **web:** keep ALttPR's spoiler parser out of the board's chunk ([4fff050](https://github.com/kqesar/alltp-tracker/commit/4fff050073e1e3e580efb3d4b99c28f304f94d1d))


### 📚 Documentation

* resolve the conflict left in the guide's Checks paragraph ([638c584](https://github.com/kqesar/alltp-tracker/commit/638c5848286c89b213931d3fe929161f8946abec))

## [2.44.0](https://github.com/kqesar/alltp-tracker/compare/v2.43.0...v2.44.0) (2026-10-25)


### ✨ Features

* **alttpr:** add a tricks world with six minor tricks as items ([40dd161](https://github.com/kqesar/alltp-tracker/commit/40dd16155d1815343d1195c7a5e22ba7da266cd5))
* **alttpr:** one map marker for Hookshot Cave and Sahasrahla's Hut ([1a44781](https://github.com/kqesar/alltp-tracker/commit/1a447819ca10ce30d5ba1dc27301528979b2ebfc))
* **autotrack:** confirm the mode after reading mode-bound ranges ([6f25697](https://github.com/kqesar/alltp-tracker/commit/6f256971141cd4b89fca24fc3f80961bdc15f9fa))
* **autotrack:** tell a poll that found memory unchanged ([26bfe5b](https://github.com/kqesar/alltp-tracker/commit/26bfe5b45def34cbb04976234a244cf4effc039f))
* **sm:** read Map Rando's RTA clock, the start and the goal outside Race Mode ([1b743a7](https://github.com/kqesar/alltp-tracker/commit/1b743a71fe48641affff51afa4096fe07324d757))
* **smz3:** read the games' frame counters, the start and the credits outside Race Mode ([21a88fd](https://github.com/kqesar/alltp-tracker/commit/21a88fdcab185941070f8bb5655f9f9d6baad047))
* **web:** add a run timer to the SMZ3 board ([39b1d8f](https://github.com/kqesar/alltp-tracker/commit/39b1d8fca60659b10612d2e2641f22e607bec6dc))
* **web:** add a run timer to the Super Metroid board ([6fd8e3d](https://github.com/kqesar/alltp-tracker/commit/6fd8e3d558d62f19d788a60f407c04bd1847f35e))
* **web:** group what a dungeon's chests are missing ([942d537](https://github.com/kqesar/alltp-tracker/commit/942d5372a33b6b5ebe7de5d9fba7e74f6fe466b2))
* **web:** mark checks a trick opens ([f116e6a](https://github.com/kqesar/alltp-tracker/commit/f116e6a3f9e1ec627b2455db9990cb3fa3496426))
* **web:** move the key cells switch from the toolbar to the Mode dialog ([6b8350e](https://github.com/kqesar/alltp-tracker/commit/6b8350e60c7680f54feed613315d922999a1e686))
* **web:** offer game time on the run timer for A Link to the Past ([3f14975](https://github.com/kqesar/alltp-tracker/commit/3f1497580094348a60841dae676a4b9e02965403))
* **web:** say which trick opens a check ([fe3c5e2](https://github.com/kqesar/alltp-tracker/commit/fe3c5e2a4a08a864ee63b7ad10ebf710f742dcf3))


### 🐛 Bug Fixes

* **web:** keep a cleared dungeon's boss row open until the boss is beaten ([80003fc](https://github.com/kqesar/alltp-tracker/commit/80003fc9fe7279b7d4666219c991877213d5d9bd))
* **web:** keep a tooltip that opens under the pointer ([d059a1d](https://github.com/kqesar/alltp-tracker/commit/d059a1df0a36370fce8df3135b3ac19efa0de44a))
* **web:** stop a game-time timer while the emulator is paused ([5a93b75](https://github.com/kqesar/alltp-tracker/commit/5a93b75f899f12e617ac97b6119456d22e650c83))
* **web:** stop the game-time timer while the game's counter stands still ([c88108f](https://github.com/kqesar/alltp-tracker/commit/c88108f7c946dfd7fafedfcc54df84ce30286882))


### 📚 Documentation

* **sm:** say which emulators the smr rules ban ([5f4445a](https://github.com/kqesar/alltp-tracker/commit/5f4445a6b8579fa252948aef0ff025cbb07c8b19))
* **web:** drop the dark room from what makes a check maybe ([8eef748](https://github.com/kqesar/alltp-tracker/commit/8eef74886e057165ced7e002396448c435079ea3))


### 🔧 Code Refactoring

* **web:** share the out-of-tab link ([399c56c](https://github.com/kqesar/alltp-tracker/commit/399c56c87d6ccee2e428b00949210fbaf05c3e5f))
* **web:** share the run timer's store slice, steps and component ([65592e9](https://github.com/kqesar/alltp-tracker/commit/65592e9ad6effdb27b66d7e5288bf7fa03180aa6))

## [2.43.0](https://github.com/kqesar/alltp-tracker/compare/v2.42.0...v2.43.0) (2026-10-25)


### ✨ Features

* **alttpr:** read the pad medallions the game shows from the ROM ([6e5755b](https://github.com/kqesar/alltp-tracker/commit/6e5755be00d324c7c58a04bfbd575652c74bd0e7))
* **web:** fill a pad's medallion once the game shows it ([79577d1](https://github.com/kqesar/alltp-tracker/commit/79577d13c7190265c9cab2137b1417ffdaffac04))
* **web:** mark Ganon's Tower's boss cell GT ([e1029ca](https://github.com/kqesar/alltp-tracker/commit/e1029ca922aed1e0917436772aa0425bff728f61))


### 📚 Documentation

* draw the repository's social preview with the cards ([b543839](https://github.com/kqesar/alltp-tracker/commit/b54383910444149719218942cc4d5ff35ca5c4e0))
* merge CLAUDE.md's two Archipelago package entries ([#346](https://github.com/kqesar/alltp-tracker/issues/346)) ([87da85c](https://github.com/kqesar/alltp-tracker/commit/87da85c0682c0805870f6da51b0e973a730c0e89))
* **web:** redraw the link preview cards ([2b18166](https://github.com/kqesar/alltp-tracker/commit/2b18166e0cb75c677cf7ba2252ff3f76d028ce97))

## [2.42.0](https://github.com/kqesar/alltp-tracker/compare/v2.41.0...v2.42.0) (2026-10-24)


### ✨ Features

* **alttpr:** show a dungeon's prize when the game shows it ([#342](https://github.com/kqesar/alltp-tracker/issues/342)) ([93dfeee](https://github.com/kqesar/alltp-tracker/commit/93dfeeebb4e03a8cabb0d119cc7d295b93e6c7a9))
* Archipelago self-hosted rooms from the site, and join links (S4) ([#341](https://github.com/kqesar/alltp-tracker/issues/341)) ([195dea0](https://github.com/kqesar/alltp-tracker/commit/195dea07d08bf6020f6fa787674351345c9255cc))

## [2.41.0](https://github.com/kqesar/alltp-tracker/compare/v2.40.0...v2.41.0) (2026-10-24)


### ✨ Features

* **web:** Super Metroid and SMZ3 skins for the Archipelago board (S3) ([#339](https://github.com/kqesar/alltp-tracker/issues/339)) ([ed91068](https://github.com/kqesar/alltp-tracker/commit/ed9106835aadbdfa2a34027a938e065b852ea1e5))

## [2.40.0](https://github.com/kqesar/alltp-tracker/compare/v2.39.0...v2.40.0) (2026-10-24)


### ✨ Features

* **web:** Archipelago feed, hints and players (S2) ([#336](https://github.com/kqesar/alltp-tracker/issues/336)) ([abec5c8](https://github.com/kqesar/alltp-tracker/commit/abec5c8480ff20ac7c9cf15ad984df798b4b9a96))

## [2.39.0](https://github.com/kqesar/alltp-tracker/compare/v2.38.2...v2.39.0) (2026-10-24)


### ✨ Features

* **archipelago:** add the read-only Archipelago tracker package ([#332](https://github.com/kqesar/alltp-tracker/issues/332)) ([ae61e75](https://github.com/kqesar/alltp-tracker/commit/ae61e752287fed0b25e96d757dce5b64d406703c))
* **web:** add the Archipelago board ([#334](https://github.com/kqesar/alltp-tracker/issues/334)) ([9697669](https://github.com/kqesar/alltp-tracker/commit/9697669b04ca38f9f9a93d4de10f05252c9115dd))

## [2.38.2](https://github.com/kqesar/alltp-tracker/compare/v2.38.1...v2.38.2) (2026-10-24)


### 🐛 Bug Fixes

* **web:** bring Race Mode in line with the ALTTPR Auto-tracker Rules v2.0 ([#330](https://github.com/kqesar/alltp-tracker/issues/330)) ([a36cfcd](https://github.com/kqesar/alltp-tracker/commit/a36cfcda253d733535c7ad3251715b8e0b800224))

## [2.38.1](https://github.com/kqesar/alltp-tracker/compare/v2.38.0...v2.38.1) (2026-10-24)


### 🐛 Bug Fixes

* **desktop:** serve the web manifest instead of a 404 ([#328](https://github.com/kqesar/alltp-tracker/issues/328)) ([6d2f781](https://github.com/kqesar/alltp-tracker/commit/6d2f7818b6c6c94e8f0f6807a7e433d6f95585ff))


### 📚 Documentation

* record the overlay API and stream view run in a real OBS ([#327](https://github.com/kqesar/alltp-tracker/issues/327)) ([c6a6516](https://github.com/kqesar/alltp-tracker/commit/c6a6516a57a2b0892e01198f2491e8b18fa49ae0))

## [2.38.0](https://github.com/kqesar/alltp-tracker/compare/v2.37.0...v2.38.0) (2026-10-23)


### ✨ Features

* **desktop:** bind the stream to loopback unless the network is allowed ([ac3e7ec](https://github.com/kqesar/alltp-tracker/commit/ac3e7eced97d9e7a77bc70ac48aaa44240ca1d62))
* **desktop:** hand the page the overlay API's token ([5f7c665](https://github.com/kqesar/alltp-tracker/commit/5f7c6659e366f53a3c977b670c0b31adc2d52452))
* **desktop:** serve the overlay API on the stream server ([4d02f92](https://github.com/kqesar/alltp-tracker/commit/4d02f92e1ac1e4d8f5d0e2481bc0ea86c1d5153b))
* **desktop:** serve the stream view to OBS from the app ([507e876](https://github.com/kqesar/alltp-tracker/commit/507e87669aed19bdecb9aeb0467e366dc97f2014))
* **web:** add the stream view the desktop app serves to OBS ([e012523](https://github.com/kqesar/alltp-tracker/commit/e012523218be70167f6582f6a7467bb3a06cc878))
* **web:** bring the Stream view button back in the desktop app with its tools ([33df57b](https://github.com/kqesar/alltp-tracker/commit/33df57bd2eb641ba2431229b3c3434bc97289362))
* **web:** let the player allow the network, and never show a dead stream as on ([66a3f36](https://github.com/kqesar/alltp-tracker/commit/66a3f361059a51df8b98fb5a710451aabaecb6f4))
* **web:** publish the overlay state while the stream runs ([af85127](https://github.com/kqesar/alltp-tracker/commit/af85127de7178d7d28f4709e81f0d63b6689f090))
* **web:** read a race-safe whitelist of the run for the overlay API ([18dd69e](https://github.com/kqesar/alltp-tracker/commit/18dd69e1e121fcbfe3ff8bff112d24d734d9beb9))


### 🐛 Bug Fixes

* **desktop:** chmod a private file only when it is looser, and never fail on it ([f1914eb](https://github.com/kqesar/alltp-tracker/commit/f1914ebf1155457cfc34e3d3f055b01cb11af1b6))
* **desktop:** correct the permissions of a secret file that already exists ([0069f9e](https://github.com/kqesar/alltp-tracker/commit/0069f9ed44886ad958dfca092b51de585efd5346))
* **desktop:** forget the overlay state when the stream stops ([8a79f28](https://github.com/kqesar/alltp-tracker/commit/8a79f286722364ec944f7f61bd983d500908acfd))
* **desktop:** refuse a shared port on Windows, keep the first .bad, refresh the network address ([caf386f](https://github.com/kqesar/alltp-tracker/commit/caf386f76886ed78a81b4d9f6af488c085216486))
* **desktop:** wait for the port on a restart, and read the stream token from a subprotocol ([7c8df5f](https://github.com/kqesar/alltp-tracker/commit/7c8df5f73c9cf1c7ce422c751fee20eca3ab262d))
* **web:** do not send SMZ3's boss tokens as objectives ([d8e9a39](https://github.com/kqesar/alltp-tracker/commit/d8e9a392ea601371ec2d3f8c7f8e50e31f84dd44))
* **web:** hold commands until a failed one is resynced, and release the run when off ([086f568](https://github.com/kqesar/alltp-tracker/commit/086f568cda915a2cbd9ddc8788688534900b3b17))
* **web:** keep the stream token out of the WebSocket address ([3fa666a](https://github.com/kqesar/alltp-tracker/commit/3fa666ac7853accd3e2b8500647fff7e00c680b5))
* **web:** make the relayed stream source transparent from its first frame ([af884cc](https://github.com/kqesar/alltp-tracker/commit/af884cc41e2b6a1af1530a03759e42b8a4c7de82))
* **web:** put the visible text in the accessible name of four controls ([b3f99d0](https://github.com/kqesar/alltp-tracker/commit/b3f99d07156879828053b6a19f2e322bd17127e8))
* **web:** say a moved stream port once per launch ([76f420e](https://github.com/kqesar/alltp-tracker/commit/76f420eacfdb200e1838ce385504c69410790bf0))


### 📚 Documentation

* correct the Windows restart note, the macOS bind claim and the token's exposure ([e9c0140](https://github.com/kqesar/alltp-tracker/commit/e9c01407536a948fae2afd82fbbe31c1b2a0fcf4))
* correct what a stream source survives and document the loopback default ([68fc0f7](https://github.com/kqesar/alltp-tracker/commit/68fc0f79001320270e9ab2d8fbb1dc414beb23a3))
* describe the exclusive bind, the kept .bad file and the resync ([461f4fe](https://github.com/kqesar/alltp-tracker/commit/461f4fe272ac7114d2bbd8cf27499faba9a9ca65))
* document the overlay API and its place in the stream tools ([c2d2b88](https://github.com/kqesar/alltp-tracker/commit/c2d2b88f694ea0d75bd368343e81cdd22309d3e8))
* document the stream view served to OBS by the desktop app ([f0f7876](https://github.com/kqesar/alltp-tracker/commit/f0f787683a8c588ad895601db4b86695b31789e8))
* record the bench rerun on the loopback-by-default stream ([c43be06](https://github.com/kqesar/alltp-tracker/commit/c43be061394f90585477f424a3cd019924d0e48b))
* say what the browser lets an overlay page reach, and the API's edges ([381077a](https://github.com/kqesar/alltp-tracker/commit/381077ad4d6225fd0daa4c1b6832c284f484a676))
* **web:** say what the close codes and MAX_VALUE mean today ([b8cd903](https://github.com/kqesar/alltp-tracker/commit/b8cd9038ac3609040c82cfbc29e29e741d7fb155))


### 🔧 Code Refactoring

* **desktop:** share the run and the atomic write between servers ([4f1f19d](https://github.com/kqesar/alltp-tracker/commit/4f1f19ddfcd43c522d79d1e2672f1854327acb20))
* **desktop:** split the relay's building blocks out of follow.rs ([41aab3a](https://github.com/kqesar/alltp-tracker/commit/41aab3a9d16bab06bf920ab3a274ee971e8390e8))
* **web:** share the trailing throttle between publishers ([d46143f](https://github.com/kqesar/alltp-tracker/commit/d46143ffba6a082f735e15bc2aedcc47cb0791cc))

## [2.37.0](https://github.com/kqesar/alltp-tracker/compare/v2.36.1...v2.37.0) (2026-10-23)


### ✨ Features

* **desktop:** relay the run to viewers on the local network ([50bc07a](https://github.com/kqesar/alltp-tracker/commit/50bc07a51c59cd59c9a81a23b127e78696512744))
* **desktop:** tell a page that loads again whether the relay runs ([f05dbb2](https://github.com/kqesar/alltp-tracker/commit/f05dbb278e56e689574599ee6cf92794136c0381))
* **web:** follow the desktop app's run live from a phone on the network ([664432b](https://github.com/kqesar/alltp-tracker/commit/664432b0733be985699564616036325b89c802d6))


### 🐛 Bug Fixes

* **desktop:** bound the relay's connections and close them all on stop ([e854edb](https://github.com/kqesar/alltp-tracker/commit/e854edbdc2cc9e04315dfd2a87952b173de67f05))
* **desktop:** ping each viewer and send it a beat, dropping one that went silent ([55aeb68](https://github.com/kqesar/alltp-tracker/commit/55aeb68f805e2f1256271b41e9502b74d340b45f))
* **web:** drop a followed connection that falls silent, at once when back in view ([b17a624](https://github.com/kqesar/alltp-tracker/commit/b17a62455d2e6384964174afd35152451b725379))
* **web:** keep the live follow switch focused, announce its failures, show its link ([d3a36ae](https://github.com/kqesar/alltp-tracker/commit/d3a36aef3f65406ce17690321526f86699462f56))
* **web:** stop live follow before an update installs ([87891fd](https://github.com/kqesar/alltp-tracker/commit/87891fd1dc82f53af143b8079d23601a5b088832))


### 📚 Documentation

* correct live follow's design doc to what the relay and the view do ([932076d](https://github.com/kqesar/alltp-tracker/commit/932076da106e0d8b2104501f3a3ac1047d30b39a))
* describe live follow's page side and how a player follows on a phone ([6b320f4](https://github.com/kqesar/alltp-tracker/commit/6b320f48eaa0db59852766f340123c4de300fec3))
* record what the real-app check of the relay's limits proved ([ee8357e](https://github.com/kqesar/alltp-tracker/commit/ee8357e1401481a225a6f936f8d02f6ec1fcfbeb))

## [2.36.1](https://github.com/kqesar/alltp-tracker/compare/v2.36.0...v2.36.1) (2026-10-23)


### 🐛 Bug Fixes

* **web:** drop a saved Super Metroid run that holds more than an item's pool ([8c27c8a](https://github.com/kqesar/alltp-tracker/commit/8c27c8a0ae20760845eb7f2082df304cdbd8fdc2))
* **web:** fall back to a manual copy when the clipboard refuses ([106fc0b](https://github.com/kqesar/alltp-tracker/commit/106fc0bcb723e6ed327b625033b56eb09ae08b55))
* **web:** follow other tabs only through localStorage on the Super Metroid and SMZ3 boards ([810ea15](https://github.com/kqesar/alltp-tracker/commit/810ea15092f23ed3d2d9faebf05f3e948d8199b8))
* **web:** ignore Ctrl+Alt+Z and Shift+Y on the Super Metroid and SMZ3 boards ([7fa29f3](https://github.com/kqesar/alltp-tracker/commit/7fa29f3861276da861de21976e61aff4d16d5a10))
* **web:** say that Undo takes back a new game ([e9631f9](https://github.com/kqesar/alltp-tracker/commit/e9631f966ae5434b058e58491a190470f2fd6225))
* **web:** tell every board's player a save is another game's in the same words ([28c16b7](https://github.com/kqesar/alltp-tracker/commit/28c16b723af6f073471902d80ab42057689c9b5e))


### 📚 Documentation

* bring the engine README in line with the packs ([179c489](https://github.com/kqesar/alltp-tracker/commit/179c4891e1f0dc43ca8d9fbff8b9979f7a237b7d))
* complete the packs' module tables, fix the Inverted note ([638a3be](https://github.com/kqesar/alltp-tracker/commit/638a3be444f10dd56533cd2b28e7ef3e78003564))
* cover the Windows and macOS lint, drop a plan reference ([b670ef5](https://github.com/kqesar/alltp-tracker/commit/b670ef52a3ead5ff5c83db8cc9b0151716ac3d76))
* describe the shortcuts, New game and big keys in the guide ([fecc5c6](https://github.com/kqesar/alltp-tracker/commit/fecc5c6d84db13e7fc3da796f9fc0bdb39671e92))
* fix the layout notes in CLAUDE.md and development.md ([e63f7e9](https://github.com/kqesar/alltp-tracker/commit/e63f7e935a8ad8eefce693d837519b49ca630443))
* fix three claims in the area rules ([0b665cb](https://github.com/kqesar/alltp-tracker/commit/0b665cb5d0a7aa4dd05e32660bd8808312a5968c))
* name the duplication that is the design ([a16e629](https://github.com/kqesar/alltp-tracker/commit/a16e6299d3000f5169f885f32f471138eb2fddd8))
* say SMZ3's store shares the history and tab sync, and when the status delay restarts ([7ad7c74](https://github.com/kqesar/alltp-tracker/commit/7ad7c744334a353acead37ab9dacab21a4020bf7))
* spell the packs' script paths from the repository root ([140d002](https://github.com/kqesar/alltp-tracker/commit/140d002972a6931180870136a7ba653df88b47fc))


### 🔧 Code Refactoring

* **engine:** one locationId for the alttpr and smz3 packs ([852c80f](https://github.com/kqesar/alltp-tracker/commit/852c80fe9e0592088bf41b93eba2fee811c0082a))
* **web:** make ShortcutsButton's dialog loader the shared lazyDialog ([70ced9e](https://github.com/kqesar/alltp-tracker/commit/70ced9ee4fc38bb85a6bc9e56d1edc45168ce8e1))
* **web:** one GameShell around the three games' boards ([8ddf2a4](https://github.com/kqesar/alltp-tracker/commit/8ddf2a46151db7797e1c5e1b478313bb56dcbae2))
* **web:** one hook for the stream views' page lifecycle ([0ce6612](https://github.com/kqesar/alltp-tracker/commit/0ce66123c1d1712188bb262fe5e134defaff8848))
* **web:** one RunToolbar for the Super Metroid and SMZ3 bars ([5455889](https://github.com/kqesar/alltp-tracker/commit/5455889b7b432edbdcee1615306f7674839285ea))
* **web:** one ToggleList for Super Metroid's objectives and SMZ3's boss tokens ([8d6aa6e](https://github.com/kqesar/alltp-tracker/commit/8d6aa6e6f2913d11170a3241199ba4e16c091fe1))
* **web:** share the run history and save format of the SM and SMZ3 stores ([271139a](https://github.com/kqesar/alltp-tracker/commit/271139a109e1c9e381310e312ca327db7bd78133))
* **web:** share the Super Metroid and SMZ3 boards' common CSS ([4c0395c](https://github.com/kqesar/alltp-tracker/commit/4c0395c3bf5678f96e1f1de27016d61a6d5514c5))
* **web:** type the run history's changes without a cast ([52e9106](https://github.com/kqesar/alltp-tracker/commit/52e9106b02b7317fd21a54a328f2931c66d70c7d))

## [2.36.0](https://github.com/kqesar/alltp-tracker/compare/v2.35.0...v2.36.0) (2026-10-23)


### ✨ Features

* **web:** show the share link as a QR code ([19de4f8](https://github.com/kqesar/alltp-tracker/commit/19de4f8430a937fb4f1b6d5b3ee5cbea9aecdcf2))


### 🐛 Bug Fixes

* **web:** fold the secondary toolbar actions to icons before every label ([0fcf48a](https://github.com/kqesar/alltp-tracker/commit/0fcf48a1400c35569bcbd1ed290befb176344c79))


### 📚 Documentation

* mention the share link's QR code in the README ([be55de9](https://github.com/kqesar/alltp-tracker/commit/be55de960865c4f764dcf3f6f75fb451d2a69d19))
* refresh the README screenshots for the Half Magic cell ([83ba8fc](https://github.com/kqesar/alltp-tracker/commit/83ba8fc7762597038ec029caa4d8812f2b98295a))
* refresh the README screenshots for the staged toolbar fold ([ca1377b](https://github.com/kqesar/alltp-tracker/commit/ca1377b31cc27b5f0574b27a239a5b0e3a5d66c3))

## [2.35.0](https://github.com/kqesar/alltp-tracker/compare/v2.34.0...v2.35.0) (2026-10-20)


### ✨ Features

* **web:** a Half Magic cell on the ALttPR board ([0c0a6fa](https://github.com/kqesar/alltp-tracker/commit/0c0a6fa66334fc7df9425cc5b1375e17df9afa94))
* **web:** shorter share links for ALttPR and SMZ3 ([9dea59f](https://github.com/kqesar/alltp-tracker/commit/9dea59fba534d99dfd8042ee658f03bb9c47eb95))


### 🐛 Bug Fixes

* **web:** keep shared links opening when the tracker's tables grow ([bf68c83](https://github.com/kqesar/alltp-tracker/commit/bf68c83531e807979d79fda859f1296360dedf4f))
* **web:** let the logic see half magic ([6f19cda](https://github.com/kqesar/alltp-tracker/commit/6f19cda09e33c087c898b03aa5e2afc157e9f4fe))
* **web:** stop flashing the landing text before the board on reload ([f1b9349](https://github.com/kqesar/alltp-tracker/commit/f1b934997bba437b09013a41e12343fdf7433d51))


### 📚 Documentation

* state the Map Rando race rule as its source has it ([15b92af](https://github.com/kqesar/alltp-tracker/commit/15b92af4f3506377763a5c95978018bf132031a2))

## [2.34.0](https://github.com/kqesar/alltp-tracker/compare/v2.33.0...v2.34.0) (2026-10-20)


### ✨ Features

* **web:** call the tracker Rando Atlas ([7cf6a8e](https://github.com/kqesar/alltp-tracker/commit/7cf6a8ee40bab7c353d339954bdacdfc9fb2e005))
* **web:** count visits with GoatCounter ([9a0eef8](https://github.com/kqesar/alltp-tracker/commit/9a0eef82935c008e5409553a64cbf93090e24866))
* **web:** describe each game to search engines and link previews ([6b9bbbc](https://github.com/kqesar/alltp-tracker/commit/6b9bbbc4f7c87902a10c3b9e8cc02c32f728bacf))
* **web:** share a run through its URL ([97936be](https://github.com/kqesar/alltp-tracker/commit/97936be14ffd5439e41d43ab7e853e0fa3468af2))
* **web:** the Rando Atlas icon ([9fb545d](https://github.com/kqesar/alltp-tracker/commit/9fb545d982e4b5c7311bb50d3a06ea768ccfb9e3))


### 🐛 Bug Fixes

* **autotrack:** head the diagnostic report with the Rando Atlas name ([abecc61](https://github.com/kqesar/alltp-tracker/commit/abecc614d87261c8d5dbdfb1382d380b84cf4641))
* **web:** export a Super Metroid or SMZ3 run without its undo history ([88246da](https://github.com/kqesar/alltp-tracker/commit/88246da0c12b471208f2011c8dcb482cef46fdfc))


### ⚡ Performance Improvements

* **web:** precache only the active game ([fe44989](https://github.com/kqesar/alltp-tracker/commit/fe449894dcb4f015bff95ba108abf79434dab87a))
* **web:** serve the maps as lossless WebP ([bed98f6](https://github.com/kqesar/alltp-tracker/commit/bed98f645802bd6fc85e75a1d2b43bb5d876c5c1))


### 📚 Documentation

* a short README with screenshots, the guide and dev notes under docs ([03832e2](https://github.com/kqesar/alltp-tracker/commit/03832e2330c9d3a22f45db9a23e95d92cec05fed))
* tighten CONTRIBUTING and add a security policy ([b8292fa](https://github.com/kqesar/alltp-tracker/commit/b8292fa1bd90f6eef9206646715ab2eba649af54))

## [2.33.0](https://github.com/kqesar/alltp-tracker/compare/v2.32.0...v2.33.0) (2026-10-20)


### ✨ Features

* **desktop:** add the AppImage to the application menu ([9343373](https://github.com/kqesar/alltp-tracker/commit/934337396a126115eb762441b2496ec987a251a5))

## [2.32.0](https://github.com/kqesar/alltp-tracker/compare/v2.31.0...v2.32.0) (2026-10-20)


### ✨ Features

* **desktop:** global shortcuts through the system's own service ([470af21](https://github.com/kqesar/alltp-tracker/commit/470af21f8fceb7c2f45ff08fc7f35e96814b09fc))
* **desktop:** key labels from the system keymap on Linux ([44b0cac](https://github.com/kqesar/alltp-tracker/commit/44b0cac89dc5ef14b22abcfb254ed5cd2cf08e04))
* **web:** a Global tab for the desktop app's shortcuts ([914d89d](https://github.com/kqesar/alltp-tracker/commit/914d89d71748343add0319810cc673f87760b9e9))


### 🐛 Bug Fixes

* **desktop:** allow the portal's give-way as dead code off Linux ([1c5e889](https://github.com/kqesar/alltp-tracker/commit/1c5e8899d50c82a25eb4093631b5a8e7c96bfee3))
* **desktop:** compile the shortcuts' report types without the portal ([2500747](https://github.com/kqesar/alltp-tracker/commit/25007478a61069a40b1edf41d618c888e102e174))
* **desktop:** drop a --step that finds no page listening ([3f0bbea](https://github.com/kqesar/alltp-tracker/commit/3f0bbea7c702701e96a2437382e9dedd10ae6655))
* **desktop:** escape % and refuse control characters in the desktop file's Exec ([6dbac53](https://github.com/kqesar/alltp-tracker/commit/6dbac53dd241a8a847a49c58ee57a079fd7323a6))
* **desktop:** keep the keylogger floor on AltGr, Option and say what the numpad costs ([4134e73](https://github.com/kqesar/alltp-tracker/commit/4134e735067d4a24a8016dfe2da4e398b212a4ff))
* **desktop:** release X11 keys in one request and flush after a refused grab ([c7b99ff](https://github.com/kqesar/alltp-tracker/commit/c7b99ffe65c1c2b7a2ca5edb33a604f79aacbb98))
* **desktop:** touch nothing on Wayland until the first binding, and bound the probe ([2e5108b](https://github.com/kqesar/alltp-tracker/commit/2e5108b8e93c4669832da08d7b062ac78c132d10))
* **web:** a Global tab that says only what it shows, and remembers a refusal ([2c51064](https://github.com/kqesar/alltp-tracker/commit/2c510644138d8024be079aff516adb16302cad70))


### 📚 Documentation

* **desktop:** global shortcuts ([72cd2d0](https://github.com/kqesar/alltp-tracker/commit/72cd2d09f2d46d7dd2ded60830167bae75d70ad5))
* **desktop:** state the real floor, the numpad choice and the step queue policy ([9a39587](https://github.com/kqesar/alltp-tracker/commit/9a395878a1b88110270134f25e4f9b25c547c229))


### 🔧 Code Refactoring

* **web:** the shortcuts table as a component of its own ([239a800](https://github.com/kqesar/alltp-tracker/commit/239a800e903aebb75ab013393d3f769a0451b429))

## [2.31.0](https://github.com/kqesar/alltp-tracker/compare/v2.30.0...v2.31.0) (2026-10-20)


### ✨ Features

* **autotrack:** read RetroArch directly over its network commands ([7eb94e4](https://github.com/kqesar/alltp-tracker/commit/7eb94e43c9b9e44cb2cbf46498d467be79163250))
* **desktop:** read RetroArch without SNI ([fcfd63e](https://github.com/kqesar/alltp-tracker/commit/fcfd63eee72ef9b32a3b6e383b951fb0af84733d))


### 🐛 Bug Fixes

* **web:** name the game a wrong ROM is checked against ([172f71b](https://github.com/kqesar/alltp-tracker/commit/172f71b0c8183a93a68c45dc7e5729d7e7bb649e))
* **web:** point Safari players at the desktop app ([2c705be](https://github.com/kqesar/alltp-tracker/commit/2c705bee881e121673ebe2325b681895390e74ff))


### 📚 Documentation

* **autotrack:** RetroArch caps a read at its descriptor's end only ([9895155](https://github.com/kqesar/alltp-tracker/commit/98951559d87c3906f370e1a7925605799ea7bf24))

## [2.30.0](https://github.com/kqesar/alltp-tracker/compare/v2.29.1...v2.30.0) (2026-10-19)


### ✨ Features

* **desktop:** the tracker as a desktop app for Windows, macOS and Linux ([b736eb1](https://github.com/kqesar/alltp-tracker/commit/b736eb1ea435695a2e042d16c8d1947836d46688))


### 🐛 Bug Fixes

* **autotrack:** gate loopback on https pages only ([50c2d61](https://github.com/kqesar/alltp-tracker/commit/50c2d614198edb0b7666f76e1b614edd07636e59))

## [2.29.1](https://github.com/kqesar/alltp-tracker/compare/v2.29.0...v2.29.1) (2026-10-19)


### 🐛 Bug Fixes

* **alttpr:** read the game's saves with its game mode ([cf68a5c](https://github.com/kqesar/alltp-tracker/commit/cf68a5ca8d4766eed3b9f24fffa622d6e76a8e84))

## [2.29.0](https://github.com/kqesar/alltp-tracker/compare/v2.28.0...v2.29.0) (2026-10-19)


### ✨ Features

* **smz3:** autotrack SMZ3 seeds, both games at once ([8bd720d](https://github.com/kqesar/alltp-tracker/commit/8bd720d4f26633f8f8bfc2064b280e5707dc66cd))
* **web:** autotrack SMZ3 seeds ([84a58a0](https://github.com/kqesar/alltp-tracker/commit/84a58a072baba042e488d5c47176b8451fe147a5))


### 🐛 Bug Fixes

* **autotrack:** forget a mode's bytes when the game switches ([4d865e0](https://github.com/kqesar/alltp-tracker/commit/4d865e0c30ac001e98855b57d2c54b342c2677b7))
* **sm:** read the game state with the items ([64f6d4b](https://github.com/kqesar/alltp-tracker/commit/64f6d4bf1a736fa486450f8ad4dc234481f27e71))


### 🔧 Code Refactoring

* **autotrack:** export ModeProbe with the pack contract ([9195e8d](https://github.com/kqesar/alltp-tracker/commit/9195e8db24e8c429d5a52a118d7104d704fe5716))
* **web:** share a game's autotracking session, control and dialog ([2ca88df](https://github.com/kqesar/alltp-tracker/commit/2ca88dfc8d103f8125a62b76de88823d5c6bed72))

## [2.28.0](https://github.com/kqesar/alltp-tracker/compare/v2.27.0...v2.28.0) (2026-10-19)


### ✨ Features

* **autotrack:** read ExHiROM games, as the SMZ3 combined ROM ([aa36ddb](https://github.com/kqesar/alltp-tracker/commit/aa36ddb5b733899e54716abe2d0028a7a65534c7))
* **smz3:** place every location on the maps of Hyrule and Zebes ([15ef9fe](https://github.com/kqesar/alltp-tracker/commit/15ef9fe775cb688ba4279c5840baf28afd6ef79f))
* **smz3:** port SMZ3's logic, held to its upstream tests ([030703f](https://github.com/kqesar/alltp-tracker/commit/030703ff23ada21584145ecaca05ec8101f4d31e))
* **web:** track SMZ3 runs ([e3559fb](https://github.com/kqesar/alltp-tracker/commit/e3559fbf7d4199b22075858e546a871575b48471))


### 🐛 Bug Fixes

* **autotrack:** read HiROM's ROM mirrors at the cartridge's bytes ([a2de539](https://github.com/kqesar/alltp-tracker/commit/a2de539d88ee9413e6da23ae1a49130c62aea4c8))


### 🔧 Code Refactoring

* **alttpr:** give markerStatus a module of its own ([384c301](https://github.com/kqesar/alltp-tracker/commit/384c3012c03d917e9afeb2ac0806821ea9cdbc5c))
* **web:** share the map legend between the games ([6ad7b0b](https://github.com/kqesar/alltp-tracker/commit/6ad7b0b98373446b1849966db57bb0e370cf8d99))

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
