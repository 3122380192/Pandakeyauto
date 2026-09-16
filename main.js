const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn, exec, execFile, execSync } = require('child_process');
const fs = require('fs');
const ProfileManager = require('./profileManager');
const githubSync = require('./githubSync');

const customUserDataPath = app.isPackaged
  ? path.join(app.getPath('userData'), '.app_data')
  : path.join(__dirname, '.app_data');
if (!fs.existsSync(customUserDataPath)) {
  try { fs.mkdirSync(customUserDataPath, { recursive: true }); } catch (e) {}
}

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(customUserDataPath, 'error.log'), `[${new Date().toISOString()}] UncaughtException: ${err.stack || err}\n`);
  } catch (e) {}
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(customUserDataPath, 'error.log'), `[${new Date().toISOString()}] UnhandledRejection: ${reason}\n`);
  } catch (e) {}
});

// ⭐ SINGLE INSTANCE LOCK: Ngăn chặn chạy nhiều tiến trình ngầm gây xung đột phím tắt và huỷ hoại window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

const profileManager = new ProfileManager(customUserDataPath);
const githubConfigFile = path.join(customUserDataPath, 'github_config.json');

let mainWindow = null;
let crosshairWindow = null;
let osdWindow = null;
let controlProcess = null;
let isScreenHidden = false;
let isCoolerActive = false;
let isBoosterActive = false;
let rapidFireInterval = null;

// ⭐ HÀM GỬI IPC AN TOÀN TUYỆT ĐỐI (KHÔNG BAO GIỜ BỊ LỖI Object has been destroyed)
function sendLog(msg) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send('otg-log', msg);
    } catch (e) {}
  }
}

function sendSafe(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
    } catch (e) {}
  }
}

let crosshairConfig = {
  enabled: false,
  type: 'cross',
  color: '#00ff66',
  size: 30,
  thickness: 2,
  gap: 5
};

let currentOptions = {
  mirrorScreen: false,
  enableControl: true,
  uhidInput: true,
  stayAwake: true,
  turnScreenOff: false,
  forwardAudio: true,
  fps: 120,
  bitrate: '16M',
  maxSize: 1080,
  codec: 'h265',
  displayBuffer: 0,
  videoBuffer: 0,
  audioBuffer: 10,
  renderDriver: 'direct3d11',
  mouseSpeed: 'native',
  deviceId: null
};

const binDir = app.isPackaged
  ? (fs.existsSync(path.join(process.resourcesPath, 'bin'))
      ? path.join(process.resourcesPath, 'bin')
      : path.join(__dirname, 'bin'))
  : path.join(__dirname, 'bin');
const adbPath = path.join(binDir, 'adb.exe');
const scrcpyPath = path.join(binDir, 'scrcpy.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 740,
    minWidth: 780,
    minHeight: 620,
    backgroundColor: '#080a11',
    show: true,
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(binDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopRecoilWorker();
    stopMouseWatcher();
    globalShortcut.unregisterAll();
    stopActiveControl();
    if (osdWindow && !osdWindow.isDestroyed()) {
      try { osdWindow.destroy(); } catch (e) {}
    }
    if (crosshairWindow && !crosshairWindow.isDestroyed()) {
      try { crosshairWindow.destroy(); } catch (e) {}
    }
    app.quit();
    process.exit(0);
  });

  // Đăng ký phím tắt toàn cục an toàn
  // 1. Phím tắt Bật / Tắt điều khiển: Ctrl+Alt+K
  try {
    globalShortcut.register('CommandOrControl+Alt+K', () => {
      try { toggleControlState(); } catch (e) {}
    });
  } catch (e) {}

  // ⭐ Phím tắt chuyển đổi chuột/bàn phím (Alt) được xử lý độc quyền và an toàn
  // thông qua switch_mouse.exe --watch (Low-Level Hook) để đảm bảo cô lập 100% khi ở trong điện thoại,
  // tuyệt đối không dùng RegisterHotKey để tránh cướp phím khi chơi game trên điện thoại.
}

