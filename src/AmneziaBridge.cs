using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Pipes;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;

// No service control commands, configuration access, or screen-coordinate clicks.
// UI Automation calls run in this short-lived process so the host can time them out.
class AmneziaBridge
{
    public class Options {
        public string executablePath = "";
        public string connectedText = "";
        public string disconnectedText = "";
    }
    const string ButtonId = "AmneziaApplication.mainWindow.tabBarStackView.connectButton";
    const string WindowId = "AmneziaApplication.mainWindow";
    delegate bool EnumWindowProc(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowProc callback, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    public static string ParseState(string name)
    {
        string text = (name ?? "").Trim().ToLowerInvariant().Replace("…", "").TrimEnd('.');
        switch (text)
        {
            case "подключено": case "connected": return "connected";
            case "отключено": case "отключен": case "не подключено":
            case "подключиться": case "подключить": case "connect":
            case "disconnected": return "disconnected";
            case "подключение": case "отключение": case "переподключение":
            case "подготовка": case "connecting": case "disconnecting":
            case "reconnecting": case "preparing": return "busy";
            case "ошибка": case "error": return "error";
            default: return "unknown";
        }
    }

    static string TextKey(string text) { return (text ?? "").Trim().ToLowerInvariant().Replace("…", "").TrimEnd('.'); }

    public static string ParseState(string name, Options options) {
        string standard = ParseState(name);
        if (standard != "unknown") return standard;
        string key = TextKey(name);
        if (key.Length > 0 && key == TextKey(options.connectedText)) return "connected";
        if (key.Length > 0 && key == TextKey(options.disconnectedText)) return "disconnected";
        return "unknown";
    }

    public static void ValidateOptions(Options options) {
        string on = TextKey(options.connectedText), off = TextKey(options.disconnectedText);
        if ((on.Length == 0) != (off.Length == 0) || (on.Length > 0 && on == off) || on.Length > 80 || off.Length > 80)
            throw new ArgumentException("Invalid state labels");
        if ((on.Length > 0 && ParseState(on) != "unknown" && ParseState(on) != "connected") ||
            (off.Length > 0 && ParseState(off) != "unknown" && ParseState(off) != "disconnected"))
            throw new ArgumentException("State labels conflict with built-in states");
        if (!String.IsNullOrEmpty(options.executablePath) && (!Path.IsPathRooted(options.executablePath) ||
            options.executablePath.StartsWith(@"\\") || !options.executablePath.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Invalid executable path");
    }

    static AutomationElement FindButton(HashSet<uint> pids, out IntPtr mainWindow)
    {
        AutomationElement found = null;
        IntPtr candidate = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hwnd, IntPtr data) {
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (!pids.Contains(pid)) return true;
            try {
                AutomationElement root = AutomationElement.FromHandle(hwnd);
                if (root.Current.AutomationId != WindowId) return true;
                candidate = hwnd;
                var button = root.FindFirst(TreeScope.Descendants,
                    new AndCondition(new PropertyCondition(AutomationElement.AutomationIdProperty, ButtonId),
                        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button)));
                if (button != null) { found = button; return false; }
            } catch (ElementNotAvailableException) { }
            return true;
        }, IntPtr.Zero);
        mainWindow = candidate;
        return found;
    }

    static object Result(string state, string detail, bool invoked)
    {
        return new { state = state, detail = detail, invoked = invoked };
    }

