const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#f7f6f3',
    show: false,
    autoHideMenuBar: true,
    title: app.getName(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Внешние ссылки (Telegram, tel:) открываем системным браузером,
  // а не внутри окна приложения.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|tg):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^(https?|tg):/i.test(url)) shell.openExternal(url);
    }
  });

  if (isDev) window.webContents.openDevTools({ mode: 'detach' });

  return window;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