// ================= FLOATING GAMING HUD (OSD NOTIFICATION) =================
function createOsdWindow() {
  if (osdWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  const winWidth = 520;
  const winHeight = 110;
  const x = Math.round((width - winWidth) / 2);
  const y = 16;

  osdWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  osdWindow.setIgnoreMouseEvents(true);
  osdWindow.loadFile(path.join(__dirname, 'osd.html'));

  osdWindow.on('closed', () => {
    osdWindow = null;
  });
}

function showOsdNotification(data) {
  if (!osdWindow) {
    createOsdWindow();
  }
  if (osdWindow && osdWindow.webContents) {
    osdWindow.showInactive();
    osdWindow.webContents.executeJavaScript(`
      if (typeof window.displayHud === 'function') {
        window.displayHud(${JSON.stringify(data)});
      }
    `).catch(() => {});
  }
}

function handleNextModeShortcut() {
  const result = profileManager.nextMode();
  if (result && result.mode) {
    sendSafe('mode-changed', result);
    sendLog(`🎮 [Alt+Right] Đã chuyển sang: ${result.mode.name} (${result.modeIndex + 1}/${result.totalModes})`);

    // Hiển thị HUD OSD nổi trên màn hình game
    showOsdNotification({
      icon: result.profile.icon || '🔥',
      game: result.profile.name,
      badge: `${result.mode.fps || 60} FPS`,
      mode: result.mode.name,
      specs: `${(result.mode.codec || 'H.264').toUpperCase()} • Đệm: ${result.mode.displayBuffer || 0}ms • ${result.mode.bitrate || '16M'}`
    });
  }
}

function handlePrevModeShortcut() {
  const result = profileManager.prevMode();
  if (result && result.mode) {
    sendSafe('mode-changed', result);
    sendLog(`🎮 [Alt+Left] Đã chuyển sang: ${result.mode.name} (${result.modeIndex + 1}/${result.totalModes})`);

    // Hiển thị HUD OSD nổi trên màn hình game
    showOsdNotification({
      icon: result.profile.icon || '🔥',
      game: result.profile.name,
      badge: `${result.mode.fps || 60} FPS`,
      mode: result.mode.name,
      specs: `${(result.mode.codec || 'H.264').toUpperCase()} • Đệm: ${result.mode.displayBuffer || 0}ms • ${result.mode.bitrate || '16M'}`
    });
  }
}

// ================= CỬA SỔ TÂM NGẮM ẢO (CROSSHAIR OVERLAY) =================
function createCrosshairWindow() {
  if (crosshairWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const winSize = 120;
  const x = Math.round((width - winSize) / 2);
  const y = Math.round((height - winSize) / 2);

  crosshairWindow = new BrowserWindow({
    width: winSize,
    height: winSize,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
    }
  });

  crosshairWindow.setIgnoreMouseEvents(true);
  crosshairWindow.loadFile(path.join(__dirname, 'crosshair.html'));

  crosshairWindow.on('closed', () => {
    crosshairWindow = null;
  });
}

function updateCrosshairOverlay() {
  if (crosshairConfig.enabled) {
    if (!crosshairWindow) {
      createCrosshairWindow();
    }
    if (crosshairWindow && crosshairWindow.webContents) {
      crosshairWindow.webContents.executeJavaScript(`
        if (typeof renderCrosshair === 'function') {
          renderCrosshair(${JSON.stringify(crosshairConfig)});
        }
      `);
      crosshairWindow.showInactive();
    }
  } else {
    if (crosshairWindow) {
      crosshairWindow.close();
      crosshairWindow = null;
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  createOsdWindow();
  startMouseWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  stopMouseWatcher();
  globalShortcut.unregisterAll();
  stopActiveControl();
  if (crosshairWindow) {
    try { crosshairWindow.close(); } catch (e) {}
  }
  if (osdWindow) {
    try { osdWindow.close(); } catch (e) {}
  }
  if (rapidFireInterval) {
    clearInterval(rapidFireInterval);
  }
});

app.on('window-all-closed', () => {
  stopActiveControl();
  if (process.platform !== 'darwin') app.quit();
});

// ⭐ TÍNH NĂNG KHÓA MÀN HÌNH NHANH (Alt+Z)
function quickLockScreen() {
  const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';
  exec(`"${adbPath}" ${target} shell input keyevent 26`, { windowsHide: true });

  const psScript = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class LockWin {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
        public const byte VK_MENU = 0x12; // Alt
        public const uint KEYEVENTF_KEYUP = 0x0002;
    }
"@
    [LockWin]::keybd_event([LockWin]::VK_MENU, 0x38, 0, 0)
    [LockWin]::keybd_event([LockWin]::VK_MENU, 0x38, [LockWin]::KEYEVENTF_KEYUP, 0)

    Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowHandle -ne 0) { [LockWin]::ShowWindow($_.MainWindowHandle, 6) } # SW_MINIMIZE
    }
  `;
  exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

  showOsdNotification({
    icon: '🔒',
    game: 'KHÓA ĐIỆN THOẠI',
    badge: 'Alt + Z',
    mode: 'Đã khóa màn hình điện thoại',
    specs: 'Đã nhả chuột về máy tính và thu nhỏ game'
  });

  sendLog('🔒 [Alt+Z] ĐÃ KHÓA MÀN HÌNH ĐIỆN THOẠI & Nhả chuột về máy tính!');
}

// Boss Key (Alt+X): Tắt đèn màn hình không khóa máy
function toggleBossKeyHide() {
  isScreenHidden = !isScreenHidden;
  const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';

  if (isScreenHidden) {
    exec(`"${adbPath}" ${target} shell svc power stayon false`, { windowsHide: true });
    
    const psScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class BossWin {
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
          public const byte VK_MENU = 0x12;
          public const uint KEYEVENTF_KEYUP = 0x0002;
      }
"@
      [BossWin]::keybd_event([BossWin]::VK_MENU, 0x38, 0, 0)
      [BossWin]::keybd_event([BossWin]::VK_MENU, 0x38, [BossWin]::KEYEVENTF_KEYUP, 0)

      Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.MainWindowHandle -ne 0) { [BossWin]::ShowWindow($_.MainWindowHandle, 6) }
      }
    `;
    exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

    showOsdNotification({
      icon: '🛡️',
      game: 'BOSS KEY ẨN GẤP',
      badge: 'Alt + X',
      mode: 'Màn hình ĐT đã tắt đèn',
      specs: 'Combat game vẫn chạy ngầm • Cửa sổ PC đã ẩn'
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.minimize(); } catch (e) {}
    }
    sendLog('🛡️ [Boss Key Alt+X] ĐÃ TẮT MÀN HÌNH ĐIỆN THOẠI & ẨN CỬA SỔ! Bấm Alt+X lần nữa để mở lại.');
  } else {
    exec(`"${adbPath}" ${target} shell input keyevent 224`, { windowsHide: true });
    exec(`"${adbPath}" ${target} shell svc power stayon true`, { windowsHide: true });

    const psScript2 = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class BossWin {
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
      }
"@
      Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.MainWindowHandle -ne 0) {
              [BossWin]::ShowWindow($_.MainWindowHandle, 9)
              [BossWin]::SetForegroundWindow($_.MainWindowHandle)
          }
      }
    `;
    exec(`powershell -WindowStyle Hidden -Command "${psScript2.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });

    showOsdNotification({
      icon: '✨',
      game: 'KHÔI PHỤC GAME',
      badge: 'Alt + X',
      mode: 'Màn hình và cửa sổ đã hiện lại',
      specs: 'Sẵn sàng tiếp tục chiến đấu'
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.restore(); } catch (e) {}
    }
    sendLog('✨ [Boss Key Alt+X] Đã khôi phục màn hình và cửa sổ game!');
  }
}

// XỬ LÝ PHÍM ĐỔI CHUỘT (Alt): Chuyển đổi chuột 2 chiều siêu tốc 0ms lag
let mouseWatcherProcess = null;

function handleMouseSwitchOutput(out) {
  if (out.includes('RELEASED_TO_PC')) {
    showOsdNotification({
      icon: '🖱️',
      game: 'ĐỔI CHUỘT',
      badge: 'Phím Alt',
      mode: 'Đã nhả chuột về Máy Tính',
      specs: 'Toàn bộ phím & chuột đã về máy tính'
    });
    sendLog('🔄 [Đổi chuột] Đã nhả chuột & bàn phím về MÁY TÍNH thành công!');
  } else if (out.includes('CAPTURED_TO_PHONE')) {
    showOsdNotification({
      icon: '🎮',
      game: 'ĐỔI CHUỘT',
      badge: 'Phím Alt',
      mode: 'Đã khóa chuột & phím vào Điện Thoại',
      specs: 'Cô lập 100% không ảnh hưởng máy tính. Nhấn Alt để thoát'
    });
    sendLog('🎮 [Đổi chuột] Đã khóa chuột & phím vào ĐIỆN THOẠI! (Cô lập 100%, nhấn Alt để quay về PC)');
  } else if (out.includes('SCRCPY_NOT_RUNNING')) {
    showOsdNotification({
      icon: '⚠️',
      game: 'CHƯA KÍCH HOẠT',
      badge: 'Phím Alt',
      mode: 'Phiên điều khiển chưa bật',
      specs: 'Bấm Bắt đầu điều khiển trước'
    });
    sendLog('⚠️ [Đổi chuột] Chưa có phiên điều khiển nào đang chạy. Vui lòng bấm "▶ BẮT ĐẦU ĐIỀU KHIỂN"!');
  }
}

