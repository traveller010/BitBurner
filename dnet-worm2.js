const reportedUnknowns = new Set();
const reportedSpecs = new Set();
const reportedStalls = new Set();
const deadTopology = new Set();
const localCooldowns = new Map();
const dataFilesCopied = new Set();
const WORM_COST = 13;
const BOOTSTRAP_COST = 6;
let activeBootstrapTasks = new Set();
const WORM_VERSION = "v1.3.75";
const BOOTSTRAP_VERSION = "v1.3.75";
let globalPasswordVault = {};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();

    function getTimestamp() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const kk = String(d.getMilliseconds()).padStart(3, '0');
        return hh + ":" + mm + ":" + ss + ":" + kk;
    }

    if (currentHost === "home") {
        const loggerScript = "dnet-logger.js";
        ns.write("darknet-diagnostics.txt", "=== RESET LINE: NEW BASELINE RUN STARTED AT " + getTimestamp() + " ===\n", "w");
        ns.write("darknet-success.txt", "=== RESET LINE: NEW BASELINE RUN STARTED AT " + getTimestamp() + " ===\n", "w");
        if (!ns.scriptRunning(loggerScript, "home")) {
            if (ns.fileExists(loggerScript, "home")) ns.exec(loggerScript, "home");
        }
        if (ns.fileExists("darknet-keys.txt", "home")) {
            try {
                const fileData = ns.read("darknet-keys.txt");
                if (fileData) {
                    globalPasswordVault = JSON.parse(fileData);
                    ns.tryWritePort(15, `[VAULT-INIT] [${getTimestamp()}] Successfully loaded entry map from darknet-keys.txt`);
                }
            } catch (e) {
                ns.tryWritePort(14, `[VAULT-INIT-ERR] [${getTimestamp()}] Failed loading darknet-keys.txt: ${e}`);
            }
        }
    } else {
        try {
            if (ns.fileExists("darknet-keys.txt", "home")) {
                if (ns.scp("darknet-keys.txt", currentHost, "home")) {
                    const fileData = ns.read("darknet-keys.txt");
                    if (fileData) {
                        const remoteVault = JSON.parse(fileData);
                        globalPasswordVault = Object.assign({}, remoteVault, globalPasswordVault);
                        if (typeof globalPasswordVault[currentHost] === 'string') {
                            ns.dnet.connectToSession(currentHost, globalPasswordVault[currentHost]);
                        }
                    }
                }
            }
        } catch (e) {
            ns.tryWritePort(14, `[KEY-SYNC-ERR] [${getTimestamp()}] Host ${currentHost} sync update exception: ${e}`);
        }
    }

    while (true) {
        if (currentHost === "home") {
            let portUpdate = ns.readPort(17);
            let vaultUpdated = false;
            while (portUpdate !== "NULL PORT DATA" && portUpdate !== "NULL DATA" && portUpdate) {
                try {
                    const update = JSON.parse(portUpdate);
                    if (update.host && update.pass) {
                        if (globalPasswordVault[update.host] !== update.pass) {
                            globalPasswordVault[update.host] = update.pass;
                            vaultUpdated = true;
                        }
                    }
                } catch (e) { }
                portUpdate = ns.readPort(17);
            }
            if (vaultUpdated) {
                ns.write("darknet-keys.txt", JSON.stringify(globalPasswordVault), "w");
            }
        }

        let taskFinished = ns.readPort(18);
        while (taskFinished !== "NULL PORT DATA" && taskFinished !== "NULL DATA" && taskFinished) {
            activeBootstrapTasks.delete(taskFinished);
            taskFinished = ns.readPort(18);
        }

        const nearbyServers = ns.dnet.probe();
        for (const hostname of nearbyServers) {
            const details = ns.dnet.getServerDetails(hostname);
            if (acquireNetworkLock(ns, hostname, details.modelId)) {
                try {
                    const authResult = await serverSolver(ns, hostname, getTimestamp);
                    if (authResult && authResult.success && authResult.password) {
                        if (globalPasswordVault[hostname] !== authResult.password) {
                            globalPasswordVault[hostname] = authResult.password;
                            ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: authResult.password }));
                        }
                    }
                } finally {
                    releaseNetworkLock(ns, hostname);
                }
            }
        }
        await ns.sleep(2000);
    }
}

