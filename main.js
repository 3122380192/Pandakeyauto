const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { spawn, exec, execFile, execSync } = require('child_process');
const fs = require('fs');
const ProfileManager = require('./profileManager');
const githubSync = require('./githubSync');

const customUserDataPath = path.join(__dirname, '.app_data');
if (!fs.existsSync(customUserDataPath)) {
  try { fs.mkdirSync(customUserDataPath, { recursive: true }); } catch (e) {}
}

// ⭐ SINGLE INSTANCE LOCK: Ngăn chặn chạy nhiều tiến trình ngầm gây xung đột phím tắt và huỷ hoại window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
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
  mirrorScreen: true,
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
  deviceId: null
};

const binDir = path.join(__dirname, 'bin');
const adbPath = path.join(binDir, 'adb.exe');
const scrcpyPath = path.join(binDir, 'scrcpy.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 680,
    minWidth: 680,
    minHeight: 580,
    backgroundColor: '#0b0f19',
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(binDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
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

  // 2. Phím tắt chuyển đổi chuột 2 chiều: Alt+3 và F1 (1 phím duy nhất cực nhanh cho game thủ)
  try {
    globalShortcut.register('Alt+3', () => {
      try { switchMouseFocus(); } catch (e) {}
    });
  } catch (e) {}

  try {
    globalShortcut.register('F1', () => {
      try { switchMouseFocus(); } catch (e) {}
    });
  } catch (e) {}

  // 3. Phím tắt Boss Key (Alt+X): Tắt đèn màn hình (không khóa máy) & Ẩn cửa sổ PC
  try {
    globalShortcut.register('Alt+X', () => {
      try { toggleBossKeyHide(); } catch (e) {}
    });
  } catch (e) {}

  // 4. Phím tắt Khóa Màn Hình Nhanh (Alt+Z)
  try {
    globalShortcut.register('Alt+Z', () => {
      try { quickLockScreen(); } catch (e) {}
    });
  } catch (e) {}

  // 5. Phím tắt Chuyển Chế Độ Chơi Sang Phải (Next Mode): Alt + Right
  try {
    globalShortcut.register('Alt+Right', () => {
      try { handleNextModeShortcut(); } catch (e) {}
    });
  } catch (e) {}

  // 6. Phím tắt Chuyển Chế Độ Chơi Sang Trái (Prev Mode): Alt + Left
  try {
    globalShortcut.register('Alt+Left', () => {
      try { handlePrevModeShortcut(); } catch (e) {}
    });
  } catch (e) {}
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

// XỬ LÝ PHÍM ĐỔI CHUỘT (Alt, F1, Alt+3): Chuyển đổi chuột 2 chiều siêu tốc 0ms lag
let mouseWatcherProcess = null;

function handleMouseSwitchOutput(out) {
  if (out.includes('RELEASED_TO_PC')) {
    showOsdNotification({
      icon: '🖱️',
      game: 'ĐỔI CHUỘT',
      badge: 'Alt / F1',
      mode: 'Đã nhả chuột về Máy Tính',
      specs: 'Di chuyển chuột tự do trên PC'
    });
    sendLog('🔄 [Đổi chuột Alt/F1] Đã nhả chuột về MÁY TÍNH thành công!');
  } else if (out.includes('CAPTURED_TO_PHONE')) {
    showOsdNotification({
      icon: '🎮',
      game: 'ĐỔI CHUỘT',
      badge: 'Alt / F1',
      mode: 'Đã đưa chuột vào Game Điện Thoại',
      specs: 'Tương tác trực tiếp trên màn hình game'
    });
    sendLog('🎮 [Đổi chuột Alt/F1] Đã đưa chuột sang ĐIỆN THOẠI thành công!');
  } else if (out.includes('SCRCPY_NOT_RUNNING')) {
    showOsdNotification({
      icon: '⚠️',
      game: 'CHƯA CHIẾU MÀN HÌNH',
      badge: 'Alt / F1',
      mode: 'Màn hình điện thoại chưa bật',
      specs: 'Bấm Bắt đầu chiếu màn hình trước'
    });
    sendLog('⚠️ [Đổi chuột] Chưa có phiên chiếu màn hình nào đang chạy. Vui lòng bấm "▶ BẮT ĐẦU CHIẾU MÀN HÌNH"!');
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
  const pcPath = path.join(__dirname, `screenshot_${now}.png`);
  return new Promise((resolve) => {
    exec(`"${adbPath}" ${target} shell screencap -p /sdcard/temp_screen.png && "${adbPath}" ${target} pull /sdcard/temp_screen.png "${pcPath}" && "${adbPath}" ${target} shell rm /sdcard/temp_screen.png`, { windowsHide: true }, (err) => {
      if (err) return resolve({ success: false, message: 'Lỗi chụp màn hình: ' + err.message });
      resolve({ success: true, message: `Đã lưu ảnh màn hình vào: screenshot_${now}.png` });
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

// ================= KHỞI CHẠY SCRCPY VỚI TỐI ƯU HÓA HÌNH ẢNH & ĐỘ TRỄ =================
ipcMain.handle('start-control', async (event, options = {}) => {
  if (controlProcess) {
    stopActiveControl();
  }

  currentOptions = { ...currentOptions, ...options };
  const {
    deviceId,
    mirrorScreen,
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
    renderDriver
  } = currentOptions;

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
      // Dùng UHID Hardware Input để khắc phục triệt để lỗi Vivo/Xiaomi/Oppo chặn chuột & bàn phím
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

    // 9. Tùy chọn cửa sổ
    args.push('--window-title=APKRemote - Màn Hình Điện Thoại (F1/Alt+3: Doi Chuot | Alt+X: An Nhanh | Alt+Z: Khoa May | Alt+Left/Right: Che Do)');
    args.push('--always-on-top');

    // 10. Tắt màn hình thật của điện thoại khi chiếu lên PC (nếu người dùng tích chọn checkbox)
    if (turnScreenOff) {
      args.push('--turn-screen-off');
    }

    // 11. Giữ điện thoại luôn thức khi cắm cáp
    if (stayAwake) {
      args.push('--stay-awake');
    }
  } else {
    // Không chiếu màn hình PC, điều khiển thẳng trên màn thật của điện thoại
    // ⭐ ẨN HOÀN TOÀN: 1x1 borderless, trong suốt, 0% CPU, không hiện bất kỳ cửa sổ/tab đen nào
    args.push('-K', '-M', '--no-video-playback');
    args.push('--window-borderless');
    args.push('--window-width=1', '--window-height=1');
    args.push('--window-x=0', '--window-y=0');
    args.push('--window-title=APKRemote_HiddenCapture');
    if (stayAwake) args.push('--stay-awake');
    if (!forwardAudio) args.push('--no-audio');
  }

  try {
    controlProcess = spawn(scrcpyPath, args, {
      cwd: binDir,
      windowsHide: true
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
      const errorDetail = lastErrorLines.slice(-3).join(' | ');
      sendSafe('otg-status', { running: false, code, error: errorDetail });
    });

    const modeName = mirrorScreen
      ? `Chiếu màn hình PC (${codec ? codec.toUpperCase() : 'H265'} | ${fps || 120} FPS | Đệm: ${effectiveBuffer || 0}ms)`
      : 'Điều Khiển Ngầm Trực Tiếp (0% CPU, Ẩn hoàn toàn cửa sổ đen)';

    showOsdNotification({
      icon: '🎮',
      game: 'KÍCH HOẠT THÀNH CÔNG',
      badge: `${fps || 120} FPS`,
      mode: modeName,
      specs: 'Alt / F1: Đổi chuột • Alt+Right/Left: Chế độ • Alt+Z: Khóa ĐT'
    });

    return {
      success: true,
      message: `Đã kích hoạt [${modeName}]! Bấm Alt / F1 đổi chuột siêu tốc, Alt+Right/Left đổi chế độ.`
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
    return { success: true, message: 'Đã dừng điều khiển.' };
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