function startMouseWatcher() {
  if (mouseWatcherProcess) return;
  const switcherPath = path.join(binDir, 'switch_mouse.exe');
  if (!fs.existsSync(switcherPath)) return;

  try {
    mouseWatcherProcess = spawn(switcherPath, ['--watch'], {
      cwd: binDir,
      windowsHide: true
    });

    mouseWatcherProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line) handleMouseSwitchOutput(line);
      }
    });

    mouseWatcherProcess.on('close', () => {
      mouseWatcherProcess = null;
    });
  } catch (err) {
    console.error('Lỗi khi chạy watcher chuột:', err);
  }
}

function stopMouseWatcher() {
  if (mouseWatcherProcess) {
    try { mouseWatcherProcess.kill(); } catch (e) {}
    mouseWatcherProcess = null;
  }
}

function switchMouseFocus() {
  try {
    const switcherPath = path.join(binDir, 'switch_mouse.exe');
    execFile(switcherPath, (err, stdout) => {
      const out = stdout ? stdout.trim() : '';
      handleMouseSwitchOutput(out);
    });
  } catch (err) {
    console.error('Lỗi khi đổi chuột:', err);
  }
}

// Bật / Tắt điều khiển bằng phím tắt
async function toggleControlState() {
  try {
    if (controlProcess) {
      stopActiveControl();
      sendLog('🔔 [Ctrl+Alt+K] Đã dừng điều khiển!');
      sendSafe('otg-status', { running: false, code: 0 });
    } else {
      sendLog('🔔 [Ctrl+Alt+K] Đang khởi động điều khiển...');
      sendSafe('request-start-control', {});
    }
  } catch (e) {}
}

