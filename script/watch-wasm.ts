import chokidar from "chokidar";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import fg from "fast-glob";

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    magenta: "\x1b[35m",
};

const LOG_PREFIX = `${colors.cyan}[wasm-watch]${colors.reset}`;

function log(message: string) {
    console.log(`${LOG_PREFIX} ${message}`);
}

function error(message: string) {
    console.error(`${LOG_PREFIX} ${colors.red}${message}${colors.reset}`);
}

// Debounce helper
function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Find the nearest Cargo.toml directory
function findCargoDir(filePath: string): string | null {
    let currentDir = path.dirname(filePath);
    while (currentDir !== path.parse(currentDir).root) {
        if (fs.existsSync(path.join(currentDir, "Cargo.toml"))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

// Track active builds to prevent overlapping builds for the same crate
const activeBuilds = new Set<string>();
const pendingBuilds = new Set<string>();

async function buildWasm(crateDir: string) {
    // If no Cargo.toml, skip
    if (!fs.existsSync(path.join(crateDir, "Cargo.toml"))) return;

    if (activeBuilds.has(crateDir)) {
        pendingBuilds.add(crateDir);
        return;
    }

    activeBuilds.add(crateDir);
    const crateName = path.basename(crateDir);
    const start = Date.now();

    log(`Building ${colors.yellow}${crateName}${colors.reset}...`);

    const child = spawn("wasm-pack", ["build", "--target", "web", "--release"], {
        cwd: crateDir,
        stdio: "inherit",
        shell: true,
    });

    child.on("close", (code) => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        activeBuilds.delete(crateDir);

        if (code === 0) {
            log(`${colors.green}Build success${colors.reset} for ${crateName} in ${duration}s`);
        } else {
            error(`Build failed for ${crateName} (exit code: ${code})`);
        }

        if (pendingBuilds.has(crateDir)) {
            pendingBuilds.delete(crateDir);
            buildWasm(crateDir);
        }
    });
}

async function startWatcher() {
    log("Starting WASM watcher...");

    // Scan for observable crates first to inform the user
    const gameDir = "client/src/lib/games";
    const cargoFiles = await fg(`${gameDir}/**/Cargo.toml`, {
        ignore: ["**/target/**", "**/pkg/**", "**/node_modules/**"],
    });

    if (cargoFiles.length === 0) {
        log(`${colors.yellow}No Rust crates found in ${gameDir}. Watcher is idle.${colors.reset}`);
    } else {
        log(`${colors.green}Detected ${cargoFiles.length} Rust crate(s) to watch:${colors.reset}`);
        cargoFiles.forEach((f) => {
            // f is like client/src/lib/games/entropy/wasm/Cargo.toml
            // We want to show 'entropy/wasm' or just 'entropy' depending on structure
            // Let's show relative path from games dir
            const relPath = path.relative(gameDir, path.dirname(f));
            log(` - ${colors.magenta}${relPath}${colors.reset}`);
        });
    }

    const watchPaths = [
        `${gameDir}/**/*.rs`,
        `${gameDir}/**/Cargo.toml`,
    ];

    const watcher = chokidar.watch(watchPaths, {
        ignored: [
            /(^|[\/\\])\../, // dotfiles
            "**/target/**",
            "**/pkg/**",
            "**/node_modules/**"
        ],
        persistent: true,
        ignoreInitial: true,
    });

    const handleFileChange = debounce((filePath: string) => {
        const cargoDir = findCargoDir(filePath);
        if (cargoDir) {
            log(`Change detected: ${colors.gray}${path.relative(process.cwd(), filePath)}${colors.reset}`);
            buildWasm(cargoDir);
        }
    }, 300);

    watcher
        .on("add", handleFileChange)
        .on("change", handleFileChange)
        .on("unlink", handleFileChange)
        .on("error", (err) => error(`Watcher error: ${err}`));

    log(`Watching for changes...`);
}

startWatcher().catch(e => error(String(e)));
