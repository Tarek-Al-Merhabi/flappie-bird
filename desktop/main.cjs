const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const gamePage = path.resolve(__dirname, "..", "index.html");
const gamePageUrl = new URL(pathToFileURL(gamePage));

function createWindow() {
  const window = new BrowserWindow({
    width: 580,
    height: 880,
    minWidth: 420,
    minHeight: 660,
    title: "Flappie Bird",
    backgroundColor: "#f6f4e9",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).pathname !== gamePageUrl.pathname) event.preventDefault();
  });

  window.loadFile(gamePage, { query: { desktop: "1" } });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.tarek.flappiebird");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