// Kiểm tra thiết bị Apple
function checkAppleDevice() {
  return new Promise((resolve) => {
    const psCmd = `powershell -Command "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'Apple|iPhone|iPad' -or $_.InstanceId -match 'VID_05AC' } | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"`;
    exec(psCmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// Lấy danh sách thiết bị
ipcMain.handle('get-devices', async () => {
  return new Promise(async (resolve) => {
    const appleDevices = await checkAppleDevice();
    exec(`"${adbPath}" devices -l`, { windowsHide: true }, (err, stdout) => {
      let adbDevices = [];
      if (!err && stdout) {
        const lines = stdout.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(/\s+/);
            const id = parts[0];
            const state = parts[1];
            const modelMatch = line.match(/model:(\S+)/);
            const productMatch = line.match(/product:(\S+)/);
            const model = modelMatch ? modelMatch[1] : (productMatch ? productMatch[1] : 'Android Device');
            const isWifi = id.includes(':');
            adbDevices.push({ id, state, model, isWifi, raw: line });
          }
        }
      }
      resolve({ success: true, devices: adbDevices, appleDevices });
    });
  });
});

// ================= PROFILES & GAME MODES =================
ipcMain.handle('get-profiles', async () => {
  return profileManager.getAll();
});

ipcMain.handle('set-active-profile', async (event, profileId) => {
  const ok = profileManager.setActiveProfile(profileId);
  return { success: ok, currentProfile: profileManager.getActiveProfile() };
});

ipcMain.handle('set-active-mode', async (event, { profileId, modeIndex }) => {
  const mode = profileManager.setActiveModeIndex(profileId, modeIndex);
  return { success: !!mode, mode };
});

ipcMain.handle('next-mode', async () => {
  const result = profileManager.nextMode();
  return { success: true, ...result };
});

ipcMain.handle('prev-mode', async () => {
  const result = profileManager.prevMode();
  return { success: true, ...result };
});

ipcMain.handle('update-mode-options', async (event, options) => {
  const updated = profileManager.updateActiveModeOptions(options);
  return { success: !!updated, mode: updated };
});

ipcMain.handle('export-profiles', async () => {
  return { success: true, json: profileManager.exportJsonString() };
});

ipcMain.handle('import-profiles', async (event, data) => {
  const ok = profileManager.importProfiles(data);
  return { success: ok, profiles: profileManager.getAll() };
});

// ⭐ Thêm, Xóa, Sửa Profile Game Tùy Chỉnh
ipcMain.handle('add-profile', async (event, profileData) => {
  const newProfile = profileManager.addProfile(profileData);
  return { success: !!newProfile, profile: newProfile, profiles: profileManager.getAll() };
});

ipcMain.handle('delete-profile', async (event, profileId) => {
  const ok = profileManager.deleteProfile(profileId);
  return { success: ok, profiles: profileManager.getAll() };
});

ipcMain.handle('update-profile', async (event, { profileId, data }) => {
  const updated = profileManager.updateProfile(profileId, data);
  return { success: !!updated, profile: updated, profiles: profileManager.getAll() };
});

// ================= GITHUB GIST SYNC =================
ipcMain.handle('get-github-config', async () => {
  try {
    if (fs.existsSync(githubConfigFile)) {
      return JSON.parse(fs.readFileSync(githubConfigFile, 'utf8'));
    }
  } catch (e) {}
  return { token: '', gistId: '' };
});

ipcMain.handle('save-github-config', async (event, config) => {
  try {
    fs.writeFileSync(githubConfigFile, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('sync-github-upload', async (event, { token, gistId }) => {
  try {
    const data = profileManager.getAll();
    const res = await githubSync.uploadProfiles(token, data, gistId);
    try {
      fs.writeFileSync(githubConfigFile, JSON.stringify({ token, gistId: res.gistId }, null, 2), 'utf8');
    } catch (e) {}
    return res;
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('sync-github-download', async (event, { gistId, token }) => {
  try {
    const res = await githubSync.downloadProfiles(gistId, token);
    if (res.success && res.data) {
      profileManager.importProfiles(res.data);
      try {
        fs.writeFileSync(githubConfigFile, JSON.stringify({ token: token || '', gistId: res.gistId }, null, 2), 'utf8');
      } catch (e) {}
      return {
        success: true,
        profiles: profileManager.getAll(),
        message: res.message
      };
    }
    return { success: false, message: 'Dữ liệu không hợp lệ.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// ================= VIP TÂM NGẮM & TẢN NHIỆT & GAME BOOSTER =================
ipcMain.handle('toggle-crosshair', async (event, enabled) => {
  crosshairConfig.enabled = (typeof enabled === 'boolean') ? enabled : !crosshairConfig.enabled;
  updateCrosshairOverlay();
  return { success: true, enabled: crosshairConfig.enabled, config: crosshairConfig };
});

ipcMain.handle('update-crosshair', async (event, newConfig) => {
  crosshairConfig = { ...crosshairConfig, ...newConfig };
  updateCrosshairOverlay();
  return { success: true, config: crosshairConfig };
});

ipcMain.handle('toggle-phone-cooler', async (event, { deviceId, enable }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isCoolerActive = typeof enable === 'boolean' ? enable : !isCoolerActive;

  return new Promise((resolve) => {
    if (isCoolerActive) {
      exec(`"${adbPath}" ${target} shell settings put system screen_brightness 1`, { windowsHide: true }, () => {
        resolve({
          success: true,
          coolerActive: true,
          message: '❄️ Đã kích hoạt Tản Nhiệt: Độ sáng màn hình điện thoại đã hạ về mức thấp nhất để giữ máy mát lạnh khi combat!'
        });
      });
    } else {
      exec(`"${adbPath}" ${target} shell settings put system screen_brightness 150`, { windowsHide: true }, () => {
        resolve({
          success: true,
          coolerActive: false,
          message: '☀️ Đã khôi phục độ sáng màn hình điện thoại bình thường.'
        });
      });
    }
  });
});

// ⭐ VIP: 1-CLICK GAME BOOSTER VIA ADB (TẮT ANIMATION & TỐI ƯU HIỆU NĂNG)
ipcMain.handle('boost-device', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isBoosterActive = true;

  return new Promise((resolve) => {
    // 1. Tắt toàn bộ animation hệ thống Android để đạt 0ms phản hồi
    const cmdAnim = `"${adbPath}" ${target} shell "settings put global window_animation_scale 0 && settings put global transition_animation_scale 0 && settings put global animator_duration_scale 0"`;
    // 2. Dọn dẹp ứng dụng chạy ngầm
    const cmdClean = `"${adbPath}" ${target} shell "am kill-all"`;

    exec(`${cmdAnim} && ${cmdClean}`, { windowsHide: true }, (err) => {
      showOsdNotification({
        icon: '🚀',
        game: 'GAME BOOSTER VIP',
        badge: 'Tối Ưu 100%',
        mode: 'Đã tắt Animation & Dọn RAM',
        specs: 'Android phản hồi tức thì 0ms'
      });
      resolve({
        success: true,
        message: '🚀 Game Booster: Đã triệt tiêu toàn bộ độ trễ animation hệ thống & giải phóng bộ nhớ RAM cho điện thoại!'
      });
    });
  });
});

ipcMain.handle('restore-device-anim', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  isBoosterActive = false;

  return new Promise((resolve) => {
    const cmdRestore = `"${adbPath}" ${target} shell "settings put global window_animation_scale 1 && settings put global transition_animation_scale 1 && settings put global animator_duration_scale 1"`;
    exec(cmdRestore, { windowsHide: true }, () => {
      resolve({
        success: true,
        message: 'Đã khôi phục hiệu ứng chuyển động hệ thống Android về mặc định (1.0x).'
      });
    });
  });
});

// ⭐ VIP: RAPID FIRE MACRO (AUTO TAP CỰC NHANH CHO SÚNG BÁN TỰ ĐỘNG)
ipcMain.handle('toggle-rapid-fire', async (event, { enabled, clicksPerSec }) => {
  const cps = parseInt(clicksPerSec) || 16;
  const intervalMs = Math.max(25, Math.round(1000 / cps));

  if (rapidFireInterval) {
    clearInterval(rapidFireInterval);
    rapidFireInterval = null;
  }

  if (enabled) {
    const psScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class RapidClick {
          [DllImport("user32.dll")]
          public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
          public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
          public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
          public static void Click() {
              mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
              mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
          }
      }
"@
      [RapidClick]::Click()
    `;

    rapidFireInterval = setInterval(() => {
      exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });
    }, intervalMs);

    showOsdNotification({
      icon: '🔫',
      game: 'RAPID FIRE VIP',
      badge: `${cps} TAPS/S`,
      mode: 'Sấy súng bán tự động cực gắt',
      specs: 'SKS, M14, SLR bắn như súng máy'
    });

    return { success: true, enabled: true, message: `Đã kích hoạt Rapid Fire (${cps} nhấp/giây)!` };
  } else {
    return { success: true, enabled: false, message: 'Đã tắt Rapid Fire.' };
  }
});

// 1-Click Kích Hoạt Panda Mouse Pro
ipcMain.handle('activate-panda', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    const cmd = `"${adbPath}" ${target} shell "sh /sdcard/Android/data/com.panda.mouse/files/scripts/activate.sh || sh /data/local/tmp/activate.sh"`;
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      if (output.includes('Done') || output.includes('success') || output.includes('sdk_int')) {
        resolve({ success: true, message: 'Kích hoạt Panda Mouse Pro thành công! Mở app Panda trên điện thoại để vào game.' });
      } else {
        const cmd2 = `"${adbPath}" ${target} shell "sh /data/data/com.panda.mouse/files/scripts/activate.sh"`;
        exec(cmd2, { windowsHide: true }, () => {
          resolve({ success: true, message: 'Đã gửi lệnh kích hoạt Panda Mouse Pro! Mở app Panda kiểm tra trạng thái Activated.' });
        });
      }
    });
  });
});

// Kết nối Wi-Fi Hotspot / IP
ipcMain.handle('connect-wifi', async (event, { deviceId, ipAddress }) => {
  return new Promise((resolve) => {
    const target = deviceId ? `-s "${deviceId}"` : '';
    if (ipAddress) {
      exec(`"${adbPath}" connect ${ipAddress}:5555`, { windowsHide: true }, (err, stdout) => {
        if (err || stdout.includes('failed')) {
          return resolve({ success: false, message: stdout || err.message });
        }
        resolve({ success: true, message: `Đã kết nối không dây tới ${ipAddress}:5555!` });
      });
      return;
    }

    exec(`"${adbPath}" ${target} tcpip 5555`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi mở cổng 5555: ' + err.message });
      exec(`"${adbPath}" ${target} shell "ip addr show wlan0 | grep 'inet '"`, { windowsHide: true }, (err2, stdout2) => {
        let ip = null;
        if (!err2 && stdout2) {
          const m = stdout2.match(/inet\s+([0-9.]+)/);
          if (m) ip = m[1];
        }
        if (!ip) {
          return resolve({
            success: true,
            message: 'Đã mở cổng 5555! Hãy nhập địa chỉ IP Wi-Fi điện thoại để kết nối.'
          });
        }
        exec(`"${adbPath}" connect ${ip}:5555`, { windowsHide: true }, (err3, stdout3) => {
          if (err3 || stdout3.includes('failed')) {
            return resolve({ success: false, message: `Không thể kết nối ${ip}:5555: ${stdout3}` });
          }
          resolve({ success: true, message: `Kết nối không dây thành công tới ${ip}:5555! Có thể rút cáp USB.` });
        });
      });
    });
  });
});

// Chụp ảnh màn hình
ipcMain.handle('take-screenshot', async (event, { deviceId }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const now = Date.now();
  const screenshotDir = app.isPackaged ? path.join(app.getPath('pictures'), 'PandakeyScreenshots') : __dirname;
  if (!fs.existsSync(screenshotDir)) {
    try { fs.mkdirSync(screenshotDir, { recursive: true }); } catch (e) {}
  }
  const pcPath = path.join(screenshotDir, `screenshot_${now}.png`);
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell screencap -p /sdcard/temp_screen.png && "${adbPath}" ${target} pull /sdcard/temp_screen.png "${pcPath}" && "${adbPath}" ${target} shell rm /sdcard/temp_screen.png`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chụp màn hình: ' + err.message });
      resolve({ success: true, message: `Đã lưu ảnh màn hình vào: ${pcPath}` });
    });
  });
});

// Gửi văn bản
ipcMain.handle('send-text-to-phone', async (event, { deviceId, text }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const safeText = (text || '').replace(/"/g, '\\"');
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell input text "${safeText}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi nhập văn bản: ' + err.message });
      resolve({ success: true, message: 'Đã gửi văn bản vào điện thoại!' });
    });
  });
});

// Mở URL trên điện thoại
ipcMain.handle('open-url-on-phone', async (event, { deviceId, url }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell am start -a android.intent.action.VIEW -d "${url}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, message: `Đã mở link trên điện thoại: ${url}` });
    });
  });
});

// Restart ADB
ipcMain.handle('restart-adb', async () => {
  return new Promise((resolve) => {
    exec(`"${adbPath}" kill-server && "${adbPath}" start-server`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, message: 'Đã khởi động lại ADB Server thành công!' });
    });
  });
});

