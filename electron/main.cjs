const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

function createWindow() {
  const isDev = !app.isPackaged;
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "PHBKT Billing App",
    autoHideMenuBar: true,
  });

  win.setMenu(null);

  // In development, load from the dev server
  if (isDev) {
    win.loadURL('http://localhost:3000');
    // Open DevTools
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('relaunch', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on('download-and-update', async (event, url) => {
    if (!url) return;
    
    try {
      const tempDir = os.tmpdir();
      const fileName = `update_${Date.now()}.exe`;
      const filePath = path.join(tempDir, fileName);
      const file = fs.createWriteStream(filePath);

      https.get(url, (response) => {
        // Handle redirects (important for Google Drive links)
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              shell.openPath(filePath);
              app.quit();
            });
          });
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            shell.openPath(filePath);
            app.quit();
          });
        }
      }).on('error', (err) => {
        fs.unlink(filePath, () => {});
        console.error('Download failed:', err);
      });
    } catch (err) {
      console.error('Update failed:', err);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
