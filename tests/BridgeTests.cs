using System;
class BridgeTests
{
    static int Main(string[] args)
    {
        // A running client with no UIA window models startup directly into the tray.
        // The JS regression test selects this process by its exact executable path.
        if (args.Length == 1 && args[0] == "--headless-client") {
            Console.WriteLine("ready");
            Console.Out.Flush();
            System.Threading.Thread.Sleep(30000);
            return 0;
        }
        string[,] cases = {
            {"Подключено", "connected"}, {"Connected", "connected"},
            {"Disconnected", "disconnected"}, {"Отключено", "disconnected"},
            {"Подключение...", "busy"}, {"Disconnecting…", "busy"},
            {"Переподключение", "busy"}, {"Ошибка", "error"},
            {"Not connected to server 1", "unknown"}, {"", "unknown"},
            {"Disconnect", "unknown"}, {"Connect", "disconnected"},
            {"Подключиться", "disconnected"}, {"Подключить", "disconnected"}
        };
        for (int i = 0; i < cases.GetLength(0); i++)
            if (AmneziaBridge.ParseState(cases[i, 0]) != cases[i, 1]) {
                Console.WriteLine("FAIL: " + cases[i, 0]); return 1;
            }
        Console.WriteLine("PASS: " + cases.GetLength(0) + " bridge state parsing cases; no UI invocation");
        var options = new AmneziaBridge.Options { connectedText = "Verbunden", disconnectedText = "Verbinden" };
        AmneziaBridge.ValidateOptions(options);
        if (AmneziaBridge.ParseState("Verbunden", options) != "connected" ||
            AmneziaBridge.ParseState("Verbinden", options) != "disconnected" ||
            AmneziaBridge.ParseState("Connecting...", options) != "busy" ||
            AmneziaBridge.ParseState("unrelated", options) != "unknown") return 1;
        try {
            AmneziaBridge.ValidateOptions(new AmneziaBridge.Options { connectedText = "Connect", disconnectedText = "Connected" });
            return 1;
        } catch (ArgumentException) { }
        Console.WriteLine("PASS: custom language labels and conflicting-label rejection");
        return 0;
    }
}