ipcMain.handle('set-mouse-speed', async (event, speed) => {
  currentOptions.mouseSpeed = speed;
  try {
    const speedFile = path.join(os.tmpdir(), 'pandakey_mouse_speed.txt');
    fs.writeFileSync(speedFile, (speed || '0.35').toString());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ================= 🎯 RECOIL CONTROL SYSTEM (WIN32 C# NATIVE ZERO DELAY) =================
let recoilProcess = null;
let recoilConfig = {
  enabled: false,
  pullY: 4,
  jitterX: 1,
  delayMs: 120,
  intervalMs: 25
};

function startRecoilWorker() {
  stopRecoilWorker();
  const exePath = path.join(binDir, 'recoil_assist.exe');
  if (fs.existsSync(exePath)) {
    try {
      recoilProcess = spawn(exePath, [
        (recoilConfig.pullY || 4).toString(),
        (recoilConfig.jitterX || 1).toString(),
        (recoilConfig.delayMs || 120).toString(),
        (recoilConfig.intervalMs || 25).toString()
      ], {
        cwd: binDir,
        windowsHide: true
      });
      recoilProcess.on('close', () => {
        recoilProcess = null;
      });
    } catch (e) {
      console.error('Lỗi khi chạy recoil_assist.exe:', e);
    }
  }
}

function stopRecoilWorker() {
  if (recoilProcess) {
    try { recoilProcess.kill(); } catch (e) {}
    recoilProcess = null;
  }
}

ipcMain.handle('toggle-recoil', async (event, { enabled, pullY, jitterX, delayMs, intervalMs }) => {
  recoilConfig.enabled = !!enabled;
  if (pullY !== undefined) recoilConfig.pullY = pullY;
  if (jitterX !== undefined) recoilConfig.jitterX = jitterX;
  if (delayMs !== undefined) recoilConfig.delayMs = delayMs;
  if (intervalMs !== undefined) recoilConfig.intervalMs = intervalMs;

  if (recoilConfig.enabled) {
    startRecoilWorker();
    showOsdNotification({
      icon: '🔫',
      game: 'RECOIL CONTROL VIP',
      badge: 'BẬT (F6)',
      mode: `Kéo Trục Y: ${recoilConfig.pullY}px • Jitter: ±${recoilConfig.jitterX}px`,
      specs: `Độ trễ bắt đầu: ${recoilConfig.delayMs}ms • Chu kỳ: ${recoilConfig.intervalMs}ms`
    });
    return { success: true, enabled: true, config: recoilConfig, message: 'Đã bật Ghìm Tâm Tự Động (Recoil Control)!' };
  } else {
    stopRecoilWorker();
    showOsdNotification({
      icon: '⚪',
      game: 'RECOIL CONTROL',
      badge: 'ĐÃ TẮT',
      mode: 'Bắn súng chế độ bình thường',
      specs: 'Đã tắt tự động ghìm tâm'
    });
    return { success: true, enabled: false, message: 'Đã tắt Ghìm Tâm Tự Động.' };
  }
});

ipcMain.handle('update-recoil-config', async (event, config = {}) => {
  recoilConfig = { ...recoilConfig, ...config };
  if (recoilConfig.enabled) {
    startRecoilWorker();
  }
  return { success: true, config: recoilConfig };
});

// ================= 📱 KÉO GIÃN MÀN HÌNH TỈ LỆ IPAD 4:3 =================
ipcMain.handle('set-ipad-view', async (event, { width = 1440, height = 1920, density = 320, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    let cmd = `"${adbPath}" ${target} shell "wm size ${width}x${height}`;
    if (density && Number(density) > 0) {
      cmd += ` && wm density ${density}"`;
    } else {
      cmd += `"`;
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chỉnh màn hình iPad: ' + err.message });
      showOsdNotification({
        icon: '📱',
        game: 'TỈ LỆ IPAD 4:3',
        badge: `${width}×${height}`,
        mode: 'Góc nhìn mở rộng chuẩn tuyển thủ',
        specs: `DPI: ${density || 'Mặc định'} • Hình địch to dễ headshot`
      });
      resolve({ success: true, message: `Đã chỉnh tỉ lệ iPad ${width}×${height} (DPI ${density || 'Mặc định'}) thành công!` });
    });
  });
});

ipcMain.handle('reset-ipad-view', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell "wm size reset && wm density reset"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi khôi phục màn hình: ' + err.message });
      showOsdNotification({
        icon: '📱',
        game: 'MÀN HÌNH GỐC',
        badge: 'Khôi Phục',
        mode: 'Đã hoàn trả tỉ lệ gốc điện thoại',
        specs: 'Độ phân giải mặc định của máy'
      });
      resolve({ success: true, message: 'Đã khôi phục màn hình điện thoại về mặc định!' });
    });
  });
});

