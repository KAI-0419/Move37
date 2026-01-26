import { spawn, ChildProcess } from "child_process";

// Helper to spawn a process and pipe output
function runScript(command: string, args: string[], prefix: string, color: string) {
    console.log(`${color}[${prefix}] Starting...${"\x1b[0m"}`);

    const child = spawn(command, args, {
        stdio: "inherit",
        shell: true,
    });

    child.on("close", (code) => {
        if (code !== 0 && code !== null) {
            console.error(`${color}[${prefix}] Exited with code ${code}${"\x1b[0m"}`);
        }
    });

    return child;
}

async function dev() {
    const processes: ChildProcess[] = [];

    // Start Server
    processes.push(runScript("tsx", ["server/index.ts"], "server", "\x1b[32m")); // Green

    // Start WASM Watcher
    processes.push(runScript("tsx", ["script/watch-wasm.ts"], "wasm", "\x1b[36m")); // Cyan

    // Handle exit
    const cleanup = () => {
        console.log("\nShutting down...");
        processes.forEach((p) => p.kill());
        process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
}

dev().catch(console.error);
