const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

const customUserDataPath = path.join(__dirname, '.app_data');
if (!fs.existsSync(customUserDataPath)) {
  try { fs.mkdirSync(customUserDataPath, { recursive: true }); } catch (e) {}
}
app.setPath('userData', customUserDataPath);

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

let mainWindow;
let controlProcess = null;
let isScreenHidden = false;
let currentOptions = {
  mirrorScreen: false,
  stayAwake: true,
  turnScreenOff: false,
  forwardAudio: true,
  fps: 60,
  bitrate: '16M',
  deviceId: null
};

const binDir = path.join(__dirname, 'bin');
const adbPath = path.join(binDir, 'adb.exe');
const scrcpyPath = path.join(binDir, 'scrcpy.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 900,
    minHeight: 660,
    backgroundColor: '#0f172a',
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

  // 1. Phím tắt Bật / Tắt điều khiển: Ctrl+Alt+K
  globalShortcut.register('CommandOrControl+Alt+K', () => {
    toggleControlState();
  });

  // 2. Phím tắt chuyển đổi chuột 2 chiều: Alt+3
  globalShortcut.register('Alt+3', () => {
    switchMouseFocus();
  });

  // 3. Phím tắt Boss Key (Alt+X): Tắt đèn màn hình (không khóa máy) & Ẩn cửa sổ PC
  globalShortcut.register('Alt+X', () => {
    toggleBossKeyHide();
  });

  // 4. ⭐ PHÍM TẮT KHÓA MÀN HÌNH NHANH (Alt+Z): Khóa màn hình điện thoại bằng nút nguồn ảo & nhả chuột về PC
  globalShortcut.register('Alt+Z', () => {
    quickLockScreen();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopActiveControl();
});

app.on('window-all-closed', () => {
  stopActiveControl();
  if (process.platform !== 'darwin') app.quit();
});

// ⭐ TÍNH NĂNG KHÓA MÀN HÌNH NHANH (Alt+Z):
// Gửi mã lệnh bấm nút Nguồn (KEYCODE_POWER = 26) để KHÓA HẲN MÀN HÌNH điện thoại ngay lập tức
// Đồng thời thu nhỏ cửa sổ game trên PC và nhả chuột về máy tính!
function quickLockScreen() {
  const target = currentOptions.deviceId ? `-s "${currentOptions.deviceId}"` : '';

  // 1. Khóa màn hình điện thoại (Bấm phím Power)
  exec(`"${adbPath}" ${target} shell input keyevent 26`, { windowsHide: true });

  // 2. Nhả chuột về máy tính & thu nhỏ cửa sổ game
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

  if (mainWindow) {
    mainWindow.webContents.send('otg-log', '🔒 [Alt+Z] ĐÃ KHÓA MÀN HÌNH ĐIỆN THOẠI & Nhả chuột về máy tính!');
  }
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

    if (mainWindow) {
      mainWindow.minimize();
      mainWindow.webContents.send('otg-log', '🛡️ [Boss Key Alt+X] ĐÃ TẮT MÀN HÌNH ĐIỆN THOẠI & ẨN CỬA SỔ! Bấm Alt+X lần nữa để mở lại.');
    }
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

    if (mainWindow) {
      mainWindow.restore();
      mainWindow.webContents.send('otg-log', '✨ [Boss Key Alt+X] Đã khôi phục màn hình và cửa sổ game!');
    }
  }
}