// ================= 🔁 AUTO FARM / TOUCH MACRO RECORDER & REPLAYER =================
let isRecordingMacro = false;
let recordedMacroEvents = [];
let isPlayingMacro = false;
let macroStopRequested = false;

ipcMain.handle('start-macro-record', async () => {
  isRecordingMacro = true;
  recordedMacroEvents = [];
  return { success: true, message: 'Bắt đầu ghi thao tác...' };
});

ipcMain.handle('stop-macro-record', async () => {
  isRecordingMacro = false;
  return { success: true, count: recordedMacroEvents.length, events: recordedMacroEvents };
});

ipcMain.handle('play-macro', async (event, { events, loopCount = 1, speed = 1.0, cooldownMs = 1000, deviceId } = {}) => {
  if (isPlayingMacro) return { success: false, message: 'Macro đang chạy!' };
  const target = deviceId ? `-s "${deviceId}"` : '';
  const runEvents = events || recordedMacroEvents;
  if (!runEvents || runEvents.length === 0) {
    return { success: false, message: 'Chưa có thao tác nào được ghi trong bộ nhớ!' };
  }

  isPlayingMacro = true;
  macroStopRequested = false;

  showOsdNotification({
    icon: '🔁',
    game: 'AUTO MACRO',
    badge: `Lặp: ${loopCount === -1 ? 'Vô hạn' : loopCount + ' lần'}`,
    mode: `Tốc độ: ${speed}x`,
    specs: `${runEvents.length} thao tác đang phát tự động`
  });

  (async () => {
    let currentLoop = 0;
    while (!macroStopRequested && (loopCount === -1 || currentLoop < loopCount)) {
      currentLoop++;
      for (let i = 0; i < runEvents.length; i++) {
        if (macroStopRequested) break;
        const ev = runEvents[i];
        if (ev.type === 'tap') {
          await new Promise((r) => {
            exec(`"${adbPath}" ${target} shell input tap ${ev.x} ${ev.y}`, { windowsHide: true }, () => r());
          });
        }
        const delay = Math.max(20, Math.round((ev.delay || 150) / (speed || 1.0)));
        await new Promise((r) => setTimeout(r, delay));
      }
      if (loopCount === -1 || currentLoop < loopCount) {
        await new Promise((r) => setTimeout(r, Math.max(100, cooldownMs)));
      }
    }
    isPlayingMacro = false;
    macroStopRequested = false;
  })();

  return { success: true, message: 'Đã bắt đầu phát lại Macro!' };
});

ipcMain.handle('stop-macro-play', async () => {
  macroStopRequested = true;
  isPlayingMacro = false;
  return { success: true, message: 'Đã dừng phát lại Macro.' };
});

// ================= 🔋 HARDWARE & BATTERY HUD =================
ipcMain.handle('get-battery-info', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell dumpsys battery`, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ success: false, message: 'Không thể đọc thông số pin: ' + (err ? err.message : '') });
      }
      const lines = stdout.split('\n');
      const data = {
        level: 100,
        tempC: 0,
        voltage: 0,
        status: 'Bình thường',
        health: 'Rất Tốt',
        acPowered: false,
        usbPowered: false
      };
      for (const line of lines) {
        const tr = line.trim();
        if (tr.startsWith('level:')) data.level = parseInt(tr.split(':')[1].trim()) || 0;
        if (tr.startsWith('temperature:')) {
          const rawTemp = parseInt(tr.split(':')[1].trim()) || 0;
          data.tempC = (rawTemp / 10).toFixed(1);
        }
        if (tr.startsWith('voltage:')) data.voltage = parseInt(tr.split(':')[1].trim()) || 0;
        if (tr.startsWith('AC powered:')) data.acPowered = tr.includes('true');
        if (tr.startsWith('USB powered:')) data.usbPowered = tr.includes('true');
        if (tr.startsWith('status:')) {
          const s = parseInt(tr.split(':')[1].trim()) || 1;
          if (s === 2) data.status = 'Đang Sạc Pin';
          else if (s === 3) data.status = 'Đang Dùng Pin (Xả)';
          else if (s === 4) data.status = 'Đang Chặn Sạc (Bypass)';
          else if (s === 5) data.status = 'Pin Đã Đầy';
          else data.status = 'Bình thường';
        }
        if (tr.startsWith('health:')) {
          const h = parseInt(tr.split(':')[1].trim()) || 2;
          if (h === 2) data.health = 'Rất Tốt';
          else if (h === 3) data.health = 'Nhiệt Độ Cao';
          else if (h === 7) data.health = 'Nhiệt Độ Lạnh';
          else data.health = 'Ổn Định';
        }
      }
      resolve({ success: true, battery: data });
    });
  });
});

ipcMain.handle('toggle-bypass-charging', async (event, { enabled, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    if (enabled) {
      exec(`"${adbPath}" ${target} shell "dumpsys battery unplug"`, { windowsHide: true }, () => {
        showOsdNotification({
          icon: '🔋',
          game: 'BYPASS CHARGING',
          badge: 'ĐÃ BẬT',
          mode: 'Đấu nguồn trực tiếp cho bo mạch',
          specs: 'Ngắt sạc vào pin • Chống phồng pin & Chống nóng máy'
        });
        resolve({ success: true, enabled: true, message: 'Đã kích hoạt Chế Độ Bỏ Qua Sạc (Bypass Charging)! Máy chạy nguồn trực tiếp, không sạc pin.' });
      });
    } else {
      exec(`"${adbPath}" ${target} shell "dumpsys battery reset"`, { windowsHide: true }, () => {
        showOsdNotification({
          icon: '⚡',
          game: 'SẠC BÌNH THƯỜNG',
          badge: 'Khôi Phục',
          mode: 'Đã nạp pin bình thường',
          specs: 'Nguồn điện nạp vào cell pin'
        });
        resolve({ success: true, enabled: false, message: 'Đã khôi phục chế độ sạc pin bình thường.' });
      });
    }
  });
});

ipcMain.handle('set-refresh-rate', async (event, { rate = 120, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    let cmd = '';
    if (rate === 'reset' || rate === 60 || rate === '60') {
      cmd = `"${adbPath}" ${target} shell "settings put system min_refresh_rate 60 && settings put system peak_refresh_rate 60"`;
    } else {
      cmd = `"${adbPath}" ${target} shell "settings put system min_refresh_rate ${rate} && settings put system peak_refresh_rate ${rate}"`;
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      showOsdNotification({
        icon: '⚡',
        game: 'TẦN SỐ QUÉT',
        badge: `${rate}Hz Max`,
        mode: 'Ép phần cứng 0ms drop',
        specs: `Khung hình siêu mượt ${rate}Hz`
      });
      resolve({ success: true, message: `Đã ép tần số quét màn hình ${rate}Hz thành công!` });
    });
  });
});

// ================= 📦 FILE DRAG & DROP & 1-CLICK WIRELESS ADB =================
ipcMain.handle('install-apk', async (event, { filePath, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const baseName = path.basename(filePath);
  return new Promise((resolve) => {
    sendLog(`📦 [Cài APK] Đang nạp và cài đặt: ${baseName}...`);
    exec(`"${adbPath}" ${target} install -r -d "${filePath}"`, { windowsHide: true }, (err, stdout) => {
      if (err || (stdout && stdout.includes('Failure'))) {
        return resolve({ success: false, message: 'Lỗi cài APK: ' + (stdout || err.message) });
      }
      showOsdNotification({
        icon: '📦',
        game: 'CÀI APK THÀNH CÔNG',
        badge: 'Hoàn Tất',
        mode: baseName,
        specs: 'Ứng dụng đã sẵn sàng trên màn hình điện thoại'
      });
      resolve({ success: true, message: `Cài đặt ${baseName} thành công!` });
    });
  });
});

ipcMain.handle('push-file-to-phone', async (event, { filePath, destDir = '/sdcard/Download/', deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  const fileName = path.basename(filePath);
  return new Promise((resolve) => {
    sendLog(`📁 [Chép File] Đang đẩy: ${fileName} vào ${destDir}...`);
    exec(`"${adbPath}" ${target} push "${filePath}" "${destDir}"`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chép file: ' + err.message });
      exec(`"${adbPath}" ${target} shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${destDir}${fileName}"`, { windowsHide: true }, () => {});
      showOsdNotification({
        icon: '📁',
        game: 'CHÉP FILE THÀNH CÔNG',
        badge: 'Download/',
        mode: fileName,
        specs: `Đã lưu vào thư mục ${destDir}`
      });
      resolve({ success: true, message: `Đã chép file ${fileName} vào ${destDir}!` });
    });
  });
});

