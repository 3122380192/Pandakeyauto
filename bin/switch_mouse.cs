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
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

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
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const int SW_RESTORE = 9;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

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

    public static void Toggle() {
        try {
            IntPtr scrcpyHwnd = GetScrcpyWindow();

            if (scrcpyHwnd == IntPtr.Zero) {
                SaveState("pc");
                Console.WriteLine("SCRCPY_NOT_RUNNING");
                return;
            }

            string currentState = ReadState();
            RECT rect;
            GetWindowRect(scrcpyHwnd, out rect);

            if (currentState == "phone") {
                // Đang ở chế độ Phone -> Chuyển sang PC (Nhả chuột về máy tính)
                keybd_event(VK_MENU, 0x38, 0, 0);
                keybd_event(VK_MENU, 0x38, KEYEVENTF_KEYUP, 0);
                keybd_event(VK_RCONTROL, 0x1D, 0, 0);
                keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_KEYUP, 0);

                int screenW = GetSystemMetrics(SM_CXSCREEN);
                int screenH = GetSystemMetrics(SM_CYSCREEN);

                int targetX = rect.Right + 120;
                int targetY = rect.Top + 100;
                if (targetX >= screenW - 30) {
                    targetX = Math.Max(30, rect.Left - 120);
                }
                if (targetY >= screenH - 30) {
                    targetY = Math.Max(30, rect.Top - 100);
                }
                SetCursorPos(targetX, targetY);

                SaveState("pc");
                Console.WriteLine("RELEASED_TO_PC");
            } else {
                // Đang ở chế độ PC -> Chuyển sang Phone (Đưa chuột vào game)
                ShowWindow(scrcpyHwnd, SW_RESTORE);
                SetForegroundWindow(scrcpyHwnd);

                int centerX = (rect.Left + rect.Right) / 2;
                int centerY = (rect.Top + rect.Bottom) / 2;
                SetCursorPos(centerX, centerY);

                SaveState("phone");
                Console.WriteLine("CAPTURED_TO_PHONE");
            }
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    private static LowLevelKeyboardProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;

    private static bool altPressed = false;
    private static bool comboDetected = false;
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
                    if (!altPressed) {
                        altPressed = true;
                        comboDetected = false;
                        altPressTime = DateTime.UtcNow;
                    }
                } else if (altPressed) {
                    // Nếu nhấn phím khác khi đang giữ Alt (VD: Alt+Tab, Alt+F4, Alt+Left/Right)
                    comboDetected = true;
                }
            } else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                if (isAltKey) {
                    if (altPressed && !comboDetected) {
                        double ms = (DateTime.UtcNow - altPressTime).TotalMilliseconds;
                        // Chỉ chuyển chuột khi nhấp nhả phím Alt đơn thuần (< 800ms)
                        if (ms < 800) {
                            if (GetScrcpyWindow() != IntPtr.Zero) {
                                Toggle();
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
            // Chế độ chạy ngầm lắng nghe phím Alt toàn cục
            _hookID = SetHook(_proc);
            Console.WriteLine("ALT_HOOK_READY");
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
            UnhookWindowsHookEx(_hookID);
        } else {
            // Chế độ kích hoạt 1 lần (dành cho F1, Alt+3 hoặc gọi thủ công)
            Toggle();
        }
    }
}
