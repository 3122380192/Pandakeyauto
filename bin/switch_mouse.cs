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
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    // Win32 Low-Level Keyboard Hook
    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

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

    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

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

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x80000;
    public const int WS_EX_TOOLWINDOW = 0x0080;
    public const uint LWA_ALPHA = 0x02;

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

    public static IntPtr GetScrcpyWindow() {
        IntPtr scrcpyHwnd = IntPtr.Zero;

        // 1. Tìm trực tiếp cửa sổ SDL_app của Scrcpy
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
            // 1. Giải phóng cursor capture
            ReleaseCapture();
            ClipCursor(IntPtr.Zero);

            // 2. Gửi tín hiệu ungrab cho Scrcpy (RCtrl + Alt)
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY, 0);
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
            keybd_event(VK_MENU, 0x38, 0, 0);
            keybd_event(VK_MENU, 0x38, KEYEVENTF_KEYUP, 0);

            // 3. Chuyển focus về cửa sổ PC trước đó (hoặc Desktop)
            if (lastPcWindow != IntPtr.Zero && IsWindow(lastPcWindow) && lastPcWindow != scrcpyHwnd) {
                SetForegroundWindow(lastPcWindow);
            } else {
                SetForegroundWindow(GetDesktopWindow());
            }

            // 4. Đưa con trỏ chuột về vị trí trên PC
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

            // 2. Kiểm tra nếu là cửa sổ ẩn không video -> đảm bảo trong suốt và không hiện taskbar
            RECT rect;
            GetWindowRect(scrcpyHwnd, out rect);
            bool isHiddenWindow = (rect.Right - rect.Left <= 10 && rect.Bottom - rect.Top <= 10);
            if (isHiddenWindow) {
                int ex = GetWindowLong(scrcpyHwnd, GWL_EXSTYLE);
                if ((ex & WS_EX_LAYERED) == 0) {
                    SetWindowLong(scrcpyHwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED | WS_EX_TOOLWINDOW);
                    SetLayeredWindowAttributes(scrcpyHwnd, 0, 1, LWA_ALPHA);
                }
            }

            // 3. Kích hoạt và đưa chuột vào cửa sổ Scrcpy
            ShowWindow(scrcpyHwnd, SW_RESTORE);
            SetForegroundWindow(scrcpyHwnd);

            int targetX = (rect.Left + rect.Right) / 2;
            int targetY = (rect.Top + rect.Bottom) / 2;
            SetCursorPos(targetX, targetY);

            // Bắt chuột vào Scrcpy
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);

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

    private static LowLevelKeyboardProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;

    private static bool altPressed = false;
    private static bool comboDetected = false;
    private static bool altTriggeredOnDown = false;
    private static DateTime altPressTime = DateTime.MinValue;

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);
            int msg = wParam.ToInt32();

            bool isAltKey = (vkCode == VK_MENU || vkCode == VK_LMENU || vkCode == VK_RMENU);

            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                if (isAltKey) {
                    IntPtr scrcpyHwnd = GetScrcpyWindow();
                    if (scrcpyHwnd != IntPtr.Zero) {
                        IntPtr fg = GetForegroundWindow();
                        bool isInsidePhone = (fg == scrcpyHwnd) || (ReadState() == "phone");

                        // ⭐ ĐANG TRONG ĐIỆN THOẠI: Phản hồi 0ms siêu tốc ngay khi vừa chạm phím Alt!
                        if (isInsidePhone) {
                            ReleaseToPc(scrcpyHwnd);
                            altTriggeredOnDown = true;
                            altPressed = true;
                            return (IntPtr)1; // Chặn phím Alt lọt vào game / menu
                        }
                    }

                    if (!altPressed) {
                        altPressed = true;
                        comboDetected = false;
                        altTriggeredOnDown = false;
                        altPressTime = DateTime.UtcNow;
                    }
                } else if (altPressed) {
                    // Nếu bấm phím khác khi đang giữ Alt (VD: Alt+Tab, Alt+Left/Right, Alt+X, Alt+Z)
                    comboDetected = true;
                }
            } else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                if (isAltKey) {
                    if (altTriggeredOnDown) {
                        altTriggeredOnDown = false;
                        altPressed = false;
                        comboDetected = false;
                        return (IntPtr)1; // Chặn phím Alt nhả
                    }

                    if (altPressed && !comboDetected) {
                        double ms = (DateTime.UtcNow - altPressTime).TotalMilliseconds;
                        // Trên PC: bấm nhả Alt nhanh (< 600ms) để vào điện thoại
                        if (ms < 600) {
                            IntPtr scrcpyHwnd = GetScrcpyWindow();
                            if (scrcpyHwnd != IntPtr.Zero) {
                                CaptureToPhone(scrcpyHwnd);
                                altPressed = false;
                                comboDetected = false;
                                return (IntPtr)1; // Chặn mở menu Windows
                            }
                        }
                    }
                    altPressed = false;
                    comboDetected = false;
                }
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    public static void Main(string[] args) {
        if (args != null && args.Length > 0 && (args[0] == "--watch" || args[0] == "--hook")) {
            _hookID = SetHook(_proc);
            Console.WriteLine("ALT_HOOK_READY");
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
            UnhookWindowsHookEx(_hookID);
        } else {
            Toggle();
        }
    }
}
