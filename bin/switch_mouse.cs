using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class SwitchMouse {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(IntPtr lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(ref RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref int pvParam, uint fWinIni);

    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);

    public const uint SPI_GETMOUSESPEED = 0x0070;
    public const uint SPI_SETMOUSESPEED = 0x0071;

    private static int originalPcMouseSpeed = -1;
    private static bool isSpeedReduced = false;

    private static string GetSpeedConfigPath() {
        return Path.Combine(Path.GetTempPath(), "pandakey_mouse_speed.txt");
    }

    private static int GetTargetPhoneSpeed() {
        try {
            string file = GetSpeedConfigPath();
            if (File.Exists(file)) {
                string text = File.ReadAllText(file).Trim();
                if (text == "native" || text == "none" || text == "1.0" || text == "100%") {
                    return -1; // Giữ nguyên tốc độ gốc của Tab Bảng Đen
                }
                int val;
                if (int.TryParse(text, out val)) {
                    if (val >= 1 && val <= 20) return val;
                }
                double dval;
                if (double.TryParse(text, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out dval)) {
                    if (dval >= 0.95) return -1;
                    if (dval <= 0.18) return 1;
                    if (dval <= 0.28) return 2;
                    if (dval <= 0.38) return 2;
                    if (dval <= 0.55) return 3;
                    if (dval <= 0.80) return 4;
                    return -1;
                }
            }
        } catch {}
        return -1;
    }

    public static void ApplyPhoneMouseSpeed() {
        try {
            int target = GetTargetPhoneSpeed();
            if (target <= 0) return;

            int curSpeed = 0;
            if (SystemParametersInfo(SPI_GETMOUSESPEED, 0, ref curSpeed, 0)) {
                if (!isSpeedReduced && curSpeed >= 1 && curSpeed <= 20) {
                    originalPcMouseSpeed = curSpeed;
                }
            }
            SystemParametersInfo(SPI_SETMOUSESPEED, 0, (IntPtr)target, 0);
            isSpeedReduced = true;
        } catch {}
    }

    public static void RestorePcMouseSpeed() {
        try {
            if (isSpeedReduced && originalPcMouseSpeed >= 1 && originalPcMouseSpeed <= 20) {
                SystemParametersInfo(SPI_SETMOUSESPEED, 0, (IntPtr)originalPcMouseSpeed, 0);
                isSpeedReduced = false;
            }
        } catch {}
    }

    // Win32 Low-Level Keyboard & Mouse Hooks
    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    public static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public const int WH_KEYBOARD_LL = 13;
    public const int WH_MOUSE_LL = 14;

    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

    public const int WM_MOUSEMOVE = 0x0200;
    public const int WM_LBUTTONDOWN = 0x0201;
    public const int WM_LBUTTONUP = 0x0202;
    public const int WM_RBUTTONDOWN = 0x0204;
    public const int WM_RBUTTONUP = 0x0205;
    public const int WM_MBUTTONDOWN = 0x0207;
    public const int WM_MBUTTONUP = 0x0208;
    public const int WM_XBUTTONDOWN = 0x020B;
    public const int WM_XBUTTONUP = 0x020C;

    public const byte VK_MENU = 0x12;      // Alt
    public const byte VK_LMENU = 0xA4;     // Left Alt
    public const byte VK_RMENU = 0xA5;     // Right Alt
    public const byte VK_RCONTROL = 0xA3;  // Right Ctrl
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    public const int SW_RESTORE = 9;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

    private static int savedPcX = -1;
    private static int savedPcY = -1;
    private static IntPtr lastPcWindow = IntPtr.Zero;

    private static string GetStateFilePath() {
        return Path.Combine(Path.GetTempPath(), "pandakey_mouse_state.txt");
    }

    private static string ReadState() {
        try {
            string file = GetStateFilePath();
            if (File.Exists(file)) {
                return File.ReadAllText(file).Trim().ToLowerInvariant();
            }
        } catch {}
        return "pc";
    }

    private static void SaveState(string state) {
        try {
            File.WriteAllText(GetStateFilePath(), state);
        } catch {}
    }

    // Đọc phím/nút chuyển đổi cấu hình (Mặc định là Alt)
    private static int GetConfiguredSwitchVk() {
        try {
            string file = Path.Combine(Path.GetTempPath(), "pandakey_switch_key.txt");
            if (File.Exists(file)) {
                string key = File.ReadAllText(file).Trim().ToLowerInvariant();
                if (key == "alt" || key == "lalt" || key == "ralt") return 0x12;
                if (key == "tilde" || key == "`" || key == "~") return 0xC0; // VK_OEM_3
                if (key == "caps" || key == "capslock") return 0x14; // VK_CAPITAL
                if (key == "ctrl" || key == "lctrl" || key == "rctrl") return 0x11; // VK_CONTROL
                if (key == "tab") return 0x09; // VK_TAB
                if (key == "space") return 0x20; // VK_SPACE
                if (key == "f1") return 0x70;
                if (key == "f2") return 0x71;
                if (key == "f3") return 0x72;
                if (key == "f4") return 0x73;
                if (key == "f5") return 0x74;
                if (key == "f6") return 0x75;
                if (key == "f7") return 0x76;
                if (key == "f8") return 0x77;
                if (key == "f9") return 0x78;
                if (key == "f10") return 0x79;
                if (key == "f11") return 0x7A;
                if (key == "f12") return 0x7B;
                // Chuột: Giữa, Hông 1, Hông 2
                if (key == "mbutton" || key == "middle" || key == "wheel") return 0x04; // VK_MBUTTON
                if (key == "xbutton1" || key == "mouse4") return 0x05; // VK_XBUTTON1
                if (key == "xbutton2" || key == "mouse5") return 0x06; // VK_XBUTTON2
                int parsed;
                if (int.TryParse(key, out parsed)) return parsed;
            }
        } catch {}
        return 0x12; // Mặc định là VK_MENU (Alt)
    }

    private static bool IsConfiguredSwitchKey(int vkCode) {
        int targetVk = GetConfiguredSwitchVk();
        if (targetVk == 0x12) {
            return (vkCode == 0x12 || vkCode == 0xA4 || vkCode == 0xA5); // Alt, LAlt, RAlt
        }
        if (targetVk == 0x11) {
            return (vkCode == 0x11 || vkCode == 0xA2 || vkCode == 0xA3); // Ctrl, LCtrl, RCtrl
        }
        return (vkCode == targetVk);
    }

    public static IntPtr GetScrcpyWindow() {
        IntPtr scrcpyHwnd = IntPtr.Zero;

        // Tìm cửa sổ SDL_app của Scrcpy
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            StringBuilder cls = new StringBuilder(256);
            GetClassName(hWnd, cls, 256);
            if (cls.ToString() == "SDL_app") {
                scrcpyHwnd = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (scrcpyHwnd == IntPtr.Zero) {
            scrcpyHwnd = FindWindow("SDL_app", null);
        }

        if (scrcpyHwnd == IntPtr.Zero) {
            Process[] procs = Process.GetProcessesByName("scrcpy");
            if (procs != null && procs.Length > 0) {
                foreach (Process p in procs) {
                    if (p.MainWindowHandle != IntPtr.Zero) {
                        scrcpyHwnd = p.MainWindowHandle;
                        break;
                    }
                }
            }
        }

        return scrcpyHwnd;
    }

    public static void ReleaseToPc(IntPtr scrcpyHwnd) {
        try {
            // 1. Tháo khóa chuột
            ReleaseCapture();
            ClipCursor(IntPtr.Zero);

            // 2. Gửi tín hiệu ungrab cho Scrcpy
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY, 0);
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
            keybd_event(VK_MENU, 0x38, 0, 0);
            keybd_event(VK_MENU, 0x38, KEYEVENTF_KEYUP, 0);

            // 3. Khôi phục focus máy tính
            if (lastPcWindow != IntPtr.Zero && IsWindow(lastPcWindow) && lastPcWindow != scrcpyHwnd) {
                SetForegroundWindow(lastPcWindow);
            } else {
                SetForegroundWindow(GetDesktopWindow());
            }

            // 4. Trả con trỏ chuột về vị trí máy tính
            int screenW = GetSystemMetrics(SM_CXSCREEN);
            int screenH = GetSystemMetrics(SM_CYSCREEN);

            RECT rect;
            GetWindowRect(scrcpyHwnd, out rect);

            int targetX = savedPcX;
            int targetY = savedPcY;

            bool isHiddenWindow = (rect.Right - rect.Left <= 10 && rect.Bottom - rect.Top <= 10);
            if (targetX < 0 || targetY < 0 || (!isHiddenWindow && targetX >= rect.Left && targetX <= rect.Right && targetY >= rect.Top && targetY <= rect.Bottom)) {
                if (isHiddenWindow) {
                    targetX = screenW / 2;
                    targetY = screenH / 2;
                } else {
                    targetX = rect.Right + 120;
                    targetY = rect.Top + 100;
                    if (targetX >= screenW - 30) targetX = Math.Max(30, rect.Left - 120);
                    if (targetY >= screenH - 30) targetY = Math.Max(30, rect.Top - 100);
                }
            }

            SetCursorPos(targetX, targetY);

            // 5. Khôi phục tốc độ chuột gốc của PC
            RestorePcMouseSpeed();

            SaveState("pc");
            Console.WriteLine("RELEASED_TO_PC");
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    public static void CaptureToPhone(IntPtr scrcpyHwnd) {
        try {
            // 1. Lưu lại cửa sổ và tọa độ chuột PC hiện tại
            IntPtr fg = GetForegroundWindow();
            if (fg != scrcpyHwnd) {
                lastPcWindow = fg;
            }

            POINT pt;
            if (GetCursorPos(out pt)) {
                savedPcX = pt.X;
                savedPcY = pt.Y;
            }

            // 2. Áp dụng cấu hình tốc độ chuột nếu có
            ApplyPhoneMouseSpeed();

            // 3. Kích hoạt và đưa chuột vào trung tâm cửa sổ Tab Bảng Đen
            ShowWindow(scrcpyHwnd, SW_RESTORE);
            SetForegroundWindow(scrcpyHwnd);

            RECT rect;
            GetWindowRect(scrcpyHwnd, out rect);
            int targetX = (rect.Left + rect.Right) / 2;
            int targetY = (rect.Top + rect.Bottom) / 2;
            SetCursorPos(targetX, targetY);

            // 4. Click kích hoạt bắt chuột vào Scrcpy
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);

            // 5. ⭐ KHÓA CHẶT CHUỘT TRONG CỬA SỔ SCRCPY - TUYỆT ĐỐI KHÔNG CHO VĂNG RA MÁY TÍNH
            ClipCursor(ref rect);

            SaveState("phone");
            Console.WriteLine("CAPTURED_TO_PHONE");
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    public static void Toggle() {
        IntPtr scrcpyHwnd = GetScrcpyWindow();
        if (scrcpyHwnd == IntPtr.Zero) {
            SaveState("pc");
            Console.WriteLine("SCRCPY_NOT_RUNNING");
            return;
        }

        IntPtr fg = GetForegroundWindow();
        string state = ReadState();

        bool isInsidePhone = (fg == scrcpyHwnd) || (state == "phone");

        if (isInsidePhone) {
            ReleaseToPc(scrcpyHwnd);
        } else {
            CaptureToPhone(scrcpyHwnd);
        }
    }

    private static LowLevelKeyboardProc _kbProc = KeyboardHookCallback;
    private static LowLevelMouseProc _mouseProc = MouseHookCallback;
    private static IntPtr _kbHookID = IntPtr.Zero;
    private static IntPtr _mouseHookID = IntPtr.Zero;

    private static bool switchKeyPressed = false;
    private static bool comboDetected = false;
    private static DateTime switchKeyPressTime = DateTime.MinValue;

    private static IntPtr SetKeyboardHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr SetMouseHook(LowLevelMouseProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);
            int msg = wParam.ToInt32();

            IntPtr scrcpyHwnd = GetScrcpyWindow();
            bool isInsidePhone = false;
            if (scrcpyHwnd != IntPtr.Zero) {
                IntPtr fg = GetForegroundWindow();
                isInsidePhone = (fg == scrcpyHwnd) || (ReadState() == "phone");
            }

            bool isSwitchKey = IsConfiguredSwitchKey(vkCode);

            // ⭐ KHI ĐANG Ở TRONG ĐIỆN THOẠI:
            // TẤT CẢ PHÍM VÀ CLICK KHÔNG LIÊN QUAN ĐẾN MÁY TÍNH
            // CHỈ PHÍM ĐƯỢC CÀI ĐẶT CHUYỂN ĐỔI MỚI HOẠT ĐỘNG ĐỂ QUAY VỀ MÁY TÍNH!
            if (isInsidePhone && scrcpyHwnd != IntPtr.Zero) {
                // 1. Phím chuyển đổi (Mặc định Alt): Phím DUY NHẤT để thoát về máy tính
                if (isSwitchKey) {
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                        ReleaseToPc(scrcpyHwnd);
                        switchKeyPressed = true;
                        return (IntPtr)1; // Chặn phím không lọt vào Windows/game
                    }
                    if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                        switchKeyPressed = false;
                        return (IntPtr)1;
                    }
                }

                // 2. Chặn hoàn toàn phím Windows (Start Menu) không làm phiền máy tính
                if (vkCode == 0x5B || vkCode == 0x5C) {
                    return (IntPtr)1; // Start Menu PC không thể bật lên!
                }

                // 3. Đảm bảo Scrcpy luôn giữ Focus và chuột luôn bị khóa chặt
                IntPtr currentFg = GetForegroundWindow();
                if (currentFg != scrcpyHwnd) {
                    SetForegroundWindow(scrcpyHwnd);
                    RECT r;
                    GetWindowRect(scrcpyHwnd, out r);
                    ClipCursor(ref r);
                }

                // Tất cả các phím khác (W, A, S, D, Space, 1-9, F1-F12...) được chuyển 100% thẳng vào điện thoại!
                return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
            } else {
                // ⭐ KHI ĐANG Ở TRÊN MÁY TÍNH (PC MODE):
                // Bấm phím chuyển đổi để đưa chuột + phím vào điện thoại
                if (isSwitchKey) {
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                        if (!switchKeyPressed) {
                            switchKeyPressed = true;
                            comboDetected = false;
                            switchKeyPressTime = DateTime.UtcNow;
                        }
                    } else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                        if (switchKeyPressed && !comboDetected) {
                            double ms = (DateTime.UtcNow - switchKeyPressTime).TotalMilliseconds;
                            if (ms < 600) {
                                if (scrcpyHwnd != IntPtr.Zero) {
                                    CaptureToPhone(scrcpyHwnd);
                                    switchKeyPressed = false;
                                    comboDetected = false;
                                    return (IntPtr)1; // Chặn mở menu Windows
                                }
                            }
                        }
                        switchKeyPressed = false;
                        comboDetected = false;
                    }
                } else if (switchKeyPressed) {
                    comboDetected = true;
                }
            }
        }
        return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
    }

    // ⭐ LOW-LEVEL MOUSE HOOK: HỖ TRỢ ĐỔI CHUỘT BẰNG CHUỘT GIỮA/HÔNG & CHẶN CLICK LỌT RA MÁY TÍNH
    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            IntPtr scrcpyHwnd = GetScrcpyWindow();
            int msg = wParam.ToInt32();

            // ⭐ HỖ TRỢ CHUYỂN CHUỘT BẰNG NÚT CHUỘT (Chuột giữa, Chuột hông 4, 5)
            int targetVk = GetConfiguredSwitchVk();
            if (targetVk == 0x04 || targetVk == 0x05 || targetVk == 0x06) {
                bool isTargetDown = false;
                bool isTargetUp = false;

                if (targetVk == 0x04) {
                    isTargetDown = (msg == WM_MBUTTONDOWN);
                    isTargetUp = (msg == WM_MBUTTONUP);
                } else {
                    MSLLHOOKSTRUCT hs = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                    int xbtn = (int)((hs.mouseData >> 16) & 0xffff);
                    if ((targetVk == 0x05 && xbtn == 1) || (targetVk == 0x06 && xbtn == 2)) {
                        isTargetDown = (msg == WM_XBUTTONDOWN);
                        isTargetUp = (msg == WM_XBUTTONUP);
                    }
                }

                if (isTargetDown) {
                    if (scrcpyHwnd != IntPtr.Zero) {
                        Toggle();
                    }
                    return (IntPtr)1; // Chặn click không lọt vào hệ thống
                } else if (isTargetUp) {
                    return (IntPtr)1; // Chặn nhả click
                }
            }

            bool isInsidePhone = false;
            if (scrcpyHwnd != IntPtr.Zero) {
                IntPtr fg = GetForegroundWindow();
                isInsidePhone = (fg == scrcpyHwnd) || (ReadState() == "phone");
            }

            if (isInsidePhone && scrcpyHwnd != IntPtr.Zero) {
                RECT rect;
                GetWindowRect(scrcpyHwnd, out rect);

                MSLLHOOKSTRUCT hookStruct = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                POINT pt = hookStruct.pt;
                bool isOutside = (pt.X < rect.Left || pt.X > rect.Right || pt.Y < rect.Top || pt.Y > rect.Bottom);

                bool isButtonDown = (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN || msg == WM_XBUTTONDOWN);

                // Nếu chuột bị lệch ra ngoài hoặc mất focus: lập tức kéo về tab và khóa chặt lại!
                if (isOutside || GetForegroundWindow() != scrcpyHwnd) {
                    SetForegroundWindow(scrcpyHwnd);
                    ClipCursor(ref rect);
                    int midX = (rect.Left + rect.Right) / 2;
                    int midY = (rect.Top + rect.Bottom) / 2;
                    SetCursorPos(midX, midY);

                    // CHẶN HOÀN TOÀN CLICK: Không cho click bất kỳ phần tử nào trên PC!
                    if (isButtonDown) {
                        return (IntPtr)1;
                    }
                }
            }
        }
        return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
    }

    public static void Main(string[] args) {
        AppDomain.CurrentDomain.ProcessExit += delegate {
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
        };

        if (args != null && args.Length > 0 && (args[0] == "--watch" || args[0] == "--hook")) {
            _kbHookID = SetKeyboardHook(_kbProc);
            _mouseHookID = SetMouseHook(_mouseProc);
            Console.WriteLine("ALT_HOOK_READY");
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
            UnhookWindowsHookEx(_kbHookID);
            UnhookWindowsHookEx(_mouseHookID);
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
        } else if (args != null && args.Length > 0 && args[0] == "--restore") {
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
            Console.WriteLine("PC_SPEED_RESTORED");
        } else {
            Toggle();
        }
    }
}
