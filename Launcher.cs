using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Net;
using System.IO.Compression;

namespace PandakeyLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string localElectron = Path.Combine(baseDir, "node_modules", "electron", "dist", "electron.exe");
                string localMainJs = Path.Combine(baseDir, "main.js");

                // TH1: Dang o trong thu muc du an da co Electron
                if (File.Exists(localElectron) && File.Exists(localMainJs))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = localElectron;
                    psi.Arguments = "\"" + baseDir + "\"";
                    psi.WorkingDirectory = baseDir;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    Process.Start(psi);
                    return;
                }

                // TH2: Chay o may dich chua co ma nguon - Dong bo tu dong vao %LOCALAPPDATA%\Pandakeyauto
                string appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Pandakeyauto");
                string targetElectron = Path.Combine(appDataDir, "node_modules", "electron", "dist", "electron.exe");
                string targetMainJs = Path.Combine(appDataDir, "main.js");

                if (!Directory.Exists(appDataDir))
                {
                    Directory.CreateDirectory(appDataDir);
                }

                // Neu chua co code hoac chua co Electron, goi bo khoi chay tu dong run.ps1
                if (!File.Exists(targetElectron) || !File.Exists(targetMainJs))
                {
                    DialogResult dr = MessageBox.Show(
                        "Chao ban! Pandakeyauto Pro VIP se tu dong thiet lap ban moi nhat tu GitHub ve may cua ban trong giay lat.\n\nBam OK de bat dau khoi chay.",
                        "Pandakeyauto Pro VIP",
                        MessageBoxButtons.OKCancel,
                        MessageBoxIcon.Information
                    );

                    if (dr != DialogResult.OK) return;

                    string psCommand = "irm https://raw.githubusercontent.com/3122380192/Pandakeyauto/master/run.ps1 | iex";
                    ProcessStartInfo psiPs = new ProcessStartInfo();
                    psiPs.FileName = "powershell.exe";
                    psiPs.Arguments = "-ExecutionPolicy Bypass -NoProfile -Command \"" + psCommand + "\"";
                    psiPs.UseShellExecute = false;
                    psiPs.CreateNoWindow = false;
                    Process p = Process.Start(psiPs);
                    return;
                }

                // Neu da co san o appDataDir, mo luon
                ProcessStartInfo psiApp = new ProcessStartInfo();
                psiApp.FileName = targetElectron;
                psiApp.Arguments = "\"" + appDataDir + "\"";
                psiApp.WorkingDirectory = appDataDir;
                psiApp.UseShellExecute = false;
                psiApp.CreateNoWindow = true;
                Process.Start(psiApp);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Loi khoi dong: " + ex.Message, "Pandakeyauto Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
