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

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public const byte VK_MENU = 0x12; // Alt
    public const byte VK_RCONTROL = 0xA3; // Right Ctrl
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

    public static void Main(string[] args) {
        try {
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
}
