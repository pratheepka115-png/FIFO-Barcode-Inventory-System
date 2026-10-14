
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("Page load failed:", code, description, url);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer stopped:", details);
  });

  mainWindow.webContents.on("console-message", (_event, details) => {
    console.log("Renderer console:", details.message);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const indexPath = path.join(__dirname, "dist", "index.html");

  try {
    await mainWindow.loadFile(indexPath);
    console.log("Frontend loaded:", indexPath);
    mainWindow.webContents.openDevTools();
  } catch (error) {
    console.error("Frontend loading error:", error);

    dialog.showErrorBox(
      "FIFO Frontend Error",
      `Unable to load the frontend.\n${error.message}`
    );
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
