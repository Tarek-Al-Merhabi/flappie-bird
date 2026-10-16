# Flappie Bird

A tiny, friendly, flap-and-dodge arcade game. Tap, click, or press **Space** to fly through the gaps and see how many pipes you can pass.

## Play

Play online at [tarek-al-merhabi.github.io/flappie-bird](https://tarek-al-merhabi.github.io/flappie-bird/), or open `index.html` in a modern browser. No build step, framework, server, or downloaded assets are required.

## Download the Windows game

Download **Flappie-Bird-1.0.0-Windows-x64.exe** from [the latest GitHub Release](https://github.com/Tarek-Al-Merhabi/flappie-bird/releases/latest). It is a portable Windows app: save the `.exe` and open it to play; no installer or internet connection is needed.

## Controls

- **Space**, **↑**, click, or tap: flap
- **P** or the pause button: pause or resume
- **M** or the speaker button: toggle sound
- **Esc**: resume from the pause screen

Your personal best is saved in your browser on that device.

## Publish with GitHub Pages

1. Create a GitHub repository and add these files to its root.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your default branch and the **/(root)** folder, then save.

GitHub Pages will publish the game at the address shown in the Pages settings.

## Files

- `index.html` — page structure and accessible game controls
- `style.css` — responsive layout and styling
- `game.js` — drawing, physics, scoring, sound, and input
- `favicon.svg` — small Flappie mark
- `desktop/main.cjs` — secure Electron desktop window
- `desktop.css` and `desktop-mode.js` — game-only desktop layout

## Build the Windows app from source

1. Install Node.js.
2. Run `npm install`.
3. Run `npm run build:windows`.

The portable app is created in the `release` folder.