ipcMain.handle('activate-wireless-adb', async (event, { deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} tcpip 5555`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi mở cổng 5555: ' + err.message });
      exec(`"${adbPath}" ${target} shell "ip addr show wlan0 || ip route"`, { windowsHide: true }, (err2, stdout2) => {
        let ip = null;
        if (stdout2) {
          const m = stdout2.match(/inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
          if (m) ip = m[1];
        }
        if (!ip) {
          return resolve({ success: false, message: 'Không thể tự động tìm thấy IP Wi-Fi điện thoại. Hãy đảm bảo điện thoại đang bắt Wi-Fi cùng mạng với PC!' });
        }
        exec(`"${adbPath}" connect ${ip}:5555`, { windowsHide: true }, (err3, stdout3) => {
          if (err3 || (stdout3 && stdout3.includes('failed'))) {
            return resolve({ success: false, message: `Kết nối tới ${ip}:5555 thất bại: ${stdout3}` });
          }
          showOsdNotification({
            icon: '📡',
            game: 'WIRELESS ADB',
            badge: `${ip}:5555`,
            mode: 'Đã kết nối không dây 100%',
            specs: 'BẠN CÓ THỂ RÚT CÁP USB NGAY BÂY GIỜ!'
          });
          resolve({ success: true, ip, message: `Kết nối không dây thành công tới ${ip}:5555! Bạn có thể rút cáp USB.` });
        });
      });
    });
  });
});

// ================= 🎥 STREAMER & CONTENT CREATOR =================
ipcMain.handle('toggle-show-touches', async (event, { enabled, deviceId } = {}) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell settings put system show_touches ${enabled ? 1 : 0}`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: err.message });
      resolve({ success: true, enabled, message: enabled ? 'Đã bật hiển thị chấm chạm tay trên màn hình.' : 'Đã tắt hiển thị chạm.' });
    });
  });
});

function getRecordingsDir() {
  const recDir = app.isPackaged ? path.join(app.getPath('videos'), 'PandakeyRecordings') : path.join(__dirname, 'Recordings');
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  return recDir;
}

ipcMain.handle('open-recordings-folder', async () => {
  const recDir = getRecordingsDir();
  shell.openPath(recDir);
  return { success: true };
});

// ================= 🎨 COMBAT ASSIST & COLOR AIM / FILTER =================
let colorAssistConfig = {
  enabled: false,
  color: 'red',
  fovSize: 80,
  smoothSpeed: 5,
  triggerBot: false,
  filterMode: 'vibrance'
};

ipcMain.handle('toggle-color-assist', async (event, { enabled } = {}) => {
  colorAssistConfig.enabled = !!enabled;
  showOsdNotification({
    icon: enabled ? '🎯' : '⚪',
    game: 'COLOR AIM ASSIST',
    badge: enabled ? 'ĐÃ KÍCH HOẠT' : 'ĐÃ TẮT',
    mode: enabled ? `Phát hiện màu: ${colorAssistConfig.color.toUpperCase()}` : 'Tắt hỗ trợ di tâm',
    specs: enabled ? `FOV: ${colorAssistConfig.fovSize}px • Smooth: ${colorAssistConfig.smoothSpeed}` : 'Chuẩn gốc'
  });
  return { success: true, config: colorAssistConfig };
});

ipcMain.handle('update-color-assist-config', async (event, config = {}) => {
  colorAssistConfig = { ...colorAssistConfig, ...config };
  return { success: true, config: colorAssistConfig };
});

