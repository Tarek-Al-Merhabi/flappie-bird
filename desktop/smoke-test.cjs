const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const gamePage = path.resolve(__dirname, "..", "index.html");
let finished = false;

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (error) {
    console.error(error.stack || error);
    app.exit(1);
    return;
  }
  console.log("Desktop smoke check passed: load, start, pause, resume, and sound toggle.");
  app.exit(0);
}

const timeout = setTimeout(() => finish(new Error("Desktop smoke check timed out.")), 20000);

app.whenReady().then(() => {
  const testWindow = new BrowserWindow({
    show: false,
    width: 580,
    height: 880,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  testWindow.webContents.once("did-finish-load", async () => {
    try {
      const report = await testWindow.webContents.executeJavaScript(`(() => {
        const intro = document.querySelector('.intro');
        const canvas = document.querySelector('#game-canvas');
        const play = document.querySelector('#play-button');
        const overlay = document.querySelector('#game-overlay');
        const pause = document.querySelector('#pause-button');
        const sound = document.querySelector('#sound-button');
        const canvasSize = canvas.getBoundingClientRect();
        const fail = message => { throw new Error(message); };

        if (!document.documentElement.classList.contains('desktop-app')) fail('Desktop layout did not activate.');
        if (getComputedStyle(intro).display !== 'none') fail('Desktop layout still shows the web intro.');
        if (canvasSize.width < 1 || canvasSize.height < 1) fail('Game canvas is not visible.');
        if (Math.abs(canvas.width / canvas.height - 2 / 3) > 0.01) fail('Game canvas aspect ratio is incorrect.');

        play.click();
        if (!overlay.classList.contains('hidden') || pause.disabled) fail('Game did not start.');

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' }));
        if (overlay.classList.contains('hidden') || pause.getAttribute('aria-label') !== 'Resume game') fail('Game did not pause.');

        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
        if (!overlay.classList.contains('hidden') || pause.getAttribute('aria-label') !== 'Pause game') fail('Game did not resume.');

        sound.click();
        if (sound.getAttribute('aria-pressed') !== 'false') fail('Sound did not turn off.');
        sound.click();
        if (sound.getAttribute('aria-pressed') !== 'true') fail('Sound did not turn back on.');

        return true;
      })()`);

      if (report !== true) throw new Error("Desktop smoke check returned an invalid result.");
      finish();
    } catch (error) {
      finish(error);
    }
  });

  testWindow.webContents.once("did-fail-load", (_event, code, description) => {
    finish(new Error(`Desktop game failed to load (${code}): ${description}`));
  });

  testWindow.loadFile(gamePage, { query: { desktop: "1" } });
});

app.on("window-all-closed", () => finish(new Error("Desktop window closed before the smoke check completed.")));
