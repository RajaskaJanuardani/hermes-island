param(
    [string]$Action = "status",
    [string]$Value = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

# Win32 Media Keys + CoreAudio Volume + WMI Brightness + Native OSD Suppressor + Stdin Queue
Add-Type -ReferencedAssemblies "System.Management" -TypeDefinition @"
using System;
using System.IO;
using System.Text;
using System.Collections.Concurrent;
using System.Management;
using System.Runtime.InteropServices;
using System.Threading;
using System.Diagnostics;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    int GetChannelCount(out int pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    int GetMute(out bool pbMute);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

public class MediaKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string cls, string title);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ScreenToClient(IntPtr hWnd, ref POINT lpPoint);

    public static void PostClickScreen(IntPtr renderHwnd, int sx, int sy) {
        POINT pt = new POINT(); pt.X = sx; pt.Y = sy;
        ScreenToClient(renderHwnd, ref pt);
        IntPtr lp = (IntPtr)((pt.Y << 16) | (pt.X & 0xFFFF));
        PostMessage(renderHwnd, 0x0200, IntPtr.Zero, lp);
        PostMessage(renderHwnd, 0x0201, (IntPtr)1, lp);
        PostMessage(renderHwnd, 0x0202, IntPtr.Zero, lp);
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

    public delegate bool EnumWinProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWinProc lpEnumFunc, IntPtr lParam);

    public static IntPtr FindWhatsAppMainTopHwnd() {
        IntPtr wh = IntPtr.Zero;
        while ((wh = FindWindowEx(IntPtr.Zero, wh, "WinUIDesktopWin32WindowClass", null)) != IntPtr.Zero) {
            if (wh == LastWhatsAppCallHwnd) continue;
            StringBuilder sb = new StringBuilder(160);
            GetWindowText(wh, sb, 160);
            string t = sb.ToString().Trim();
            if (t.Equals("WhatsApp", StringComparison.OrdinalIgnoreCase) || t.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0) {
                return wh;
            }
        }
        return IntPtr.Zero;
    }

    public static void WakeRenderWidget(IntPtr renderHwnd) {
        if (renderHwnd == IntPtr.Zero) return;
        IntPtr res;
        SendMessageTimeout(renderHwnd, 0x003D, IntPtr.Zero, (IntPtr)(-4), 2, 250, out res);
    }

    public static void WakeAllRenderWidgets(IntPtr parentHwnd) {
        if (parentHwnd != IntPtr.Zero) {
            EnumChildWindows(parentHwnd, (ch, l) => {
                StringBuilder csb = new StringBuilder(128);
                GetClassName(ch, csb, 128);
                if (csb.ToString().IndexOf("Chrome_RenderWidgetHostHWND", StringComparison.OrdinalIgnoreCase) >= 0) {
                    WakeRenderWidget(ch);
                }
                return true;
            }, IntPtr.Zero);
        }
        IntPtr cw = IntPtr.Zero;
        while ((cw = FindWindowEx(IntPtr.Zero, cw, "Chrome_WidgetWin_1", null)) != IntPtr.Zero) {
            EnumChildWindows(cw, (ch, l) => {
                StringBuilder csb = new StringBuilder(128);
                GetClassName(ch, csb, 128);
                if (csb.ToString().IndexOf("Chrome_RenderWidgetHostHWND", StringComparison.OrdinalIgnoreCase) >= 0) {
                    WakeRenderWidget(ch);
                }
                return true;
            }, IntPtr.Zero);
        }
    }

    public static bool FindWhatsAppWebView(out IntPtr chromeHwnd, out IntPtr renderHwnd) {
        chromeHwnd = IntPtr.Zero;
        renderHwnd = IntPtr.Zero;
        IntPtr cw = IntPtr.Zero;
        while ((cw = FindWindowEx(IntPtr.Zero, cw, "Chrome_WidgetWin_1", null)) != IntPtr.Zero) {
            StringBuilder tsb = new StringBuilder(256);
            GetWindowText(cw, tsb, 256);
            string title = tsb.ToString();
            if (title.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0) {
                IntPtr foundRender = IntPtr.Zero;
                EnumChildWindows(cw, (ch, l) => {
                    StringBuilder csb = new StringBuilder(128);
                    GetClassName(ch, csb, 128);
                    if (csb.ToString().IndexOf("Chrome_RenderWidgetHostHWND", StringComparison.OrdinalIgnoreCase) >= 0) {
                        foundRender = ch;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
                if (foundRender != IntPtr.Zero) {
                    chromeHwnd = cw;
                    renderHwnd = foundRender;
                    WakeRenderWidget(renderHwnd);
                    return true;
                }
            }
        }
        IntPtr ww = IntPtr.Zero;
        while ((ww = FindWindowEx(IntPtr.Zero, ww, "WinUIDesktopWin32WindowClass", null)) != IntPtr.Zero) {
            StringBuilder tsb = new StringBuilder(256);
            GetWindowText(ww, tsb, 256);
            string title = tsb.ToString();
            if (title.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0) {
                IntPtr foundChrome = IntPtr.Zero;
                IntPtr foundRender = IntPtr.Zero;
                EnumChildWindows(ww, (ch, l) => {
                    StringBuilder csb = new StringBuilder(128);
                    GetClassName(ch, csb, 128);
                    string cn = csb.ToString();
                    if (foundChrome == IntPtr.Zero && cn.IndexOf("Chrome_WidgetWin_1", StringComparison.OrdinalIgnoreCase) >= 0) {
                        foundChrome = ch;
                    } else if (cn.IndexOf("Chrome_RenderWidgetHostHWND", StringComparison.OrdinalIgnoreCase) >= 0) {
                        foundRender = ch;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
                if (foundRender != IntPtr.Zero) {
                    chromeHwnd = foundChrome != IntPtr.Zero ? foundChrome : ww;
                    renderHwnd = foundRender;
                    WakeRenderWidget(renderHwnd);
                    return true;
                }
            }
        }
        return false;
    }

    [DllImport(@"C:\Program Files\Acer\Acer Device Management Framework\Color_API.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern bool DriverColorProfileInitial();

    [DllImport(@"C:\Program Files\Acer\Acer Device Management Framework\Color_API.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern bool SetMediaColorMode(int mode);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct RAMP {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Red;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Green;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Blue;
    }

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool SetDeviceGammaRamp(IntPtr hDC, ref RAMP lpRamp);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    public static bool SetUniversalGamma(double r, double g, double b, double exp) {
        try {
            IntPtr hdc = GetDC(IntPtr.Zero);
            if (hdc == IntPtr.Zero) return false;
            RAMP ramp = new RAMP();
            ramp.Red = new ushort[256];
            ramp.Green = new ushort[256];
            ramp.Blue = new ushort[256];
            for (int i = 0; i < 256; i++) {
                double norm = (double)i / 255.0;
                double curved = Math.Pow(norm, exp);
                int rv = (int)Math.Round(curved * r * 65535.0);
                int gv = (int)Math.Round(curved * g * 65535.0);
                int bv = (int)Math.Round(curved * b * 65535.0);
                if (rv < 0) rv = 0; if (rv > 65535) rv = 65535;
                if (gv < 0) gv = 0; if (gv > 65535) gv = 65535;
                if (bv < 0) bv = 0; if (bv > 65535) bv = 65535;
                ramp.Red[i] = (ushort)rv;
                ramp.Green[i] = (ushort)gv;
                ramp.Blue[i] = (ushort)bv;
            }
            bool ok = SetDeviceGammaRamp(hdc, ref ramp);
            ReleaseDC(IntPtr.Zero, hdc);
            return ok;
        } catch {
            return false;
        }
    }

    [DllImport("powrprof.dll", ExactSpelling = true)]
    public static extern uint PowerSetActiveOverlayScheme(Guid OverlaySchemeGuid);

    [DllImport("powrprof.dll", ExactSpelling = true)]
    public static extern uint PowerGetEffectiveOverlayScheme(out Guid EffectiveOverlaySchemeGuid);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [StructLayout(LayoutKind.Sequential)]
    public struct DWM_TIMING_INFO {
        public int cbSize;
        public long rateRefreshDenominator;
        public long rateRefreshNumerator;
        public long qpcRefreshPeriod;
        public long rateComposeDenominator;
        public long rateComposeNumerator;
        public long qpcVBlank;
        public long cRefresh;
        public long cDXRefresh;
        public long qpcCompose;
        public long cFrame;
        public int cDXPresent;
        public int cRefreshFrame;
        public int cFrameSubmitted;
        public int cDXPresentSubmitted;
        public int cFrameConfirmed;
        public int cDXPresentConfirmed;
        public int cRefreshConfirmed;
        public int cDXRefreshConfirmed;
        public long cFramesDXGLSubmitted;
        public long cFramesDXGLConfirmed;
        public int cFramesDropped;
        public int cFramesMissed;
        public int cFramesRefreshed;
        public int cFramesPresented;
        public int cFramesRepeated;
        public int cRefreshMissed;
        public int cRefreshScheduled;
        public long qpcCompositionWait;
        public int cFrameCompleted;
        public long qpcFrameComplete;
        public long cDXRefreshComplete;
        public int cFramesDisplayed;
        public int cFramesComplete;
        public int cFramesPending;
        public int cFramesAvailable;
        public int cFramesQueuedForPrerender;
    }

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetCompositionTimingInfo(IntPtr hwnd, ref DWM_TIMING_INFO timingInfo);

    private static DWM_TIMING_INFO _lastTimingInfo;
    private static DateTime _lastTimingTime = DateTime.MinValue;
    private static int _cachedFps = 60;

    public static int GetCurrentFps() {
        try {
            DWM_TIMING_INFO info = new DWM_TIMING_INFO();
            info.cbSize = Marshal.SizeOf(typeof(DWM_TIMING_INFO));
            int res = DwmGetCompositionTimingInfo(IntPtr.Zero, ref info);
            if (res != 0) return _cachedFps;

            DateTime now = DateTime.UtcNow;
            if (_lastTimingTime != DateTime.MinValue) {
                double elapsedSec = (now - _lastTimingTime).TotalSeconds;
                if (elapsedSec >= 0.35) {
                    long frameDiff = (long)info.cFramesPresented - (long)_lastTimingInfo.cFramesPresented;
                    if (frameDiff >= 0 && elapsedSec > 0) {
                        _cachedFps = Math.Max(1, Math.Min(360, (int)Math.Round((double)frameDiff / elapsedSec)));
                    }
                    _lastTimingInfo = info;
                    _lastTimingTime = now;
                }
            } else {
                _lastTimingInfo = info;
                _lastTimingTime = now;
            }
        } catch {}
        return _cachedFps;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool QueryFullProcessImageName(IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    public static bool IsProcessAlive(uint pid) {
        if (pid == 0) return false;
        IntPtr hProc = IntPtr.Zero;
        try {
            hProc = OpenProcess(0x1000, false, pid);
            if (hProc == IntPtr.Zero) return false;
            uint code = 0;
            if (GetExitCodeProcess(hProc, out code)) {
                return code == 259;
            }
            return false;
        } catch {
            return false;
        } finally {
            if (hProc != IntPtr.Zero) CloseHandle(hProc);
        }
    }

    public static bool GetActiveWindowGameStatus(out uint outPid, out string procName, out string procPath, out string winTitle, out string winClass, out bool isFullscreen) {
        outPid = 0;
        procName = "";
        procPath = "";
        winTitle = "";
        winClass = "";
        isFullscreen = false;
        try {
            IntPtr fg = GetForegroundWindow();
            if (fg == IntPtr.Zero || IsIconic(fg) || !IsWindowVisible(fg)) return false;

            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(fg, sbTitle, 256);
            winTitle = sbTitle.ToString().Trim();

            StringBuilder sbClass = new StringBuilder(128);
            GetClassName(fg, sbClass, 128);
            winClass = sbClass.ToString().Trim();

            uint pid = 0;
            GetWindowThreadProcessId(fg, out pid);
            if (pid == 0) return false;
            outPid = pid;

            IntPtr hProc = IntPtr.Zero;
            try {
                hProc = OpenProcess(0x1000, false, pid);
                if (hProc != IntPtr.Zero) {
                    uint cap = 1024;
                    StringBuilder sbPath = new StringBuilder((int)cap);
                    if (QueryFullProcessImageName(hProc, 0, sbPath, ref cap)) {
                        procPath = sbPath.ToString();
                        procName = Path.GetFileNameWithoutExtension(procPath);
                    }
                }
            } catch {} finally {
                if (hProc != IntPtr.Zero) CloseHandle(hProc);
            }

            if (string.IsNullOrEmpty(procName)) {
                try {
                    Process proc = Process.GetProcessById((int)pid);
                    if (proc != null) procName = proc.ProcessName;
                } catch {}
            }
            if (string.IsNullOrEmpty(procName)) return false;

            RECT r;
            if (GetWindowRect(fg, out r)) {
                int sw = GetSystemMetrics(0);
                int sh = GetSystemMetrics(1);
                int style = GetWindowLong(fg, -16);
                bool hasCaption = (style & 0x00C00000) != 0;
                if (!hasCaption && r.Left <= 0 && r.Top <= 0 && r.Right >= sw && r.Bottom >= sh) {
                    isFullscreen = true;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    public const byte VK_MEDIA_NEXT_TRACK = 0xB0;
    public const byte VK_MEDIA_PREV_TRACK = 0xB1;
    public const byte VK_MEDIA_PLAY_PAUSE = 0xB3;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static ConcurrentQueue<string> CommandQueue = new ConcurrentQueue<string>();
    private static bool _started = false;
    private static bool _osdStarted = false;
    public static volatile bool VolumeKeyRecentlyPressed = false;
    public static volatile IntPtr LastToastHwnd = IntPtr.Zero;
    public static volatile IntPtr LastWhatsAppCallHwnd = IntPtr.Zero;
    public static volatile string LastWhatsAppCallTitle = "";
    public static volatile bool AllowCallWindowVisible = false;
    public static volatile int SavedCallX = 80;
    public static volatile int SavedCallY = 80;
    public static volatile int SavedCallW = 500;
    public static volatile int SavedCallH = 360;

    public static void StartStdinReader() {
        if (_started) return;
        _started = true;
        Thread t = new Thread(() => {
            try {
                string line;
                while ((line = Console.ReadLine()) != null) {
                    if (!string.IsNullOrWhiteSpace(line)) {
                        CommandQueue.Enqueue(line.Trim());
                    }
                }
            } catch {}
        });
        t.IsBackground = true;
        t.Start();
    }

    public static void StartOsdSuppressor() {
        if (_osdStarted) return;
        _osdStarted = true;
        Thread t = new Thread(() => {
            bool prevVolKey = false;
            while (true) {
                try {
                    // Check if Volume Up (0xAF), Volume Down (0xAE), or Mute (0xAD) is pressed
                    bool volKeyDown = ((GetAsyncKeyState(0xAF) & 0x8000) != 0) ||
                                      ((GetAsyncKeyState(0xAE) & 0x8000) != 0) ||
                                      ((GetAsyncKeyState(0xAD) & 0x8000) != 0);
                    if (volKeyDown && !prevVolKey) {
                        VolumeKeyRecentlyPressed = true;
                    }
                    prevVolKey = volKeyDown;

                    // Suppress Windows 11 XamlExplorerHostIslandWindow hardware flyout (Volume / Brightness OSD)
                    IntPtr h = IntPtr.Zero;
                    while ((h = FindWindowEx(IntPtr.Zero, h, "XamlExplorerHostIslandWindow", null)) != IntPtr.Zero) {
                        RECT r;
                        if (!GetWindowRect(h, out r)) continue;
                        int w = r.Right - r.Left;
                        int ht = r.Bottom - r.Top;
                        if (w >= 110 && w <= 440 && ht >= 30 && ht <= 150) {
                            StringBuilder tb = new StringBuilder(64);
                            GetWindowText(h, tb, 64);
                            if (tb.Length == 0) {
                                int ex = GetWindowLong(h, -20);
                                if ((ex & 0x00080000) == 0) {
                                    SetWindowLong(h, -20, ex | 0x00080000 | 0x00000020);
                                }
                                SetLayeredWindowAttributes(h, 0, 0, 2);
                                if (r.Left > -10000) {
                                    SetWindowPos(h, IntPtr.Zero, -30000, -30000, 0, 0, 0x0001 | 0x0004 | 0x0010 | 0x0080);
                                }
                            }
                        }
                    }

                    // Suppress legacy Windows 10/11 NativeHWNDHost OSD if present
                    IntPtr nh = IntPtr.Zero;
                    while ((nh = FindWindowEx(IntPtr.Zero, nh, "NativeHWNDHost", null)) != IntPtr.Zero) {
                        IntPtr dui = FindWindowEx(nh, IntPtr.Zero, "DirectUIHWND", null);
                        if (dui != IntPtr.Zero) {
                            StringBuilder tb = new StringBuilder(64);
                            GetWindowText(nh, tb, 64);
                            if (tb.Length == 0) {
                                int ex = GetWindowLong(nh, -20);
                                SetWindowLong(nh, -20, ex | 0x00080000 | 0x00000020);
                                SetLayeredWindowAttributes(nh, 0, 0, 2);
                                SetWindowPos(nh, IntPtr.Zero, -30000, -30000, 0, 0, 0x0001 | 0x0004 | 0x0010 | 0x0080);
                            }
                        }
                    }

                    // Suppress native Windows 11 bottom-right Toast Notification banner popup so it only shows in Dynamic Island
                    IntPtr th = IntPtr.Zero;
                    while ((th = FindWindowEx(IntPtr.Zero, th, "Windows.UI.Core.CoreWindow", null)) != IntPtr.Zero) {
                        if (!IsWindowVisible(th)) continue;
                        StringBuilder tsb = new StringBuilder(128);
                        GetWindowText(th, tsb, 128);
                        string tTitle = tsb.ToString();
                        if (tTitle == "New notification" || tTitle == "Pemberitahuan baru") {
                            LastToastHwnd = th;
                            int ex = GetWindowLong(th, -20);
                            if ((ex & 0x00080000) == 0) {
                                SetWindowLong(th, -20, ex | 0x00080000 | 0x00000020);
                            }
                            SetLayeredWindowAttributes(th, 0, 0, 2);
                            RECT tr;
                            if (GetWindowRect(th, out tr) && tr.Left > -10000) {
                                SetWindowPos(th, IntPtr.Zero, -30000, -30000, 0, 0, 0x0001 | 0x0004 | 0x0010);
                            }
                        }
                    }

                    // Detect & suppress standalone WhatsApp Desktop incoming call window (WinUIDesktopWin32WindowClass)
                    IntPtr wh = IntPtr.Zero;
                    int waWinCount = 0;
                    IntPtr candidateCallHwnd = IntPtr.Zero;
                    string candidateCallTitle = "";
                    RECT candidateRect = new RECT();
                    while ((wh = FindWindowEx(IntPtr.Zero, wh, "WinUIDesktopWin32WindowClass", null)) != IntPtr.Zero) {
                        if (!IsWindowVisible(wh)) continue;
                        RECT wr;
                        if (!GetWindowRect(wh, out wr)) continue;
                        int ww = wr.Right - wr.Left;
                        int wht = wr.Bottom - wr.Top;
                        if (ww < 180 || wht < 90) continue;
                        StringBuilder wsb = new StringBuilder(160);
                        GetWindowText(wh, wsb, 160);
                        string wTitle = wsb.ToString().Trim();
                        waWinCount++;
                        bool titleLooksCall = wTitle.IndexOf("call", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                              wTitle.IndexOf("panggilan", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                              (wTitle.Length > 0 && !wTitle.Equals("WhatsApp", StringComparison.OrdinalIgnoreCase) && ww <= 820 && wht <= 640);
                        if (titleLooksCall || (ww >= 200 && ww <= 680 && wht >= 110 && wht <= 520)) {
                            candidateCallHwnd = wh;
                            candidateCallTitle = string.IsNullOrWhiteSpace(wTitle) ? "WhatsApp" : wTitle;
                            candidateRect = wr;
                        }
                    }
                    if (candidateCallHwnd != IntPtr.Zero && (waWinCount >= 2 || !candidateCallTitle.Equals("WhatsApp", StringComparison.OrdinalIgnoreCase))) {
                        if (candidateCallHwnd != LastWhatsAppCallHwnd) {
                            AllowCallWindowVisible = false;
                        }
                        LastWhatsAppCallHwnd = candidateCallHwnd;
                        LastWhatsAppCallTitle = candidateCallTitle;
                        int cw = candidateRect.Right - candidateRect.Left;
                        int ch = candidateRect.Bottom - candidateRect.Top;
                        if (cw >= 180 && ch >= 90) {
                            SavedCallW = cw;
                            SavedCallH = ch;
                        }
                        if (candidateRect.Left > -5000) {
                            SavedCallX = Math.Max(40, candidateRect.Left);
                            SavedCallY = Math.Max(40, candidateRect.Top);
                        }
                        if (!AllowCallWindowVisible) {
                            int ex = GetWindowLong(candidateCallHwnd, -20);
                            if ((ex & 0x00080000) == 0 || (ex & 0x00000020) == 0) {
                                SetWindowLong(candidateCallHwnd, -20, ex | 0x00080000 | 0x00000020);
                            }
                            SetLayeredWindowAttributes(candidateCallHwnd, 0, 0, 2);
                            if (candidateRect.Left > -10000) {
                                SetWindowPos(candidateCallHwnd, IntPtr.Zero, -30000, -30000, 0, 0, 0x0001 | 0x0004 | 0x0010);
                            }
                        }
                    } else if (candidateCallHwnd == IntPtr.Zero) {
                        LastWhatsAppCallHwnd = IntPtr.Zero;
                        LastWhatsAppCallTitle = "";
                        AllowCallWindowVisible = false;
                    }
                } catch {}
                Thread.Sleep(25);
            }
        });
        t.IsBackground = true;
        t.Start();
    }

    public static void RestoreCallWindow() {
        AllowCallWindowVisible = true;
        IntPtr h = LastWhatsAppCallHwnd;
        if (h == IntPtr.Zero) return;
        try {
            int ex = GetWindowLong(h, -20);
            SetWindowLong(h, -20, (ex | 0x00080000) & ~0x00000020);
            SetLayeredWindowAttributes(h, 0, 255, 2);
            SetWindowPos(h, IntPtr.Zero, SavedCallX, SavedCallY, SavedCallW, SavedCallH, 0x0004 | 0x0040);
            ShowWindow(h, 9);
            SetForegroundWindow(h);
        } catch {}
    }

    public static void ClickRelativeInWindow(IntPtr h, double rx, double ry) {
        if (h == IntPtr.Zero) return;
        try {
            RECT r;
            if (!GetWindowRect(h, out r)) return;
            int w = r.Right - r.Left;
            int ht = r.Bottom - r.Top;
            if (w <= 0 || ht <= 0) return;
            POINT oldPt;
            GetCursorPos(out oldPt);
            int tx = r.Left + (int)Math.Round(w * rx);
            int ty = r.Top + (int)Math.Round(ht * ry);
            SetCursorPos(tx, ty);
            Thread.Sleep(25);
            mouse_event(MOUSEEVENTF_LEFTDOWN, tx, ty, 0, UIntPtr.Zero);
            Thread.Sleep(25);
            mouse_event(MOUSEEVENTF_LEFTUP, tx, ty, 0, UIntPtr.Zero);
            Thread.Sleep(25);
            SetCursorPos(oldPt.X, oldPt.Y);
        } catch {}
    }

    public static bool FocusWindowByTitleOrClass(string appName) {
        try {
            if (!string.IsNullOrWhiteSpace(appName) && appName.IndexOf("WhatsApp", StringComparison.OrdinalIgnoreCase) >= 0) {
                if (LastWhatsAppCallHwnd != IntPtr.Zero && IsWindowVisible(LastWhatsAppCallHwnd)) {
                    RestoreCallWindow();
                    return true;
                }
                IntPtr wh = IntPtr.Zero;
                while ((wh = FindWindowEx(IntPtr.Zero, wh, "WinUIDesktopWin32WindowClass", null)) != IntPtr.Zero) {
                    if (wh == LastWhatsAppCallHwnd) continue;
                    ShowWindow(wh, 9);
                    SetForegroundWindow(wh);
                    return true;
                }
            }
            IntPtr h = IntPtr.Zero;
            while ((h = FindWindowEx(IntPtr.Zero, h, null, null)) != IntPtr.Zero) {
                if (!IsWindowVisible(h)) continue;
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(h, sb, 256);
                string title = sb.ToString();
                if (!string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(appName) &&
                    title.IndexOf(appName, StringComparison.OrdinalIgnoreCase) >= 0) {
                    ShowWindow(h, 9);
                    SetForegroundWindow(h);
                    return true;
                }
            }
        } catch {}
        return false;
    }

    private static IAudioEndpointVolume GetEndpointVolume() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        Guid iid = typeof(IAudioEndpointVolume).GUID;
        object obj;
        dev.Activate(ref iid, 23, IntPtr.Zero, out obj);
        return (IAudioEndpointVolume)obj;
    }

    public static void GetVolume(out int vol, out bool muted) {
        vol = 50; muted = false;
        try {
            var ep = GetEndpointVolume();
            float f; ep.GetMasterVolumeLevelScalar(out f);
            ep.GetMute(out muted);
            vol = Math.Max(0, Math.Min(100, (int)Math.Round(f * 100.0f)));
        } catch {}
    }

    public static void SetVolume(int vol) {
        try {
            int clamped = Math.Max(0, Math.Min(100, vol));
            var ep = GetEndpointVolume();
            Guid g = Guid.Empty;
            ep.SetMasterVolumeLevelScalar(clamped / 100.0f, ref g);
            if (clamped > 0) {
                ep.SetMute(false, ref g);
            }
        } catch {}
    }

    public static void ToggleMute() {
        try {
            var ep = GetEndpointVolume();
            bool m; ep.GetMute(out m);
            Guid g = Guid.Empty;
            ep.SetMute(!m, ref g);
        } catch {}
    }

    public static int GetBrightness() {
        try {
            using (var searcher = new ManagementObjectSearcher("root\\WMI", "SELECT CurrentBrightness FROM WmiMonitorBrightness")) {
                foreach (ManagementObject obj in searcher.Get()) {
                    return Convert.ToInt32(obj["CurrentBrightness"]);
                }
            }
        } catch {}
        return -1;
    }

    public static void SetBrightness(int level) {
        try {
            int clamped = Math.Max(0, Math.Min(100, level));
            using (var searcher = new ManagementObjectSearcher("root\\WMI", "SELECT * FROM WmiMonitorBrightnessMethods")) {
                foreach (ManagementObject obj in searcher.Get()) {
                    obj.InvokeMethod("WmiSetBrightness", new object[] { (uint)1, (byte)clamped });
                    break;
                }
            }
        } catch {}
    }

    public static void Tap(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
    if ($null -eq $WinRtTask) { return $null }
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.MediaPlaybackAutoRepeatMode, Windows.Media, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.RandomAccessStreamReference, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

function Get-BestSession($mgr) {
    if ($null -eq $mgr) { return $null }
    $sessions = $mgr.GetSessions()
    if ($null -eq $sessions -or $sessions.Count -eq 0) {
        return $mgr.GetCurrentSession()
    }
    foreach ($s in $sessions) {
        $pb = $s.GetPlaybackInfo()
        if ($null -ne $pb -and $pb.PlaybackStatus.ToString() -eq "Playing" -and $s.SourceAppUserModelId -match "(?i)spotify") {
            return $s
        }
    }
    foreach ($s in $sessions) {
        $pb = $s.GetPlaybackInfo()
        if ($null -ne $pb -and $pb.PlaybackStatus.ToString() -eq "Playing") {
            return $s
        }
    }
    foreach ($s in $sessions) {
        if ($s.SourceAppUserModelId -match "(?i)spotify") {
            return $s
        }
    }
    return $mgr.GetCurrentSession()
}

$script:lastWaSender = ""
$script:lastWaSenderAt = [DateTime]::MinValue

function Get-WhatsAppChatRows() {
    $rows = @()
    $chromeHw = [IntPtr]::Zero
    $renderHw = [IntPtr]::Zero
    if (-not [MediaKeys]::FindWhatsAppWebView([ref]$chromeHw, [ref]$renderHw)) {
        return $rows
    }
    try {
        $el = [System.Windows.Automation.AutomationElement]::FromHandle($chromeHw)
        if ($null -eq $el) { return $rows }
        $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::DataItem)
        $items = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        if ($null -eq $items) { return $rows }
        $lastOuter = ""
        $lastOuterEl = $null
        for ($i = 0; $i -lt $items.Count; $i++) {
            $item = $items[$i]
            $cls = try { [string]$item.Current.ClassName } catch { "" }
            $nm = try { [string]$item.Current.Name } catch { "" }
            if ($cls -match "x1n2onr6|x10l6tqk") {
                $lastOuter = $nm
                $lastOuterEl = $item
            } elseif ($cls -match "x6s0dn4" -and -not [string]::IsNullOrEmpty($lastOuter)) {
                $inner = $nm
                $idx = $lastOuter.IndexOf($inner)
                if ($idx -ge 0) {
                    $msg = $lastOuter.Substring($idx + $inner.Length).Trim()
                    $msg = [regex]::Replace($msg, "(\s*(Muted chat|Pinned chat|Starred chat|Archived chat|@\s*message|New messages will disappear.*))+$", "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase).Trim()
                    $senderClean = [regex]::Replace($inner, "^(\d+\s+(unread\s+messages?|pesan\s+belum\s+dibaca)\s+)", "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                    $senderClean = [regex]::Replace($senderClean, "\s+(\d{1,2}[:.]\d{2}(\s*[AP]M)?|Yesterday|Kemarin|Today|Hari\s+ini|\d{1,2}/\d{1,2}/\d{2,4}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)$", "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase).Trim()
                    $rows += @{
                        sender    = $senderClean
                        msg       = $msg
                        headerEl  = $item
                        outerEl   = if ($null -ne $lastOuterEl) { $lastOuterEl } else { $item }
                    }
                }
                $lastOuter = ""
            }
        }
    } catch {}
    return $rows
}

function Get-WhatsAppChatMessage([string]$targetSender) {
    if ([string]::IsNullOrWhiteSpace($targetSender)) { return "" }
    $needle = $targetSender.Trim()
    try {
        $gwLog = Join-Path $env:LOCALAPPDATA "hermes\logs\gateway.log"
        if (Test-Path $gwLog) {
            $tail = Get-Content -Path $gwLog -Tail 60 -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($null -ne $tail) {
                for ($i = $tail.Count - 1; $i -ge 0; $i--) {
                    $ln = $tail[$i]
                    if ($ln -match "inbound message:\s*platform=whatsapp\s+user=(?<usr>.+?)\s+chat=\S+\s+msg='(?<msg>.*)'\s+reply_to_id=") {
                        $u = $Matches['usr'].Trim()
                        $m = $Matches['msg'].Trim()
                        if (-not [string]::IsNullOrWhiteSpace($m) -and $m -notmatch "^(?i)(message|pesan)$") {
                            if ($u.Equals($needle, [System.StringComparison]::OrdinalIgnoreCase) -or $u.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $needle.IndexOf($u, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                                return $m
                            }
                        }
                    }
                }
            }
        }
    } catch {}
    $rows = Get-WhatsAppChatRows
    foreach ($r in $rows) {
        if ($r.sender.Equals($needle, [System.StringComparison]::OrdinalIgnoreCase)) {
            if (-not [string]::IsNullOrWhiteSpace($r.msg) -and $r.msg -notmatch "^(?i)(message|pesan)$") {
                return $r.msg
            }
        }
    }
    foreach ($r in $rows) {
        if ($r.sender.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $needle.IndexOf($r.sender, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            if (-not [string]::IsNullOrWhiteSpace($r.msg) -and $r.msg -notmatch "^(?i)(message|pesan)$") {
                return $r.msg
            }
        }
    }
    return ""
}

function Get-WhatsAppCallCaller([IntPtr]$hwnd) {
    if ($hwnd -eq [IntPtr]::Zero) { return "" }
    try {
        [MediaKeys]::WakeAllRenderWidgets($hwnd)
        $ignoreRegex = "^(?i)(non\s*client\s*input\s*sink\s*window|reunioncaptioncontrolswindow|chrome\s*legacy\s*window|desktopchildsitebridge|inputsitewindowclass|microsoft\.ui\..*|whatsapp|(\(\d+\)\s*)?whatsapp(\s*-\s*web\s*content)?|voice\s*call|video\s*call|panggilan\s*suara|panggilan\s*video|incoming.*|panggilan\s*masuk.*|end-to-end\s*encrypted|terenkripsi.*|accept|terima|jawab|answer|decline|reject|tolak|end.*|akhiri.*|mute|unmute|bisukan|more.*|lainnya|minimize|maximize|close|restore|system.*|tutup|perkecil|perbesar|\.\.\.|chats|calls|status|channels|communities|archived|meta\s*ai|media|you|menu|new\s*chat|all|unread.*|\d+|\d{1,2}[:.]\d{2})$"

        # 1. Check UIA Text elements inside the call window itself (excluding internal WinUI3/WebView2 panes)
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
        if ($null -ne $root) {
            $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
            if ($null -ne $all) {
                foreach ($el in $all) {
                    $nm = try { [string]$el.Current.Name } catch { "" }
                    $cls = try { [string]$el.Current.ClassName } catch { "" }
                    if ($cls -match "(?i)(InputNonClientPointerSource|ReunionWindowingCaptionControls|DesktopChildSiteBridge|InputSiteWindowClass|Chrome_RenderWidgetHostHWND)") { continue }
                    if (-not [string]::IsNullOrWhiteSpace($nm)) {
                        $trimmed = $nm.Trim()
                        if ($trimmed.Length -ge 2 -and $trimmed.Length -le 60 -and $trimmed -notmatch $ignoreRegex) {
                            $ct = try { [string]$el.Current.ControlType.ProgrammaticName } catch { "" }
                            if ($ct -match "Text|ListItem") {
                                return $trimmed
                            }
                        }
                    }
                }
            }
        }

        # 2. Check secondary Chrome_WidgetWin_1 call window if present
        $mainChrome = [IntPtr]::Zero
        $mainRender = [IntPtr]::Zero
        [MediaKeys]::FindWhatsAppWebView([ref]$mainChrome, [ref]$mainRender) | Out-Null
        $cw = [IntPtr]::Zero
        while (($cw = [MediaKeys]::FindWindowEx([IntPtr]::Zero, $cw, "Chrome_WidgetWin_1", $null)) -ne [IntPtr]::Zero) {
            if ($cw -eq $mainChrome) { continue }
            $cRoot = [System.Windows.Automation.AutomationElement]::FromHandle($cw)
            if ($null -ne $cRoot) {
                $cAll = $cRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
                if ($null -ne $cAll) {
                    foreach ($cel in $cAll) {
                        $cnm = try { [string]$cel.Current.Name } catch { "" }
                        if (-not [string]::IsNullOrWhiteSpace($cnm)) {
                            $ctrimmed = $cnm.Trim()
                            if ($ctrimmed.Length -ge 2 -and $ctrimmed.Length -le 60 -and $ctrimmed -notmatch $ignoreRegex) {
                                $cct = try { [string]$cel.Current.ControlType.ProgrammaticName } catch { "" }
                                if ($cct -match "Text") {
                                    return $ctrimmed
                                }
                            }
                        }
                    }
                }
            }
        }

        # 3. Check WhatsApp Chat list for the active Voice call / Video call row (e.g. 'rajaska' -> 'Video call' / 'Voice call')
        $rows = Get-WhatsAppChatRows
        foreach ($r in $rows) {
            if ($r.msg -match "^(?i)(voice\s*call|video\s*call|panggilan\s*(suara|video)|incoming.*call|panggilan\s*masuk|calling.*|memanggil.*|berdering.*)$") {
                if (-not [string]::IsNullOrWhiteSpace($r.sender) -and $r.sender -notmatch $ignoreRegex) {
                    return $r.sender
                }
            }
        }

        # 4. Fallback to recent WhatsApp notification sender if arrived within the last 30s
        if (-not [string]::IsNullOrWhiteSpace($script:lastWaSender) -and ([DateTime]::UtcNow - $script:lastWaSenderAt).TotalSeconds -lt 30) {
            return $script:lastWaSender
        }
    } catch {}
    return ""
}

function Invoke-WhatsAppCallAction([bool]$accept) {
    $hwnd = [MediaKeys]::LastWhatsAppCallHwnd
    if ($hwnd -eq [IntPtr]::Zero) { return $false }
    if ($accept) {
        [MediaKeys]::RestoreCallWindow()
        Start-Sleep -Milliseconds 90
    }
    $invoked = $false
    try {
        [MediaKeys]::WakeAllRenderWidgets($hwnd)
        $targetPattern = if ($accept) { "(?i)(accept|terima|jawab|answer)" } else { "(?i)(decline|reject|tolak|end|hang\s*up|ignore|tutup)" }
        $rootsToSearch = @()
        $r1 = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
        if ($null -ne $r1) { $rootsToSearch += $r1 }
        $cw = [IntPtr]::Zero
        while (($cw = [MediaKeys]::FindWindowEx([IntPtr]::Zero, $cw, "Chrome_WidgetWin_1", $null)) -ne [IntPtr]::Zero) {
            $rc = [System.Windows.Automation.AutomationElement]::FromHandle($cw)
            if ($null -ne $rc) { $rootsToSearch += $rc }
        }
        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
        foreach ($root in $rootsToSearch) {
            if ($invoked) { break }
            $btns = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
            if ($null -ne $btns) {
                foreach ($b in $btns) {
                    $bName = try { [string]$b.Current.Name } catch { "" }
                    $bId = try { [string]$b.Current.AutomationId } catch { "" }
                    if ($accept -and ("$bName $bId" -match $targetPattern)) {
                        $pat = $null
                        if ($b.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) {
                            $pat.Invoke()
                            $invoked = $true
                            break
                        }
                    } elseif (-not $accept -and ("$bName $bId" -match $targetPattern) -and ("$bName" -notmatch "(?i)^(close|minimize|maximize|restore)$")) {
                        $pat = $null
                        if ($b.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) {
                            $pat.Invoke()
                            $invoked = $true
                            break
                        }
                    }
                }
            }
        }
    } catch {}

    if (-not $invoked) {
        if ($accept) {
            [MediaKeys]::ClickRelativeInWindow($hwnd, 0.48, 0.875)
            $invoked = $true
        } else {
            [MediaKeys]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
            $invoked = $true
        }
    }
    return $invoked
}

function Invoke-ToastPrepareReply() {
    $th = [MediaKeys]::LastToastHwnd
    if ($th -eq [IntPtr]::Zero) { return $false }
    try {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($th)
        if ($null -ne $root) {
            $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
            $editEl = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCond)
            if ($null -ne $editEl) {
                $vp = $null
                if ($editEl.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
                    $vp.SetValue(" ")
                    return $true
                }
            }
        }
    } catch {}
    return $false
}

function Send-WhatsAppSilentReply([string]$sender, [string]$replyText) {
    $chromeHw = [IntPtr]::Zero
    $renderHw = [IntPtr]::Zero
    if (-not [MediaKeys]::FindWhatsAppWebView([ref]$chromeHw, [ref]$renderHw)) {
        return $false
    }
    $topHw = [MediaKeys]::FindWhatsAppMainTopHwnd()
    $prevFg = [MediaKeys]::GetForegroundWindow()
    $wasIconic = if ($topHw -ne [IntPtr]::Zero) { [MediaKeys]::IsIconic($topHw) } else { $false }
    $wasVisible = if ($topHw -ne [IntPtr]::Zero) { [MediaKeys]::IsWindowVisible($topHw) } else { $false }
    $origExStyle = if ($topHw -ne [IntPtr]::Zero) { [MediaKeys]::GetWindowLong($topHw, -20) } else { 0 }

    # Cloak the WhatsApp window (alpha = 1 + bottom Z-order) so it NEVER visually pops up on screen
    if ($topHw -ne [IntPtr]::Zero) {
        [MediaKeys]::SetWindowLong($topHw, -20, ($origExStyle -bor 0x00080000)) | Out-Null
        [MediaKeys]::SetLayeredWindowAttributes($topHw, 0, 1, 2) | Out-Null
    }

    $sentOk = $false
    try {
        $el = [System.Windows.Automation.AutomationElement]::FromHandle($chromeHw)
        if ($null -ne $el) {
            # 1. Select the matching contact/group chat row in WhatsApp Chat list
            if (-not [string]::IsNullOrWhiteSpace($sender)) {
                $rows = Get-WhatsAppChatRows
                $targetRow = $null
                foreach ($r in $rows) {
                    if ($r.sender.Equals($sender.Trim(), [System.StringComparison]::OrdinalIgnoreCase)) {
                        $targetRow = $r
                        break
                    }
                }
                if ($null -eq $targetRow) {
                    foreach ($r in $rows) {
                        if ($r.sender.IndexOf($sender.Trim(), [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $sender.Trim().IndexOf($r.sender, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                            $targetRow = $r
                            break
                        }
                    }
                }
                if ($null -ne $targetRow) {
                    $sp = $null
                    if ($targetRow.outerEl.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$sp)) {
                        $sp.Select()
                    }
                    if ($targetRow.headerEl.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$sp)) {
                        $sp.Select()
                    }
                    if ($topHw -ne [IntPtr]::Zero) {
                        [MediaKeys]::SetWindowPos($topHw, [IntPtr]1, 0, 0, 0, 0, 0x0013) | Out-Null
                    }
                    Start-Sleep -Milliseconds 650
                }
            }

            # 2. Find the message composer ('Type a message to ...' / 'Ketik pesan...')
            $msgBox = $null
            $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
            for ($w = 0; $w -lt 8 -and $null -eq $msgBox; $w++) {
                $edits = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)
                if ($null -ne $edits) {
                    foreach ($ed in $edits) {
                        $enm = try { [string]$ed.Current.Name } catch { "" }
                        if ($enm -match "^(?i)(type a message|ketik pesan)") {
                            if ([string]::IsNullOrWhiteSpace($sender) -or $enm.IndexOf($sender.Trim(), [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $w -ge 5) {
                                $msgBox = $ed
                            }
                        }
                    }
                }
                if ($null -eq $msgBox) { Start-Sleep -Milliseconds 150 }
            }

            if ($null -ne $msgBox) {
                $typedOk = $false
                for ($attempt = 0; $attempt -lt 3 -and -not $typedOk; $attempt++) {
                    [MediaKeys]::PostMessage($renderHw, 0x0007, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
                    try {
                        $r = $msgBox.Current.BoundingRectangle
                        if ($r.Width -gt 0) {
                            [MediaKeys]::PostClickScreen($renderHw, [int]($r.Left + [Math]::Min(40, $r.Width / 2)), [int]($r.Top + $r.Height / 2))
                        }
                    } catch {}
                    try { $msgBox.SetFocus() } catch {}
                    if ($topHw -ne [IntPtr]::Zero) {
                        [MediaKeys]::SetWindowPos($topHw, [IntPtr]1, 0, 0, 0, 0, 0x0013) | Out-Null
                    }
                    Start-Sleep -Milliseconds 120

                    foreach ($ch in $replyText.ToCharArray()) {
                        [MediaKeys]::PostMessage($renderHw, 0x0102, [IntPtr][int][char]$ch, [IntPtr]::Zero) | Out-Null
                    }
                    Start-Sleep -Milliseconds 250
                    $val = ""
                    $vp = $null
                    if ($msgBox.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
                        $val = [string]$vp.Current.Value
                    }
                    if (-not [string]::IsNullOrWhiteSpace($val)) { $typedOk = $true }
                }
                if ($prevFg -ne [IntPtr]::Zero -and $prevFg -ne $topHw -and $prevFg -ne $chromeHw) {
                    [MediaKeys]::SetForegroundWindow($prevFg) | Out-Null
                }
                if (-not $typedOk) { return $false }

                $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
                $btns = $el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
                if ($null -ne $btns) {
                    foreach ($b in $btns) {
                        $bnm = try { [string]$b.Current.Name } catch { "" }
                        if ($bnm -eq "Send" -or $bnm -eq "Kirim") {
                            $inv = $null
                            if ($b.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
                                $inv.Invoke()
                                $sentOk = $true
                                break
                            }
                        }
                    }
                }
                if (-not $sentOk) {
                    [MediaKeys]::PostMessage($renderHw, 0x0100, [IntPtr]0x0D, [IntPtr]::Zero) | Out-Null
                    [MediaKeys]::PostMessage($renderHw, 0x0101, [IntPtr]0x0D, [IntPtr]::Zero) | Out-Null
                    $sentOk = $true
                }
            }
        }
    } catch {} finally {
        if ($topHw -ne [IntPtr]::Zero) {
            if (-not $wasVisible) {
                [MediaKeys]::ShowWindow($topHw, 0) | Out-Null
            } elseif ($wasIconic) {
                [MediaKeys]::ShowWindow($topHw, 6) | Out-Null
            } else {
                [MediaKeys]::SetWindowPos($topHw, [IntPtr]1, 0, 0, 0, 0, 0x0013) | Out-Null
            }
            if ($prevFg -ne [IntPtr]::Zero -and $prevFg -ne $topHw -and $prevFg -ne $chromeHw) {
                [MediaKeys]::SetForegroundWindow($prevFg) | Out-Null
            }
            [MediaKeys]::SetLayeredWindowAttributes($topHw, 0, 255, 2) | Out-Null
            if (($origExStyle -band 0x00080000) -eq 0) {
                [MediaKeys]::SetWindowLong($topHw, -20, $origExStyle) | Out-Null
            }
        }
    }
    return $sentOk
}

function Invoke-NotificationReply([string]$cmdVal) {
    $parts = $cmdVal.Split('|', 4)
    $appName = if ($parts.Count -gt 0) { $parts[0].Trim() } else { "" }
    $aumid = if ($parts.Count -gt 1) { $parts[1].Trim() } else { "" }
    $senderB64 = if ($parts.Count -gt 2) { $parts[2].Trim() } else { "" }
    $replyB64 = if ($parts.Count -gt 3) { $parts[3].Trim() } else { "" }

    $sender = ""
    $replyText = ""
    try { if ($senderB64) { $sender = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($senderB64)) } } catch {}
    try { if ($replyB64) { $replyText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($replyB64)) } } catch {}
    if ([string]::IsNullOrWhiteSpace($replyText)) { return $false }

    # 1. Try background Windows Toast inline reply via UI Automation
    $th = [MediaKeys]::LastToastHwnd
    if ($th -ne [IntPtr]::Zero) {
        try {
            $root = [System.Windows.Automation.AutomationElement]::FromHandle($th)
            if ($null -ne $root) {
                $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
                $editEl = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCond)
                if ($null -ne $editEl) {
                    $vp = $null
                    if ($editEl.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
                        $vp.SetValue($replyText)
                        Start-Sleep -Milliseconds 40
                        $btnCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
                        $btns = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
                        if ($null -ne $btns) {
                            foreach ($b in $btns) {
                                $bName = try { [string]$b.Current.Name } catch { "" }
                                $bId = try { [string]$b.Current.AutomationId } catch { "" }
                                if ("$bName $bId" -match "(?i)(send|kirim|reply|balas|submit|verb)" -or ("$bName" -notmatch "(?i)(dismiss|close|tutup|setting|pengaturan|more)")) {
                                    $ip = $null
                                    if ($b.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$ip)) {
                                        $ip.Invoke()
                                        return $true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch {}
    }

    # 2. Silent background WhatsApp WebView2 reply (never pops up or focuses the app window)
    if ($appName -match "(?i)whatsapp" -or $aumid -match "(?i)whatsapp") {
        return (Send-WhatsAppSilentReply $sender $replyText)
    }

    return $false
}

function Set-SystemPowerMode([string]$mode) {
    $m = $mode.ToLower().Trim()
    $guid = switch ($m) {
        "silent" { [Guid]"961cc777-2547-4f9d-8174-7d86181b8a7a" }
        "performance" { [Guid]"ded574b5-45a0-4f42-8737-46345c09c238" }
        default { [Guid]"00000000-0000-0000-0000-000000000000" } # Balanced
    }
    try { [MediaKeys]::PowerSetActiveOverlayScheme($guid) | Out-Null } catch {}

    try {
        $admPath = "C:\Program Files\Acer\Acer Device Management Framework\ADM_Service_Agent.exe"
        if (Test-Path $admPath) {
            $asm = [System.Reflection.Assembly]::LoadFrom($admPath)
            $pType = $asm.GetType("DeviceManagementFramework.Acer_Class.Acer_ProcessPowerMode")
            $pInst = [System.Activator]::CreateInstance($pType)
            $setM = $pType.GetMethod("SetPerformanceMode")
            $perfFuncType = $asm.GetType("DeviceManagementFramework.Acer_Class.Acer_ProcessPowerMode+PerformanceFunctionType")
            $acerPerfMode = $asm.GetType("DeviceManagementFramework.Acer_Class.Acer_ProcessPowerMode+AcerPerformanceMode")
            $targetEnum = switch ($m) {
                "silent" { "SILENT" }
                "performance" { "PERFORMANCE" }
                default { "BALANCE" }
            }
            $setM.Invoke($pInst, @([System.Enum]::Parse($perfFuncType, "WINDOWS_POWER_CONFIG"), [System.Enum]::Parse($acerPerfMode, $targetEnum))) | Out-Null
        }
    } catch {}

    $evt = @{
        type = "systemModeUpdate"
        powerMode = $m
    } | ConvertTo-Json -Compress
    [Console]::WriteLine($evt)
    return $m
}

function Send-AcerAdmNamedPipeCommand([string]$cmd) {
    try {
        $pipe = New-Object System.IO.Pipes.NamedPipeClientStream('.', 'acer_adm_namedpipe', [System.IO.Pipes.PipeDirection]::InOut)
        $pipe.Connect(400)
        $writer = New-Object System.IO.StreamWriter($pipe)
        $writer.AutoFlush = $true
        $writer.WriteLine($cmd)
        Start-Sleep -Milliseconds 40
        $pipe.Close()
        $pipe.Dispose()
        return $true
    } catch {
        return $false
    }
}

function Set-SystemVisualMode([string]$mode) {
    $m = $mode.ToLower().Trim()
    $idx = 0
    $admMode = "Standard"

    # Universal Gamma parameters: (Red, Green, Blue, ContrastExponent)
    $gR = 1.0; $gG = 1.0; $gB = 1.0; $gExp = 1.0

    switch ($m) {
        "movie" {
            $idx = 1
            $admMode = "Movie"
            $gR = 1.02; $gG = 1.0; $gB = 1.03; $gExp = 0.92
        }
        "photo" {
            $idx = 2
            $admMode = "Photo"
            $gR = 1.0; $gG = 1.0; $gB = 1.0; $gExp = 1.0
        }
        "reading" {
            $idx = 4
            $admMode = "Low Blue Light"
            # Warm yellow night filter (reduce blue to 62%, green to 88%)
            $gR = 1.0; $gG = 0.88; $gB = 0.62; $gExp = 1.0
        }
        default {
            $m = "standard"
            $idx = 0
            $admMode = "Standard"
            $gR = 1.0; $gG = 1.0; $gB = 1.0; $gExp = 1.0
        }
    }

    $isAcer = Test-Path "C:\Program Files\Acer\Acer Device Management Framework\Color_API.dll"

    if ($isAcer) {
        # Acer-specific engine: update registry, named pipe, and call Acer Color_API
        try {
            $regKey = "HKCU:\SOFTWARE\Acer\Acer Device Management Framework"
            if (-not (Test-Path $regKey)) {
                New-Item -Path $regKey -Force -ErrorAction SilentlyContinue | Out-Null
            }
            Set-ItemProperty -Path $regKey -Name "VisualMode" -Value $admMode -Force -ErrorAction SilentlyContinue
        } catch {}

        $null = Send-AcerAdmNamedPipeCommand "SetVisualMode,$admMode"

        try {
            [MediaKeys]::DriverColorProfileInitial() | Out-Null
            [MediaKeys]::SetMediaColorMode($idx) | Out-Null
        } catch {}
    } else {
        # Universal Windows fallback (Asus, Lenovo, HP, Dell, Surface, custom PC, etc.)
        # Applies native Windows GDI SetDeviceGammaRamp to color channels directly
        try {
            [MediaKeys]::SetUniversalGamma($gR, $gG, $gB, $gExp) | Out-Null
        } catch {}

        try {
            $uniRegKey = "HKCU:\SOFTWARE\DynamicIsland"
            if (-not (Test-Path $uniRegKey)) {
                New-Item -Path $uniRegKey -Force -ErrorAction SilentlyContinue | Out-Null
            }
            Set-ItemProperty -Path $uniRegKey -Name "VisualMode" -Value $m -Force -ErrorAction SilentlyContinue
        } catch {}
    }

    $evt = @{
        type = "systemModeUpdate"
        visualMode = $m
    } | ConvertTo-Json -Compress
    [Console]::WriteLine($evt)
    return $m
}

function Get-SystemModesSnapshot {
    $pMode = "balanced"
    try {
        $effGuid = [Guid]::Empty
        if ([MediaKeys]::PowerGetEffectiveOverlayScheme([ref]$effGuid) -eq 0) {
            $gStr = $effGuid.ToString("D").ToLower()
            if ($gStr -eq "961cc777-2547-4f9d-8174-7d86181b8a7a") { $pMode = "silent" }
            elseif ($gStr -eq "ded574b5-45a0-4f42-8737-46345c09c238") { $pMode = "performance" }
            else { $pMode = "balanced" }
        }
    } catch {}

    $vMode = "standard"
    try {
        if (Test-Path "C:\Program Files\Acer\Acer Device Management Framework\Color_API.dll") {
            $regVal = (Get-ItemProperty -Path "HKCU:\SOFTWARE\Acer\Acer Device Management Framework" -Name "VisualMode" -ErrorAction SilentlyContinue).VisualMode
            if ($regVal -eq "Low Blue Light") { $vMode = "reading" }
            elseif ($regVal -eq "Movie") { $vMode = "movie" }
            elseif ($regVal -eq "Photo") { $vMode = "photo" }
            else { $vMode = "standard" }
        } else {
            $uniRegVal = (Get-ItemProperty -Path "HKCU:\SOFTWARE\DynamicIsland" -Name "VisualMode" -ErrorAction SilentlyContinue).VisualMode
            if ($uniRegVal) { $vMode = $uniRegVal.ToLower().Trim() }
        }
    } catch {}

    return @{
        type = "systemModeUpdate"
        powerMode = $pMode
        visualMode = $vMode
    } | ConvertTo-Json -Compress
}

function Invoke-MediaCommand($mgr, [string]$cmdAction, [string]$cmdVal) {
    if ($cmdAction -eq "setVolume") {
        $v = 50
        if ([int]::TryParse($cmdVal, [ref]$v)) { [MediaKeys]::SetVolume($v) }
        return $true
    } elseif ($cmdAction -eq "toggleMute") {
        [MediaKeys]::ToggleMute()
        return $true
    } elseif ($cmdAction -eq "setBrightness") {
        $b = 80
        if ([int]::TryParse($cmdVal, [ref]$b)) { [MediaKeys]::SetBrightness($b) }
        return $true
    } elseif ($cmdAction -eq "setPowerMode") {
        Set-SystemPowerMode $cmdVal | Out-Null
        return $true
    } elseif ($cmdAction -eq "setVisualMode") {
        Set-SystemVisualMode $cmdVal | Out-Null
        return $true
    } elseif ($cmdAction -eq "getSystemModes") {
        [Console]::WriteLine((Get-SystemModesSnapshot))
        return $true
    } elseif ($cmdAction -eq "focusApp") {
        $subParts = $cmdVal.Split('|', 2)
        $appName = if ($subParts.Count -gt 0) { $subParts[0].Trim() } else { "" }
        $aumid = if ($subParts.Count -gt 1) { $subParts[1].Trim() } else { "" }
        $focused = [MediaKeys]::FocusWindowByTitleOrClass($appName)
        if (-not $focused -and -not [string]::IsNullOrWhiteSpace($aumid)) {
            try {
                Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\$aumid"
                $focused = $true
            } catch {}
        }
        return $focused
    } elseif ($cmdAction -eq "acceptCall") {
        return (Invoke-WhatsAppCallAction $true)
    } elseif ($cmdAction -eq "declineCall") {
        return (Invoke-WhatsAppCallAction $false)
    } elseif ($cmdAction -eq "prepareReply") {
        return (Invoke-ToastPrepareReply)
    } elseif ($cmdAction -eq "replyNotif") {
        return (Invoke-NotificationReply $cmdVal)
    }

    $session = Get-BestSession $mgr
    $handled = $false
    if ($null -ne $session) {
        try {
            if ($cmdAction -eq "playPause") {
                $handled = Await ($session.TryTogglePlayPauseAsync()) ([bool])
            } elseif ($cmdAction -eq "next") {
                $handled = Await ($session.TrySkipNextAsync()) ([bool])
            } elseif ($cmdAction -eq "prev") {
                $handled = Await ($session.TrySkipPreviousAsync()) ([bool])
            } elseif ($cmdAction -eq "seek") {
                $sec = [double]::Parse($cmdVal, [System.Globalization.CultureInfo]::InvariantCulture)
                $ticks = [int64]($sec * 10000000)
                $handled = Await ($session.TryChangePlaybackPositionAsync($ticks)) ([bool])
            } elseif ($cmdAction -eq "shuffle") {
                $pb = $session.GetPlaybackInfo()
                $targetShuffle = if ($cmdVal -eq "true") { $true } elseif ($cmdVal -eq "false") { $false } else { -not [bool]$pb.IsShuffleActive }
                $handled = Await ($session.TryChangeShuffleActiveAsync($targetShuffle)) ([bool])
            } elseif ($cmdAction -eq "repeat") {
                $modeEnum = [Windows.Media.MediaPlaybackAutoRepeatMode]::None
                if ($cmdVal -eq "List") {
                    $modeEnum = [Windows.Media.MediaPlaybackAutoRepeatMode]::List
                } elseif ($cmdVal -eq "Track") {
                    $modeEnum = [Windows.Media.MediaPlaybackAutoRepeatMode]::Track
                }
                $handled = Await ($session.TryChangeAutoRepeatModeAsync($modeEnum)) ([bool])
            }
        } catch {
            $handled = $false
        }
    }
    if (-not $handled) {
        if ($cmdAction -eq "playPause") { [MediaKeys]::Tap([MediaKeys]::VK_MEDIA_PLAY_PAUSE) }
        elseif ($cmdAction -eq "next") { [MediaKeys]::Tap([MediaKeys]::VK_MEDIA_NEXT_TRACK) }
        elseif ($cmdAction -eq "prev") { [MediaKeys]::Tap([MediaKeys]::VK_MEDIA_PREV_TRACK) }
    }
    return $handled
}

if ($Action -eq "replyNotif") {
    $ok = Invoke-NotificationReply $Value
    Write-Output (@{ ok = $true; sent = [bool]$ok } | ConvertTo-Json -Compress)
    exit
}
if ($Action -eq "listWhatsAppChats") {
    $rows = Get-WhatsAppChatRows
    $clean = @()
    foreach ($r in $rows) {
        if (-not [string]::IsNullOrWhiteSpace($r.sender)) {
            $clean += @{
                sender      = [string]$r.sender
                lastMessage = [string]$r.msg
            }
        }
        if ($clean.Count -ge 25) { break }
    }
    $waRunning = ($null -ne (Get-Process -Name "WhatsApp*" -ErrorAction SilentlyContinue))
    Write-Output (@{ ok = $true; whatsappOpen = [bool]$waRunning; chats = $clean } | ConvertTo-Json -Compress -Depth 4)
    exit
}
if ($Action -eq "sendWhatsApp") {
    $parts = $Value.Split('|', 2)
    $senderB64 = if ($parts.Count -gt 0) { $parts[0].Trim() } else { "" }
    $msgB64 = if ($parts.Count -gt 1) { $parts[1].Trim() } else { "" }
    $sender = ""
    $msgText = ""
    try { if ($senderB64) { $sender = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($senderB64)) } } catch {}
    try { if ($msgB64) { $msgText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($msgB64)) } } catch {}
    $sent = $false
    if (-not [string]::IsNullOrWhiteSpace($sender) -and -not [string]::IsNullOrWhiteSpace($msgText)) {
        $sent = Send-WhatsAppSilentReply $sender $msgText
    }
    Write-Output (@{ ok = $true; sent = [bool]$sent; target = $sender } | ConvertTo-Json -Compress)
    exit
}
if ($Action -eq "takeScreenshot") {
    try {
        Add-Type -AssemblyName System.Drawing
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $outPath = if (-not [string]::IsNullOrWhiteSpace($Value)) { $Value } else { Join-Path $env:TEMP ("island_screen_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + ".png") }
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
        Write-Output (@{ ok = $true; path = $outPath; width = $bounds.Width; height = $bounds.Height } | ConvertTo-Json -Compress)
    } catch {
        Write-Output (@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress)
    }
    exit
}
if ($Action -in @("playPause", "next", "prev", "seek", "shuffle", "repeat")) {
    $handled = Invoke-MediaCommand $manager $Action $Value
    Write-Output (@{ ok = $true; handled = $handled } | ConvertTo-Json -Compress)
    exit 0
}

$script:lastTrackKey = ""
$script:cachedThumb = ""
$script:cachedDur = 0
$script:fallbackPos = 0
$script:fallbackKey = ""

function Fetch-ArtworkAndDuration($artist, $title) {
    try {
        $query = [uri]::EscapeDataString("$artist $title")
        $url = "https://itunes.apple.com/search?term=$query&entity=song&limit=1"
        $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 2
        if ($null -ne $resp -and $resp.resultCount -gt 0) {
            $item = $resp.results[0]
            $artUrl = $item.artworkUrl100
            $durSec = if ($item.trackTimeMillis) { [math]::Floor($item.trackTimeMillis / 1000) } else { 0 }
            return @{
                artwork  = $artUrl
                duration = $durSec
            }
        }
    } catch {}
    return @{ artwork = ""; duration = 0 }
}

function Get-SpotifyProcessFallback() {
    $procs = Get-Process -Name "Spotify" -ErrorAction SilentlyContinue | Where-Object { -not [string]::IsNullOrWhiteSpace($_.MainWindowTitle) }
    if ($null -eq $procs) { return $null }
    $winTitle = $procs[0].MainWindowTitle.Trim()
    if ($winTitle -match "^Spotify") {
        return @{
            hasMedia    = $false
            spotifyOpen = $true
        }
    }
    if ($winTitle -match "^(.+?)\s+-\s+(.+)$") {
        $artist = $Matches[1].Trim()
        $title = $Matches[2].Trim()
        $key = "$title|$artist"
        if ($key -ne $script:fallbackKey) {
            $script:fallbackKey = $key
            $script:fallbackPos = 0
            $meta = Fetch-ArtworkAndDuration $artist $title
            $script:cachedThumb = $meta.artwork
            $script:cachedDur = $meta.duration
        } else {
            $script:fallbackPos++
        }
        return @{
            hasMedia   = $true
            title      = $title
            artist     = $artist
            albumTitle = ""
            sourceApp  = "SPOTIFY"
            status     = "Playing"
            position   = $script:fallbackPos
            duration   = if ($script:cachedDur -gt 0) { $script:cachedDur } else { 210 }
            shuffle    = $false
            repeat     = "None"
            thumbnail  = $script:cachedThumb
        }
    }
    return $null
}

function Get-MediaStateJson($mgr) {
    $session = Get-BestSession $mgr
    if ($null -ne $session) {
        $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        if ($null -ne $props -and -not [string]::IsNullOrWhiteSpace($props.Title)) {
            $playback = $session.GetPlaybackInfo()
            $status = if ($null -ne $playback) { $playback.PlaybackStatus.ToString() } else { "Paused" }
            $shuffle = if ($null -ne $playback -and $null -ne $playback.IsShuffleActive) { [bool]$playback.IsShuffleActive } else { $false }
            $repeat = if ($null -ne $playback -and $null -ne $playback.AutoRepeatMode) { $playback.AutoRepeatMode.ToString() } else { "None" }

            $timeline = $session.GetTimelineProperties()
            $pos = 0
            $dur = 0
            if ($null -ne $timeline) {
                $pos = [math]::Max(0, [math]::Round($timeline.Position.TotalSeconds, 2))
                $dur = [math]::Max(0, [math]::Floor($timeline.EndTime.TotalSeconds))
                if ($status -eq "Playing" -and $timeline.LastUpdatedTime.Year -gt 2000) {
                    $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
                    if ($elapsed -gt 0 -and $elapsed -lt 3600 -and $dur -gt 0) {
                        $pos = [math]::Min($dur, [math]::Round($timeline.Position.TotalSeconds + $elapsed, 2))
                    }
                }
            }

            $trackKey = "$($props.Title)|$($props.Artist)|$($props.AlbumTitle)"
            if ($trackKey -ne $script:lastTrackKey) {
                $script:lastTrackKey = $trackKey
                $script:cachedThumb = ""
                $script:cachedDur = 0
                if ($null -ne $props.Thumbnail) {
                    try {
                        $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                        if ($null -ne $stream -and $stream.Size -gt 0) {
                            $size = [uint32]$stream.Size
                            $reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
                            Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
                            $bytes = New-Object byte[] $size
                            $reader.ReadBytes($bytes)
                            $b64 = [Convert]::ToBase64String($bytes)
                            $mime = if ([string]::IsNullOrWhiteSpace($stream.ContentType)) { "image/png" } else { $stream.ContentType }
                            $script:cachedThumb = "data:$mime;base64,$b64"
                            $reader.Dispose()
                            $stream.Dispose()
                        }
                    } catch {
                        $script:cachedThumb = ""
                    }
                }
                if ([string]::IsNullOrWhiteSpace($script:cachedThumb) -or $dur -le 0) {
                    $meta = Fetch-ArtworkAndDuration $props.Artist $props.Title
                    if ([string]::IsNullOrWhiteSpace($script:cachedThumb)) {
                        $script:cachedThumb = $meta.artwork
                    }
                    $script:cachedDur = $meta.duration
                }
            }

            if ($dur -le 0 -and $script:cachedDur -gt 0) {
                $dur = $script:cachedDur
            }

            $srcId = [string]$session.SourceAppUserModelId
            $tag = if ($srcId -match "(?i)spotify") { "SPOTIFY" }
                   elseif ($srcId -match "(?i)chrome|msedge|brave|opera|firefox") { "BROWSER MEDIA" }
                   else { "MUSIC" }

            $result = @{
                hasMedia   = $true
                title      = [string]$props.Title
                artist     = [string]$props.Artist
                albumTitle = [string]$props.AlbumTitle
                sourceApp  = $tag
                status     = $status
                position   = $pos
                duration   = $dur
                shuffle    = $shuffle
                repeat     = $repeat
                thumbnail  = $script:cachedThumb
            }
            return ($result | ConvertTo-Json -Compress)
        }
    }

    $fb = Get-SpotifyProcessFallback
    if ($null -ne $fb) {
        return ($fb | ConvertTo-Json -Compress)
    }

    return '{"hasMedia":false,"spotifyOpen":false}'
}

$script:appLogoCache = @{}

function Get-AppLogoBase64($appInfo, [string]$aumid) {
    if ($null -eq $appInfo) { return "" }
    if (-not [string]::IsNullOrWhiteSpace($aumid) -and $script:appLogoCache.ContainsKey($aumid)) {
        return $script:appLogoCache[$aumid]
    }
    try {
        $logoRef = $appInfo.DisplayInfo.GetLogo((New-Object Windows.Foundation.Size(48, 48)))
        if ($null -ne $logoRef) {
            $stream = Await ($logoRef.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            if ($null -ne $stream -and $stream.Size -gt 0) {
                $size = [uint32]$stream.Size
                $reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
                Await ($reader.LoadAsync($size)) ([uint32]) | Out-Null
                $bytes = New-Object byte[] $size
                $reader.ReadBytes($bytes)
                $b64 = "data:image/png;base64," + [Convert]::ToBase64String($bytes)
                $reader.Dispose()
                $stream.Dispose()
                if (-not [string]::IsNullOrWhiteSpace($aumid)) {
                    $script:appLogoCache[$aumid] = $b64
                }
                return $b64
            }
        }
    } catch {}
    return ""
}

if ($Action -eq "loop") {
    [MediaKeys]::StartStdinReader()
    [MediaKeys]::StartOsdSuppressor()

    $notifListener = $null
    $seenNotifIds = @{}
    $lastEmittedCallAt = [DateTime]::MinValue
    $lastSeenWaCallHwnd = [IntPtr]::Zero

    try {
        $notifListener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
        $access = Await ($notifListener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
        if ($access.ToString() -eq "Allowed") {
            $existing = Await ($notifListener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
            if ($null -ne $existing) {
                foreach ($en in $existing) {
                    $seenNotifIds[$en.Id] = $true
                    try {
                        if ($null -ne $en.AppInfo -and $en.AppInfo.AppUserModelId -match "(?i)whatsapp") {
                            Get-AppLogoBase64 $en.AppInfo ([string]$en.AppInfo.AppUserModelId) | Out-Null
                        }
                    } catch {}
                }
            }
        } else {
            $notifListener = $null
        }
    } catch {
        $notifListener = $null
    }

    $prevVol = -1
    $prevMuted = $false
    $prevBright = -1
    [MediaKeys]::GetVolume([ref]$prevVol, [ref]$prevMuted)
    $prevBright = [MediaKeys]::GetBrightness()

    $initOsd = @{
        type       = "osd"
        osdType    = "init"
        volume     = $prevVol
        muted      = $prevMuted
        brightness = if ($prevBright -ge 0) { $prevBright } else { 80 }
        trigger    = $false
    } | ConvertTo-Json -Compress
    [Console]::WriteLine($initOsd)
    [Console]::WriteLine((Get-SystemModesSnapshot))

    $nextPoll = [DateTime]::UtcNow
    $nextOsdCheck = [DateTime]::UtcNow.AddMilliseconds(90)
    $nextNotifCheck = [DateTime]::UtcNow.AddMilliseconds(350)
    $nextThermalPoll = [DateTime]::UtcNow.AddMilliseconds(200)

    $cachedCpuShort = "CPU"
    $cachedGpuShort = "GPU"
    $hasNvidiaSmi = ($null -ne (Get-Command "nvidia-smi.exe" -ErrorAction SilentlyContinue))
    try {
        $cpuInfo = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $cpuInfo -and -not [string]::IsNullOrWhiteSpace($cpuInfo.Name)) {
            $cn = $cpuInfo.Name -replace "(?i)(AMD\s+|Intel\(R\)\s+Core\(TM\)\s+|w/\s+Radeon.*|Processor|CPU|@.*)", ""
            $cachedCpuShort = $cn.Trim()
        }
        $gpuInfo = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $gpuInfo -and -not [string]::IsNullOrWhiteSpace($gpuInfo.Name)) {
            $gn = $gpuInfo.Name -replace "(?i)(AMD\s+|NVIDIA\s+GeForce\s+|Intel\(R\)\s+|Graphics)", ""
            $cachedGpuShort = $gn.Trim()
        }
    } catch {}

    $lastSeenWaCallCaller = ""

    while ($true) {
        $cmdLine = $null
        $ranCmd = $false
        $ranOsdCmd = $false
        while ([MediaKeys]::CommandQueue.TryDequeue([ref]$cmdLine)) {
            if (-not [string]::IsNullOrWhiteSpace($cmdLine)) {
                $parts = $cmdLine.Split('|', 2)
                $cmdAct = $parts[0].Trim()
                $cmdVal = if ($parts.Count -gt 1) { $parts[1].Trim() } else { "" }
                Invoke-MediaCommand $manager $cmdAct $cmdVal | Out-Null
                if ($cmdAct -in @("setVolume", "toggleMute", "setBrightness", "focusApp", "acceptCall", "declineCall", "prepareReply", "replyNotif")) {
                    $ranOsdCmd = $true
                } else {
                    $ranCmd = $true
                }
            }
        }
        if ($ranCmd) {
            $nextPoll = [DateTime]::UtcNow.AddMilliseconds(80)
        }

        if ($ranOsdCmd -or [DateTime]::UtcNow -ge $nextOsdCheck) {
            $curVol = $prevVol
            $curMuted = $prevMuted
            [MediaKeys]::GetVolume([ref]$curVol, [ref]$curMuted)
            $curBright = [MediaKeys]::GetBrightness()
            $volKeyHit = [MediaKeys]::VolumeKeyRecentlyPressed
            if ($volKeyHit) { [MediaKeys]::VolumeKeyRecentlyPressed = $false }

            if ($curVol -ne $prevVol -or $curMuted -ne $prevMuted -or $volKeyHit) {
                $prevVol = $curVol
                $prevMuted = $curMuted
                if (-not $ranOsdCmd) {
                    $osdJson = @{
                        type       = "osd"
                        osdType    = "volume"
                        volume     = $curVol
                        muted      = $curMuted
                        brightness = if ($curBright -ge 0) { $curBright } else { 80 }
                        trigger    = $true
                    } | ConvertTo-Json -Compress
                    [Console]::WriteLine($osdJson)
                }
            } elseif ($curBright -ge 0 -and $prevBright -ge 0 -and $curBright -ne $prevBright) {
                $prevBright = $curBright
                if (-not $ranOsdCmd) {
                    $osdJson = @{
                        type       = "osd"
                        osdType    = "brightness"
                        volume     = $curVol
                        muted      = $curMuted
                        brightness = $curBright
                        trigger    = $true
                    } | ConvertTo-Json -Compress
                    [Console]::WriteLine($osdJson)
                }
            } elseif ($curBright -ge 0 -and $prevBright -lt 0) {
                $prevBright = $curBright
            }

            $nextOsdCheck = [DateTime]::UtcNow.AddMilliseconds(90)
        }

        if ([DateTime]::UtcNow -ge $nextNotifCheck) {
            if ($null -ne $notifListener) {
                try {
                    $notifs = Await ($notifListener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
                    if ($null -ne $notifs) {
                        foreach ($n in $notifs) {
                            if (-not $seenNotifIds.ContainsKey($n.Id)) {
                                $seenNotifIds[$n.Id] = $true
                                $appName = try { [string]$n.AppInfo.DisplayInfo.DisplayName } catch { "Notifikasi" }
                                if ([string]::IsNullOrWhiteSpace($appName)) { $appName = "Notifikasi" }
                                $aumid = try { [string]$n.AppInfo.AppUserModelId } catch { "" }
                                $texts = @()
                                try {
                                    $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                                    if ($null -ne $binding) {
                                        foreach ($el in $binding.GetTextElements()) {
                                            if (-not [string]::IsNullOrWhiteSpace($el.Text)) {
                                                $texts += $el.Text.Trim()
                                            }
                                        }
                                    }
                                } catch {}

                                if ($texts.Count -gt 0) {
                                    $nTitle = $texts[0]
                                    $isWhatsAppNotif = ("$appName $aumid" -match "(?i)whatsapp")
                                    if ($isWhatsAppNotif) {
                                        $script:lastWaSender = $nTitle
                                        $script:lastWaSenderAt = [DateTime]::UtcNow
                                        $firstLine = if ($texts.Count -gt 1) { $texts[1].Trim() } else { "" }
                                        if ([string]::IsNullOrWhiteSpace($firstLine) -or $firstLine -match "^(?i)(message|pesan|new\s+message|pesan\s+baru|\d+\s+(unread\s+)?messages?|\d+\s+pesan.*)$") {
                                            $realMsg = Get-WhatsAppChatMessage $nTitle
                                            if ([string]::IsNullOrWhiteSpace($realMsg) -or $realMsg -match "^(?i)(voice\s*call|video\s*call|panggilan.*)$") {
                                                Start-Sleep -Milliseconds 160
                                                $realMsg = Get-WhatsAppChatMessage $nTitle
                                            }
                                            $nBody = if (-not [string]::IsNullOrWhiteSpace($realMsg)) { $realMsg } else { $firstLine }
                                        } else {
                                            $nBody = $firstLine
                                        }
                                    } else {
                                        $nBody = if ($texts.Count -gt 1) { ($texts[1..($texts.Count - 1)] -join " - ") } else { "" }
                                    }

                                    $combined = "$nTitle $nBody"
                                    $isCall = $combined -match "(?i)(incoming.*call|panggilan.*masuk|panggilan\s+(suara|video)|voice\s+call|video\s+call|calling|memanggil|menelpon|menelepon|dering)"
                                    if ($isCall) {
                                        $lastEmittedCallAt = [DateTime]::UtcNow
                                    }
                                    $isChatApp = ("$appName $aumid" -match "(?i)(whatsapp|telegram|discord|instagram|messenger|line|signal|slack|teams|skype|unigram|messages|chat)") -and ("$appName $aumid" -notmatch "(?i)(snipping|screensketch|screenshot|defender|security|explorer|photos|clock|system)")
                                    $hasToastEdit = $false
                                    $thCheck = [MediaKeys]::LastToastHwnd
                                    if (-not $isCall -and $thCheck -ne [IntPtr]::Zero) {
                                        try {
                                            $tRoot = [System.Windows.Automation.AutomationElement]::FromHandle($thCheck)
                                            if ($null -ne $tRoot) {
                                                $eCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
                                                $eFound = $tRoot.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $eCond)
                                                if ($null -ne $eFound) { $hasToastEdit = $true }
                                            }
                                        } catch {}
                                    }
                                    $canReply = (-not $isCall) -and ($isChatApp -or $hasToastEdit)
                                    $logoB64 = Get-AppLogoBase64 $n.AppInfo $aumid
                                    $notifPayload = @{
                                        type     = "notification"
                                        id       = $n.Id
                                        appName  = $appName
                                        aumid    = $aumid
                                        title    = $nTitle
                                        body     = $nBody
                                        logo     = $logoB64
                                        isCall   = [bool]$isCall
                                        canReply = [bool]$canReply
                                    } | ConvertTo-Json -Compress
                                    [Console]::WriteLine($notifPayload)

                                    if ($isWhatsAppNotif -and -not $isCall) {
                                        $script:pendingWaRecheck = @{
                                            id       = $n.Id
                                            appName  = $appName
                                            aumid    = $aumid
                                            title    = $nTitle
                                            body     = $nBody
                                            logo     = $logoB64
                                            canReply = [bool]$canReply
                                            at       = [DateTime]::UtcNow
                                            tries    = 0
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch {}
            }

            if ($null -ne $script:pendingWaRecheck) {
                $elapsedMs = ([DateTime]::UtcNow - $script:pendingWaRecheck.at).TotalMilliseconds
                if ($elapsedMs -ge 320) {
                    $script:pendingWaRecheck.tries = [int]$script:pendingWaRecheck.tries + 1
                    $updatedMsg = Get-WhatsAppChatMessage $script:pendingWaRecheck.title
                    if (-not [string]::IsNullOrWhiteSpace($updatedMsg) -and $updatedMsg -ne $script:pendingWaRecheck.body -and $updatedMsg -notmatch "^(?i)(voice\s*call|video\s*call)$") {
                        $script:pendingWaRecheck.body = $updatedMsg
                        $rePayload = @{
                            type     = "notification"
                            id       = $script:pendingWaRecheck.id
                            appName  = $script:pendingWaRecheck.appName
                            aumid    = $script:pendingWaRecheck.aumid
                            title    = $script:pendingWaRecheck.title
                            body     = $updatedMsg
                            logo     = $script:pendingWaRecheck.logo
                            isCall   = $false
                            canReply = $script:pendingWaRecheck.canReply
                        } | ConvertTo-Json -Compress
                        [Console]::WriteLine($rePayload)
                        $script:pendingWaRecheck = $null
                    } elseif ($script:pendingWaRecheck.tries -ge 3) {
                        $script:pendingWaRecheck = $null
                    }
                }
            }

            # Check if WhatsApp Desktop spawned a standalone call window
            $waHwnd = [MediaKeys]::LastWhatsAppCallHwnd
            if ($waHwnd -ne [IntPtr]::Zero) {
                $caller = Get-WhatsAppCallCaller $waHwnd
                $isNewCallWin = ($waHwnd -ne $lastSeenWaCallHwnd)
                $isNewCallerName = (-not [string]::IsNullOrWhiteSpace($caller) -and $caller -ne $lastSeenWaCallCaller)
                if ($isNewCallWin -or $isNewCallerName) {
                    $lastSeenWaCallHwnd = $waHwnd
                    if (-not [string]::IsNullOrWhiteSpace($caller)) {
                        $lastSeenWaCallCaller = $caller
                    }
                    if ($isNewCallerName -or ([DateTime]::UtcNow - $lastEmittedCallAt).TotalSeconds -gt 2.0) {
                        $lastEmittedCallAt = [DateTime]::UtcNow
                        $displayTitle = if (-not [string]::IsNullOrWhiteSpace($lastSeenWaCallCaller)) { $lastSeenWaCallCaller } else { "Panggilan WhatsApp" }
                        $waLogo = ""
                        foreach ($k in $script:appLogoCache.Keys) {
                            if ($k -match "(?i)whatsapp") { $waLogo = $script:appLogoCache[$k]; break }
                        }
                        $callPayload = @{
                            type     = "notification"
                            id       = [int]$waHwnd.ToInt64()
                            appName  = "WhatsApp"
                            aumid    = "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"
                            title    = $displayTitle
                            body     = ""
                            logo     = $waLogo
                            isCall   = $true
                            canReply = $false
                        } | ConvertTo-Json -Compress
                        [Console]::WriteLine($callPayload)
                    }
                }
            } elseif ($lastSeenWaCallHwnd -ne [IntPtr]::Zero) {
                $lastSeenWaCallHwnd = [IntPtr]::Zero
                $lastSeenWaCallCaller = ""
                [Console]::WriteLine('{"type":"callEnded"}')
            }

            $nextNotifCheck = [DateTime]::UtcNow.AddMilliseconds(350)
        }

        if ([DateTime]::UtcNow -ge $nextPoll) {
            try {
                $json = Get-MediaStateJson $manager
                [Console]::WriteLine($json)
            } catch {
                [Console]::WriteLine('{"hasMedia":false}')
            }
            $nextPoll = [DateTime]::UtcNow.AddMilliseconds(800)
        }

        if ([DateTime]::UtcNow -ge $nextThermalPoll) {
            try {
                $cpuTempC = $null
                $gpuTempC = $null
                $gpuLoadPct = 0

                $tz = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction SilentlyContinue
                if ($null -ne $tz) {
                    $tzArr = @($tz)
                    foreach ($z in $tzArr) {
                        $tVal = $null
                        if ($null -ne $z.HighPrecisionTemperature -and $z.HighPrecisionTemperature -gt 2500) {
                            $tVal = [math]::Round(($z.HighPrecisionTemperature / 10.0) - 273.15, 1)
                        } elseif ($null -ne $z.Temperature -and $z.Temperature -gt 250) {
                            $tVal = [math]::Round($z.Temperature - 273.15, 1)
                        }
                        if ($null -ne $tVal -and $tVal -gt 15 -and $tVal -lt 115) {
                            if ($null -eq $cpuTempC) { $cpuTempC = $tVal }
                            else { $gpuTempC = $tVal }
                        }
                    }
                }

                try {
                    $gpuEng = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'engtype_3D|engtype_Compute|engtype_VideoDecode' }
                    if ($null -ne $gpuEng) {
                        $sumLoad = ($gpuEng | Measure-Object -Property UtilizationPercentage -Sum).Sum
                        if ($null -ne $sumLoad) {
                            $gpuLoadPct = [int][math]::Max(0, [math]::Min(100, [math]::Round($sumLoad)))
                        }
                    }
                } catch {}

                if ($hasNvidiaSmi) {
                    try {
                        $nvLine = & nvidia-smi.exe --query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1
                        if (-not [string]::IsNullOrWhiteSpace($nvLine)) {
                            $nvParts = $nvLine.Split(',')
                            if ($nvParts.Count -ge 1) {
                                $parsedGpuT = 0.0
                                if ([double]::TryParse($nvParts[0].Trim(), [ref]$parsedGpuT)) { $gpuTempC = $parsedGpuT }
                            }
                            if ($nvParts.Count -ge 2) {
                                $parsedGpuU = 0
                                if ([int]::TryParse($nvParts[1].Trim(), [ref]$parsedGpuU)) { $gpuLoadPct = $parsedGpuU }
                            }
                        }
                    } catch {}
                }

                if ($null -eq $gpuTempC -and $null -ne $cpuTempC) {
                    # On integrated APU (e.g. AMD Ryzen w/ Radeon 760M), GPU shares package die thermal sensor
                    $delta = if ($gpuLoadPct -gt 35) { 1.2 } elseif ($gpuLoadPct -gt 10) { 0.0 } else { -1.4 }
                    $gpuTempC = [math]::Round($cpuTempC + $delta, 1)
                }

                $thermalPayload = @{
                    type     = "thermal"
                    cpuTemp  = if ($null -ne $cpuTempC) { [math]::Round($cpuTempC) } else { $null }
                    gpuTemp  = if ($null -ne $gpuTempC) { [math]::Round($gpuTempC) } else { $null }
                    gpuLoad  = $gpuLoadPct
                    cpuName  = $cachedCpuShort
                    gpuName  = $cachedGpuShort
                } | ConvertTo-Json -Compress
                [Console]::WriteLine($thermalPayload)

                # Detect newly connected Peripherals (Mouse, Earphone/Audio, Keyboard, Bluetooth, USB)
                try {
                    $pnpList = Get-CimInstance Win32_PnPEntity -Filter "Present=TRUE AND (PNPClass='Mouse' OR PNPClass='AudioEndpoint' OR PNPClass='Keyboard' OR PNPClass='Bluetooth' OR PNPClass='Media' OR PNPClass='USB')" -Property DeviceID, Name, PNPClass -ErrorAction SilentlyContinue
                    if ($null -ne $pnpList) {
                        if ($null -eq $script:knownPnpMap) {
                            $script:knownPnpMap = @{}
                            foreach ($d in $pnpList) {
                                if (-not [string]::IsNullOrWhiteSpace($d.DeviceID)) {
                                    $script:knownPnpMap[$d.DeviceID] = @{ Name = [string]$d.Name; Class = [string]$d.PNPClass }
                                }
                            }
                        } else {
                            $currentMap = @{}
                            $emittedBatch = $false
                            foreach ($d in $pnpList) {
                                $did = [string]$d.DeviceID
                                if ([string]::IsNullOrWhiteSpace($did)) { continue }
                                $dName = [string]$d.Name
                                $dClass = [string]$d.PNPClass
                                $currentMap[$did] = @{ Name = $dName; Class = $dClass }
                                if (-not $script:knownPnpMap.ContainsKey($did) -and -not $emittedBatch) {
                                    if ($dName -match "(?i)(root hub|host controller|composite device|generic bluetooth adapter|enumerator|service|protocol|avin|rfcomm|avrcp|a2dp)") { continue }
                                    $cat = "usb"
                                    $friendly = $dName
                                    if ($dClass -eq "Mouse" -or $dName -match "(?i)mouse") {
                                        $cat = "mouse"
                                        if ($friendly -match "(?i)HID-compliant mouse") { $friendly = "Mouse Eksternal" }
                                    } elseif ($dClass -eq "AudioEndpoint" -or $dClass -eq "Media" -or $dName -match "(?i)(headphone|headset|earphone|earbuds|airpods|speaker|microphone|hands-free|audio)") {
                                        $cat = "audio"
                                    } elseif ($dClass -eq "Keyboard" -or $dName -match "(?i)keyboard") {
                                        $cat = "keyboard"
                                        if ($friendly -match "(?i)HID Keyboard Device") { $friendly = "Keyboard Eksternal" }
                                    } elseif ($dClass -eq "Bluetooth") {
                                        $cat = "bluetooth"
                                    }
                                    $devPayload = @{
                                        type     = "device"
                                        event    = "connected"
                                        category = $cat
                                        name     = $friendly
                                    } | ConvertTo-Json -Compress
                                    [Console]::WriteLine($devPayload)
                                    $emittedBatch = $true
                                }
                            }
                            $script:knownPnpMap = $currentMap
                        }
                    }
                } catch {}
            } catch {}
            $nextThermalPoll = [DateTime]::UtcNow.AddMilliseconds(2600)
        }

        Start-Sleep -Milliseconds 15
    }
} else {
    Write-Output (Get-MediaStateJson $manager)
}
