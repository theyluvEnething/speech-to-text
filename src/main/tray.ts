import { Tray, Menu, nativeImage, app } from "electron";
import { join } from "path";

let tray: Tray | null = null;

export function createTray(onSettings: () => void): void {
  const iconPath = join(app.getAppPath(), "assets", "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("Wavely");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Settings",
      click: () => onSettings(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => onSettings());
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