// ================= KHỞI CHẠY SCRCPY VỚI TỐI ƯU HÓA HÌNH ẢNH & ĐỘ TRỄ =================
ipcMain.handle('start-control', async (event, options = {}) => {
  if (controlProcess) {
    stopActiveControl();
  }

  currentOptions = { ...currentOptions, ...options };
  const {
    deviceId,
    mirrorScreen = false,
    enableControl = true,
    uhidInput = true,
    stayAwake,
    turnScreenOff,
    forwardAudio,
    fps,
    bitrate,
    maxSize,
    codec,
    displayBuffer,
    videoBuffer,
    audioBuffer,
    renderDriver,
    mouseSpeed = 'native',
    recordGameplay = false
  } = currentOptions;

  // Ghi tức thì cấu hình tốc độ chuột để switch_mouse.exe áp dụng hãm tốc độ phần cứng
  try {
    const speedFile = path.join(os.tmpdir(), 'pandakey_mouse_speed.txt');
    fs.writeFileSync(speedFile, (mouseSpeed || '0.35').toString());
  } catch (e) {}

  const effectiveBuffer = (videoBuffer !== undefined && videoBuffer !== null) ? videoBuffer : (displayBuffer !== undefined && displayBuffer !== null ? displayBuffer : 0);
  const args = [];

  // ⭐ Dùng RCtrl cho phím tắt Scrcpy để KHÔNG xung đột với Alt+Left/Right của Pandakeyauto
  args.push('--shortcut-mod=rctrl');

  let targetDeviceId = deviceId;
  if (!targetDeviceId) {
    try {
      const devListStr = execSync(`"${adbPath}" devices`, { windowsHide: true }).toString();
      const lines = devListStr.trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 2 && parts[1] === 'device') {
          targetDeviceId = parts[0];
          break;
        }
      }
    } catch (e) {}
  }

  if (targetDeviceId) {
    args.push('-s', targetDeviceId);
  }

  if (mirrorScreen) {
    // 1. Kiểm soát quyền điều khiển điện thoại từ máy tính
    if (!enableControl) {
      args.push('--no-control');
    } else {
      if (uhidInput) {
        args.push('--keyboard=uhid');
        args.push('--mouse=uhid');
      }
    }

    // 2. Video Codec tối ưu (H.265 / HEVC hoặc H.264 / AV1)
    if (codec) {
      args.push(`--video-codec=${codec}`);
    }

    // 3. Tốc độ khung hình cao (120 FPS / 90 FPS)
    args.push(`--max-fps=${fps || 120}`);

    // 4. Bitrate truyền hình ảnh
    args.push(`--video-bit-rate=${bitrate || '16M'}`);

    // 5. Độ phân giải tối đa
    if (maxSize && Number(maxSize) > 0) {
      args.push(`--max-size=${maxSize}`);
    }

    // 6. Khử độ trễ đệm hình ảnh (Scrcpy 3.1: dùng --video-buffer thay cho --display-buffer)
    if (effectiveBuffer !== undefined && effectiveBuffer !== null) {
      args.push(`--video-buffer=${effectiveBuffer}`);
    }

    // 7. Direct3D 11 GPU Rendering
    if (renderDriver) {
      args.push(`--render-driver=${renderDriver}`);
    }

    // 8. Âm thanh độ trễ thấp
    if (forwardAudio) {
      if (audioBuffer !== undefined && audioBuffer !== null) {
        args.push(`--audio-buffer=${audioBuffer}`);
      }
    } else {
      args.push('--no-audio');
    }

    // 9. Cửa sổ chiếu màn hình
    args.push('--window-title=Pandakeyauto - Màn Hình Điện Thoại (Bấm Alt: Đổi Chuột)');
    args.push('--always-on-top');

    // 10. Tắt màn hình thật của điện thoại khi chiếu lên PC (nếu người dùng tích chọn checkbox)
    if (turnScreenOff) {
      args.push('--turn-screen-off');
    }

    // 11. Giữ điện thoại luôn thức khi cắm cáp
    if (stayAwake) {
      args.push('--stay-awake');
    }

    // 12. Ghi hình trận đấu trực tiếp qua GPU máy tính (0% lag điện thoại)
    if (recordGameplay) {
      const recDir = getRecordingsDir();
      const recFileName = `Gameplay_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
      const recPath = path.join(recDir, recFileName);
      args.push(`--record=${recPath}`);
      args.push('--record-format=mp4');
      sendLog(`🔴 [Ghi hình MP4] Đang ghi hình trận đấu vào: ${recFileName}`);
    }
  } else {
    // ⭐ TAB BẢNG ĐEN (VÙNG BẮT CHUỘT TRỰC TIẾP - 0% CPU, TỐI ƯU TỐC ĐỘ CHUỘT CHUẨN XÁC)
    args.push('-K', '-M', '--no-video-playback');
    args.push('--window-width=360', '--window-height=140');
    args.push('--window-title=Pandakeyauto - Vung Bat Chuot (Nhan Alt de doi chuot)');
    args.push('--always-on-top');
    if (stayAwake) args.push('--stay-awake');
    if (!forwardAudio) args.push('--no-audio');
  }

  try {
    const mouseScale = (mouseSpeed !== undefined && mouseSpeed !== null && mouseSpeed !== 'native') ? mouseSpeed.toString() : '1.0';
    controlProcess = spawn(scrcpyPath, args, {
      cwd: binDir,
      windowsHide: true,
      env: {
        ...process.env,
        SDL_MOUSE_RELATIVE_SPEED_SCALE: mouseScale,
        SDL_MOUSE_RELATIVE_SCALING: '1',
        SDL_MOUSE_NORMAL_SPEED_SCALE: mouseScale
      }
    });

    let lastErrorLines = [];

    controlProcess.stdout.on('data', (data) => {
      sendLog(data.toString());
    });

    controlProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      lastErrorLines.push(msg.trim());
      sendLog(msg);
    });

    controlProcess.on('close', (code) => {
      controlProcess = null;
      // Khôi phục ngay lập tức tốc độ chuột PC gốc
      try {
        execFile(path.join(binDir, 'switch_mouse.exe'), ['--restore'], { windowsHide: true });
      } catch (e) {}
      const errorDetail = lastErrorLines.slice(-3).join(' | ');
      sendSafe('otg-status', { running: false, code, error: errorDetail });
    });

    const modeName = mirrorScreen
      ? `Chiếu màn hình PC (${codec ? codec.toUpperCase() : 'H265'} | ${fps || 120} FPS)`
      : 'Tab Bảng Đen (Vùng Bắt Chuột - Tối Ưu Tốc Độ Chuột Nhất)';

    showOsdNotification({
      icon: '🎮',
      game: 'KÍCH HOẠT THÀNH CÔNG',
      badge: `${fps || 120} FPS`,
      mode: modeName,
      specs: 'Phím Alt: Đổi chuột PC <> ĐT • Giữ 100% cô lập máy tính'
    });

    return {
      success: true,
      message: `Đã kích hoạt [${modeName}]! Nhấn phím Alt để đổi chuột sang điện thoại (cô lập hoàn toàn với máy tính).`
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-control', async () => {
  return stopActiveControl();
});

function stopActiveControl() {
  if (controlProcess) {
    try {
      controlProcess.kill();
    } catch (e) {}
    controlProcess = null;
    try {
      execFile(path.join(binDir, 'switch_mouse.exe'), ['--restore'], { windowsHide: true });
    } catch (e) {}
    return { success: true, message: 'Đã dừng điều khiển và khôi phục tốc độ chuột PC.' };
  }
  return { success: true, message: 'Chưa có phiên nào hoạt động.' };
}

// Phím tắt Android
ipcMain.handle('send-keyevent', async (event, { deviceId, keycode }) => {
  const target = deviceId ? `-s "${deviceId}"` : '';
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell input keyevent ${keycode}`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, error: err.message });
      resolve({ success: true });
    });
  });
});
