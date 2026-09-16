using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class RecoilAssist {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    private const int VK_LBUTTON = 0x01;
    private const uint MOUSEEVENTF_MOVE = 0x0001;

    public static void Main(string[] args) {
        // Tham số: pullY (px), jitterX (px), delayMs (ms), intervalMs (ms)
        int pullY = 4;
        int jitterX = 1;
        int delayMs = 120;
        int intervalMs = 25;

        if (args.Length >= 1) int.TryParse(args[0], out pullY);
        if (args.Length >= 2) int.TryParse(args[1], out jitterX);
        if (args.Length >= 3) int.TryParse(args[2], out delayMs);
        if (args.Length >= 4) int.TryParse(args[3], out intervalMs);

        Console.WriteLine("RECOIL_ASSIST_STARTED");
        Console.Out.Flush();

        Random rnd = new Random();
        Stopwatch sw = new Stopwatch();
        bool wasDown = false;

        while (true) {
            short state = GetAsyncKeyState(VK_LBUTTON);
            bool isDown = (state & 0x8000) != 0;

            if (isDown) {
                if (!wasDown) {
                    wasDown = true;
                    sw.Restart();
                } else {
                    if (sw.ElapsedMilliseconds >= delayMs) {
                        int jx = 0;
                        if (jitterX > 0) {
                            jx = rnd.Next(-jitterX, jitterX + 1);
                        }
                        mouse_event(MOUSEEVENTF_MOVE, (uint)jx, (uint)pullY, 0, 0);
                    }
                }
            } else {
                wasDown = false;
                sw.Reset();
            }

            Thread.Sleep(Math.Max(10, intervalMs));
        }
    }
}