    static object Run(string[] args)
    {
        Options options = new Options();
        if (args.Length >= 3 && args[args.Length - 2] == "--config") {
            options = new JavaScriptSerializer().Deserialize<Options>(Encoding.UTF8.GetString(Convert.FromBase64String(args[args.Length - 1])));
            Array.Resize(ref args, args.Length - 2);
        }
        ValidateOptions(options);
        // Control needs an explicit desired state AND an explicit allow flag.
        bool control = args.Length == 3 && args[0] == "set" && args[2] == "--allow-control";
        if (!(args.Length == 1 && args[0] == "status") && !control)
            return Result("unknown", "Invalid arguments", false);
        string desired = control ? args[1] : "";
        if (control && desired != "connected" && desired != "disconnected")
            return Result("unknown", "Invalid desired state", false);
        var pids = new HashSet<uint>();
        string executable = options.executablePath;
        if (!String.IsNullOrEmpty(executable) && !File.Exists(executable)) return Result("unavailable", "Указанный .exe не найден. Исправьте путь или очистите его для автопоиска.", false);
        string processName = String.IsNullOrEmpty(executable) ? "AmneziaVPN" : Path.GetFileNameWithoutExtension(executable);
        string appPath = "", appVersion = "";
        foreach (Process process in Process.GetProcessesByName(processName)) {
            using (process) {
                try {
                    string foundPath = process.MainModule.FileName;
                    if (!String.IsNullOrEmpty(executable) && !String.Equals(Path.GetFullPath(executable), foundPath, StringComparison.OrdinalIgnoreCase)) continue;
                    pids.Add((uint)process.Id);
                    appPath = foundPath;
                    appVersion = process.MainModule.FileVersionInfo.FileVersion;
                } catch (System.ComponentModel.Win32Exception) {
                    return Result("unknown", "Нет доступа к процессу Amnezia. Запустите AJAZZ и Amnezia с одинаковыми правами.", false);
                }
            }
        }
        if (pids.Count == 0) return Result("unavailable", "AmneziaVPN не запущена", false);
        if (pids.Count > 1) return Result("unknown", "Найдено несколько клиентов. Укажите путь к нужному .exe в настройках плагина.", false);
        IntPtr hwnd;
        AutomationElement button = FindButton(pids, out hwnd);
        bool revealed = false;
        // Qt removes hidden QML controls from UIA. Native ShowWindow alone does NOT
        // update QML visibility. Use Amnezia's own second-instance notification to
        // show its window, then invoke the real button and close back to the tray.
        // Monitoring never enters this path.
        // At tray-only startup the process exists before Qt exposes its main
        // window to UIA. A missing handle is not evidence of a visible window.
        bool windowUninitialized = hwnd == IntPtr.Zero;
        bool wasHidden = !windowUninitialized && !IsWindowVisible(hwnd);
        bool wasMinimized = hwnd != IntPtr.Zero && IsIconic(hwnd);
        string windowState = windowUninitialized ? "uninitialized" : wasHidden ? "hidden" : wasMinimized ? "minimized" : "visible";
        IntPtr originalWindow = hwnd;
        try {
            if (control && button == null && (windowUninitialized || wasHidden || wasMinimized)) {
                revealed = true;
                using (var instance = new NamedPipeClientStream(".", "AmneziaVPNInstance", PipeDirection.InOut)) {
                    instance.Connect(500); // Connection alone requests raiseMainWindow.
                }
                for (int attempt = 0; attempt < 15 && button == null; attempt++) {
                    Thread.Sleep(100);
                    button = FindButton(pids, out hwnd);
                    if (originalWindow == IntPtr.Zero && hwnd != IntPtr.Zero) originalWindow = hwnd;
                }
                if (button != null) ShowWindowAsync(hwnd, 7);
            }
            if (button == null)
                return new { state = "unknown", detail = windowUninitialized ? "AmneziaVPN запущена, окно ещё недоступно" : "Откройте главную вкладку AmneziaVPN",
                    invoked = false, backgroundAvailable = !control && (windowUninitialized || wasHidden || wasMinimized), windowState = windowState,
                    applicationPath = appPath, applicationVersion = appVersion };
            string state = ParseState(button.Current.Name, options);
            if (!control) {
                object availablePattern;
                bool canInvoke = button.Current.IsEnabled && button.TryGetCurrentPattern(InvokePattern.Pattern, out availablePattern);
                return new { state = state, detail = state == "unknown" ? "Подпись кнопки не распознана. Укажите её язык в настройках плагина." : "Состояние получено от AmneziaVPN",
                    invoked = false, canInvoke = canInvoke, windowState = windowState, applicationPath = appPath, applicationVersion = appVersion };
            }
            if (state == desired) return Result(state, "Уже в нужном состоянии", false);
            if (state != "connected" && state != "disconnected")
                return Result(state, "Переключение недоступно в текущем состоянии", false);
            if (!button.Current.IsEnabled)
                return Result("busy", "Кнопка AmneziaVPN недоступна", false);
            object pattern;
            if (!button.TryGetCurrentPattern(InvokePattern.Pattern, out pattern))
                return Result("unknown", "Кнопка не поддерживает InvokePattern", false);
            // Re-read immediately before invocation; never invert a stale state.
            string fresh = ParseState(button.Current.Name, options);
            if (fresh == desired) return Result(fresh, "Состояние уже изменилось", false);
            if (fresh != state) return Result("busy", "Состояние изменилось", false);
            ((InvokePattern)pattern).Invoke();
            return Result("busy", "Команда передана AmneziaVPN", true);
        } finally {
            if (revealed && originalWindow != IntPtr.Zero) {
                uint owner;
                GetWindowThreadProcessId(originalWindow, out owner);
                if (pids.Contains(owner)) {
                    // WM_CLOSE is intercepted by Amnezia to hide to tray, not quit.
                    // Unlike SW_HIDE it also restores Qt's internal visibility state.
                    if (wasHidden || windowUninitialized) PostMessage(originalWindow, 0x0010, IntPtr.Zero, IntPtr.Zero);
                    else ShowWindowAsync(originalWindow, 7);
                }
            }
        }
    }

    [STAThread]
    static void Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try { Console.WriteLine(new JavaScriptSerializer().Serialize(Run(args))); }
        catch (Exception e) {
            // Do not include UI text, server addresses or account details in errors.
            Console.WriteLine(new JavaScriptSerializer().Serialize(Result("unknown", e.GetType().Name, false)));
        }
    }
}