// XỬ LÝ PHÍM ALT+3: Chuyển đổi chuột 2 chiều qua lại
function switchMouseFocus() {
  if (!controlProcess) {
    if (mainWindow) {
      mainWindow.webContents.send('otg-log', '🔔 [Alt+3] Đang khởi động điều khiển...');
      mainWindow.webContents.send('request-start-control');
    }
    return;
  }

  const psScript = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class WinHelper {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
        public const byte VK_MENU = 0x12; // Alt key
        public const uint KEYEVENTF_KEYUP = 0x0002;
    }
"@
    $p = Get-Process -Name scrcpy -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p -and $p.MainWindowHandle -ne 0) {
        $hwnd = $p.MainWindowHandle
        $fg = [WinHelper]::GetForegroundWindow()

        if ($fg -eq $hwnd) {
            [WinHelper]::keybd_event([WinHelper]::VK_MENU, 0x38, 0, 0)
            Start-Sleep -Milliseconds 30
            [WinHelper]::keybd_event([WinHelper]::VK_MENU, 0x38, [WinHelper]::KEYEVENTF_KEYUP, 0)
            Write-Host "RELEASED_TO_PC"
        } else {
            [WinHelper]::SetForegroundWindow($hwnd)
            $rect = New-Object WinHelper+RECT
            [WinHelper]::GetWindowRect($hwnd, [ref]$rect)
            $x = [int](($rect.Left + $rect.Right) / 2)
            $y = [int](($rect.Top + $rect.Bottom) / 2)
            [WinHelper]::SetCursorPos($x, $y)
            Start-Sleep -Milliseconds 30
            [WinHelper]::mouse_event([WinHelper]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            [WinHelper]::mouse_event([WinHelper]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            Write-Host "CAPTURED_TO_PHONE"
        }
    }
  `;

  exec(`powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`, (err, stdout) => {
    if (mainWindow) {
      if (stdout && stdout.includes('RELEASED_TO_PC')) {
        mainWindow.webContents.send('otg-log', '🔄 [Alt+3] Đã nhả chuột về MÁY TÍNH thành công!');
      } else {
        mainWindow.webContents.send('otg-log', '🎮 [Alt+3] Đã đưa chuột sang ĐIỆN THOẠI thành công!');
      }
    }
  });
}

// Bật / Tắt điều khiển bằng phím tắt
async function toggleControlState() {
  if (controlProcess) {
    stopActiveControl();
    if (mainWindow) {
      mainWindow.webContents.send('otg-log', '🔔 [Ctrl+Alt+K] Đã dừng điều khiển!');
      mainWindow.webContents.send('otg-status', { running: false, code: 0 });
    }
  } else {
    if (mainWindow) {
      mainWindow.webContents.send('request-start-control');
    }
  }
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

// Bắt đầu điều khiển
ipcMain.handle('start-control', async (event, options = {}) => {
  if (controlProcess) {
    stopActiveControl();
  }

  currentOptions = { ...currentOptions, ...options };
  const { deviceId, mirrorScreen, stayAwake, turnScreenOff, forwardAudio, fps, bitrate } = currentOptions;
  const args = [];

  if (deviceId) {
    args.push('-s', deviceId);
  }

  if (mirrorScreen) {
    args.push(`--video-bit-rate=${bitrate || '16M'}`);
    args.push(`--max-fps=${fps || 60}`);
    args.push('--window-title=APKRemote - Màn Hình Điện Thoại (Alt+X: An Nhanh | Alt+Z: Khoa May | Alt+3: Doi Chuot)');
    args.push('--always-on-top');
    if (turnScreenOff) args.push('--turn-screen-off');
    if (stayAwake) args.push('--stay-awake');
  } else {
    args.push('-K', '-M', '--no-video-playback');
    args.push('--window-width=320', '--window-height=120');
    args.push('--window-title=APKRemote - Vung Bat Chuot (Alt+Z: Khoa | Alt+3: Doi Chuot)');
    if (stayAwake) args.push('--stay-awake');
  }

  if (!forwardAudio) {
    args.push('--no-audio');
  }

  try {
    controlProcess = spawn(scrcpyPath, args, {
      cwd: binDir,
      windowsHide: false
    });

    controlProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (mainWindow) mainWindow.webContents.send('otg-log', msg);
    });

    controlProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (mainWindow) mainWindow.webContents.send('otg-log', msg);
    });

    controlProcess.on('close', (code) => {
      controlProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('otg-status', { running: false, code });
      }
    });

    const modeName = mirrorScreen ? 'Chiếu màn hình PC (Tương tác như màn hình máy tính)' : 'Vùng Bắt Chuột Trực Tiếp (0ms lag, không video)';
    return {
      success: true,
      message: `Đã kích hoạt [${modeName}]! Bấm Alt+Z để Khóa Màn Hình Nhanh, Alt+X để Ẩn Gấp, Alt+3 để Đổi Chuột.`
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
