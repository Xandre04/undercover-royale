# **Undercover Royale 👑**

Clash Royale meets social deduction and stat guessing\! Find the impostor in your clan or guess the hidden card.

**Undercover Royale** is a local multiplayer party game that combines social deduction with three unique game modes. It is an installable Progressive Web App (PWA) designed for one phone passed around the group, and it works offline once installed.

## [**🎮 PLAY NOW**](https://xandre04.github.io/undercover-royale/)

## **⚔️ Game Modes**

### **🟦 REGULAR MODE (Classic Social Deduction)**

The core experience. Only the classic three roles are in play: **Civilian**, **Undercover**, and **Mr. White**.

### **🟣 CHAOS MODE (Advanced Roles)**

Unlocks advanced roles, traps, and special abilities for a higher-stakes game. Includes **Jester, Bodyguard, Hunter, and Electro Wizard**.

### **🟢 STAT GUESS MODE (Clash Wordle)**

A solo or collaborative analytical game where players must guess a hidden Clash Royale card based on iterative feedback about its statistics.

### **🔴 ROYALE RUSH (Endless Runner)**

A 3D endless runner down the arena path. Swipe left or right to change lanes, up to jump and down to slide. Dodge Skeleton Armies, barrels, rolling Logs and Arrows volleys, collect elixir, and grab card power-ups: **Rage** (double score), **Tornado** (pulls elixir to you) and **Guards** (survive one crash). Brush an obstacle from the side and the Barbarian closes in; stumble again and he catches you.

The 3D models live in `runner/models/` and can be swapped for your own `.glb` files (see the README in that folder).

## **🎭 Special Roles & Abilities (Chaos Mode)**

| Role | Team | Icon | Special Ability / Twist |
| :---- | :---- | :---- | :---- |
| **Mr. White** | Impostor | ⬜ | Has **NO** card. Can steal the win by guessing the Civilian word if caught (75% fuzzy match). |
| **Jester** | Neutral | 🃏 | **Win Condition:** Wins the game instantly, alone, if successfully voted out. |
| **Bodyguard** | Civilian | 🛡️ | Assigned one player to protect. If the **target** is eliminated, the Bodyguard is **also** eliminated immediately\! |
| **Hunter** | Civilian | 🤠 | If voted out, they get a **Last Shot** to choose and eliminate one other player with them. |
| **Electro Wizard** | Impostor | ⚡ | During the reveal phase, secretly **ZAPs (silences)** one player for the entire first discussion round. |
| **Mirror Match** | Trait | 🪞 | **(5% Chance)** Two Civilians get the same word and are secretly told of their alliance. |

## **📲 Install It**

* **Android / Chrome / Edge:** open the site and tap the green install button on the home screen (or *Install app* in the browser menu).  
* **iPhone / iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.  
* After the first launch the game works without internet. Updates arrive automatically the next time you open it online.

## **✨ Quality of Life**

* Screen stays awake during a game, and the phone's back button asks before leaving a battle.  
* Forgot your card? Tap the eye button during the discussion to check it privately.  
* Scoreboard that tracks wins per player name across games.  
* 50 card pairs, and recently played pairs are skipped.  
* Stat Guess streaks, best streak, and a shareable emoji result.  
* Sound effects and vibration, each with an on/off toggle.

## **🕹️ How to Play**

### **Social Deduction (Regular/Chaos)**

1. **Setup:** Choose a mode, set player count, and assign roles (must have at least one enemy).  
2. **Pass & Reveal:** Each player secretly sees their identity and word. The Electro Wizard selects a Zap target here.  
3. **Discuss:** Everyone takes turns saying *one word* to describe their card within the **3-minute time limit**. Zapped players remain silent.  
4. **Eliminate & Resolve:** The eliminated player's role is revealed, triggering any special role abilities (Mr. White's Guess, Jester's Win, or Hunter's Shot) and checking for Bodyguard sacrifice.

### **Stat Guess Mode**

1. **Goal:** Guess the randomly selected hidden card.  
2. **Guessing:** Enter a card name and submit.  
3. **Feedback:** Each guess shows 7 stats (Elixir, Rarity, Speed, Hit Speed, Type, Targets, Range):  
   * **Green:** Exact match.  
   * **Yellow:** Close. Elixir within 1, Hit Speed within 0.3s, Rarity or Speed one step away, or a partly matching Type/Targets/Range.  
   * **Red \+ Arrow:** Wrong. The arrow shows whether the hidden card's value is **higher (▲)** or **lower (▼)**.  
4. **Limit:** You have 10 tries.

## **🛠️ Development**

No build tools are needed to edit the game.

* `app.js`: the whole game (plain JavaScript using [Preact](https://preactjs.com) + [htm](https://github.com/developit/htm), no compile step).  
* `styles.css`: the Clash-style components. Tailwind utility classes are used for layout.  
* `app.css`: generated from the two files above. **Don't edit it by hand.** The *Build CSS* GitHub Action rebuilds and commits it on every push.  
* `dev.html`: open this locally to preview changes with the Tailwind CDN before the Action has run.  
* `runner/`: Royale Rush (three.js, loaded only when that mode opens). Models and how to replace them are in `runner/models/`.  
* `tools/prune_glb.py`: shrinks a .glb model by dropping unused animations and meshes.  
* `sw.js` + `manifest.webmanifest`: offline support and installability.  
* `card_data.json`: stats used by Stat Guess.

To preview locally, serve the folder (for example `python -m http.server`) and open `http://localhost:8000/dev.html`.

## **📄 Disclaimer**

This project is a fan-made game and is **not** endorsed by or affiliated with Supercell.

Clash Royale art and assets are intellectual property of Supercell. For more information, see Supercell's [Fan Content Policy](https://supercell.com/en/fan-content-policy/).

The underlying game code is licensed under the MIT License.