async function serverSolver(ns, hostname, getTimestamp) {
    const details = ns.dnet.getServerDetails(hostname);
    if (details.modelId === "(The Labyrinth)") {
        return await solveLabyrinth(ns, hostname);
    }
    return await executeCrackingMatrix(ns, hostname, details, getTimestamp);
}

async function solveLabyrinth(ns, hostname) {
    const homeHost = "home";
    const saveFile = `maze-grid-${hostname}.txt`;
    let globalGrid = {};
    let moveStack = [];

    if (ns.fileExists(saveFile, homeHost)) {
        try { globalGrid = JSON.parse(ns.read(saveFile)); } catch (e) { ns.tryWritePort(14, `[GRID-ERR] ${e}`); }
    }

    while (true) {
        let labReport = await ns.dnet.labreport(hostname);
        if (!labReport || !labReport.coords) break;

        let curKey = `${labReport.coords[0]},${labReport.coords[1]}`;
        ns.tryWritePort(14, `[LAB-POS] [${hostname}] At: ${curKey}`);

        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
        if (hb?.logs) {
            let logStr = JSON.stringify(hb.logs);
            if (logStr.includes("!!")) {
                let finalPass = logStr.match(/!!([^!!]+)!!/)?.[1] || "";
                if ((await ns.dnet.authenticate(hostname, finalPass)).success) {
                    for (let file of ns.ls(hostname).filter(f => f.endsWith(".cache"))) {
                        await ns.dnet.openCache(file);
                    }
                    ns.write(saveFile, "", "w");
                    return { success: true, password: finalPass };
                }
            }
        }

        if (!globalGrid[curKey]) {
            globalGrid[curKey] = { north: labReport.north, south: labReport.south, east: labReport.east, west: labReport.west };
        }

        let move = null;
        for (let dir of ["north", "south", "east", "west"]) {
            if (labReport[dir] === true && !globalGrid[`${curKey}-${dir}`]) {
                move = dir;
                break;
            }
        }

        if (move) {
            globalGrid[`${curKey}-${move}`] = true;
            moveStack.push({ key: curKey, dir: move });
            await ns.dnet.authenticate(hostname, `go ${move}`);
        } else if (moveStack.length > 0) {
            let last = moveStack.pop();
            const opposites = { north: "south", south: "north", east: "west", west: "east" };
            await ns.dnet.authenticate(hostname, `go ${opposites[last.dir]}`);
        } else break;

        ns.write(saveFile, JSON.stringify(globalGrid), "w");
        await ns.sleep(0);
    }
    return { success: false };
}

// ... [INSERT ALL YOUR OTHER ORIGINAL executeCrackingMatrix CASES HERE] ...

function acquireNetworkLock(ns, hostname, modelId) {
    if (modelId === "(The Labyrinth)") return true;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lockPort = 10 + Math.abs(hash % 4);
    let locks = JSON.parse(ns.readPort(lockPort) || "[]");
    if (locks.find(l => l.host === hostname)) return false;
    locks.push({ host: hostname, acquiredAt: Date.now() });
    ns.writePort(lockPort, JSON.stringify(locks));
    return true;
}

function releaseNetworkLock(ns, hostname) {
    if (hostname.includes("l4byr1nth")) return;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lockPort = 10 + Math.abs(hash % 4);
    let locks = JSON.parse(ns.readPort(lockPort) || "[]").filter(l => l.host !== hostname);
    ns.writePort(lockPort, JSON.stringify(locks));
}
