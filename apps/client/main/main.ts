import { app, BrowserWindow, shell } from "electron";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    titleBarStyle: "hidden",
    frame: false,

    trafficLightPosition: { x: 10, y: 10 },
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#0f1012",
            symbolColor: "#ffffff",
          },
        }
      : {}),
  });

  win.loadURL("http://localhost:5173/auth");

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
