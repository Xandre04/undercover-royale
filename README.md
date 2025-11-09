# **Undercover Royale 👑**

Clash Royale meets social deduction. Find the impostor in your clan\!

**Undercover Royale** is a local multiplayer party game inspired by the classic "Undercover," re-imagined with Clash Royale characters. Designed as a lightweight, single-file web application, it's perfect for playing with friends in the same room using just one phone.

🎮 PLAY LIVE DEMO  
(Note: Replace the link above with your actual GitHub Pages URL after deploying)

## **✨ Features**

* **📱 Local Pass & Play:** Only one device needed for the whole group (3-15 players).  
* **🃏 Clash Theme:** Over 30 pairs of related Clash Royale cards (e.g., Knight vs. Mega Knight, Wizard vs. Ice Wizard).  
* **🕵️‍♂️ 3 Unique Roles:**  
  * **Civilians:** Get the standard card.  
  * **Undercovers:** Get a slightly different card.  
  * **Mr. White:** Gets *no* card and must bluff entirely.  
* **🎯 Mr. White's Last Chance:** If caught, Mr. White gets one final chance to guess the Civilian card (with smart fuzzy-matching\!) to steal the win.  
* **🚀 Mobile Optimized (PWA):** Installable directly to your home screen for a native app-like experience.  
* **⚡ Single-File:** The entire game is contained in one index.html file. No backend required.

## **🕹️ How to Play**

1. **Setup:** Choose total players and how many impostors (Undercovers/Mr. Whites) you want.  
2. **Pass & Reveal:** Pass the device around. Each player secretly views their card.  
3. **Discuss:** Everyone takes turns saying *one word* to describe their card.  
4. **Vote:** Discuss and tap a player to eliminate them.  
5. **Win Conditions:**  
   * 🛡️ **Civilians Win:** Eliminate all impostors.  
   * 🗡️ **Impostors Win:** Outnumber the civilians.  
   * ❔ **Mr. White Wins:** Successfully guess the civilian card after being caught.

## **🛠️ Built With**

* [React](https://reactjs.org/) (via CDN)  
* [Tailwind CSS](https://tailwindcss.com/) (via CDN)  
* [Babel](https://babeljs.io/) (Standalone)  
* Vanilla JavaScript for PWA features

## **🚀 Running Locally**

Because the entire game is a single HTML file, running it is trivial:

1. Download the index.html file.  
2. Open it in any modern web browser (Chrome, Safari, Firefox).  
3. That's it\!

*Note: To test PWA installation features locally, you may need to serve the file over HTTPS or localhost due to browser security restrictions on Service Workers.*

## **📄 License & Disclaimer**

This project is a fan-made game and is **not** endorsed by or affiliated with Supercell.

Clash Royale art and assets are intellectual property of Supercell. For more information, see Supercell's [Fan Content Policy](https://supercell.com/en/fan-content-policy/).

The underlying game code is licensed under the MIT License.