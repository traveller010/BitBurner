const reportedUnknowns = new Set();
const reportedSpecs = new Set();
const reportedStalls = new Set();
const deadTopology = new Set();
const localCooldowns = new Map();
const dataFilesCopied = new Set();
const WORM_COST = 13;
const WORM_VERSION = "v1.3.72";
const BOOTSTRAP_VERSION = "v1.3.72";

// Master Password Vault tracking keys across the entire darknet cluster
let globalPasswordVault = {};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();

    // Helper to format clean, readable timestamps (hh:mm:ss:kk)
    function getTimestamp() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const kk = String(d.getMilliseconds()).padStart(3, '0');
        return hh + ":" + mm + ":" + ss + ":" + kk;
    }

    // =========================================================================
    // 🛰️ MASTER CLEAN STATE INITIALIZATION MATRIX & KEY-FILE INGESTION
    // =========================================================================
    if (currentHost === "home") {
        const loggerScript = "dnet-logger.js";

        ns.write("darknet-diagnostics.txt", "=== RESET LINE: NEW BASELINE RUN STARTED AT " + getTimestamp() + " ===\n", "w");
        ns.write("darknet-success.txt", "=== RESET LINE: NEW BASELINE RUN STARTED AT " + getTimestamp() + " ===\n", "w");

        if (!ns.scriptRunning(loggerScript, "home")) {
            if (ns.fileExists(loggerScript, "home")) {
                ns.exec(loggerScript, "home");
            }
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

    // =========================================================================
    // 🔓 INSTANT LOCAL CACHE MONITORS (BOOT PHASE ONE-SHOT RUN)
    // =========================================================================
    const localCaches = ns.ls(currentHost, ".cache");
    for (const cacheFile of localCaches) {
        try {
            await ns.dnet.openCache(cacheFile);
            ns.tryWritePort(15, `[LOOT-SUCCESS] [${currentHost}] Activated reward context for ${cacheFile}`);
        } catch (e) {
            ns.tryWritePort(14, `[CACHE-ERR] [${getTimestamp()}] [${currentHost}] Local decryption bypass exception on ${cacheFile}: ${e}`);
        }
    }

    // Secondary payload execution loop
    while (true) {
        // Ongoing Background Vault Synchronization and Key Aggregation
        if (currentHost === "home") {
            let portUpdate = ns.readPort(17);
            let vaultUpdated = false;

            while (portUpdate !== "NULL PORT DATA" && portUpdate !== "NULL DATA" && portUpdate) {
                try {
                    const updatePayload = JSON.parse(portUpdate);
                    if (updatePayload.host && typeof updatePayload.pass === 'string') {
                        if (globalPasswordVault[updatePayload.host] !== updatePayload.pass) {
                            globalPasswordVault[updatePayload.host] = updatePayload.pass;
                            vaultUpdated = true;
                        }
                    }
                } catch (e) {
                    ns.tryWritePort(14, `[KEY-SYNC-ERR] [${getTimestamp()}] In RAM processing failure: ${e}`);
                }
                portUpdate = ns.readPort(17);
            }

            if (vaultUpdated) {
                ns.write("darknet-keys.txt", JSON.stringify(globalPasswordVault), "w");
            }

            // =========================================================================
            // 📝 CENTRALIZED DICTIONARY HARVESTER MATRIX (HOME AGGREGATOR)
            // =========================================================================
            try {
                let discoveredWords = new Set();
                if (ns.fileExists("darknet-words.txt", "home")) {
                    ns.read("darknet-words.txt").split("\n").forEach(w => { if (w.trim()) discoveredWords.add(w.trim()); });
                }

                const homeFiles = ns.ls("home");
                for (const file of homeFiles) {
                    if (file.endsWith(".txt") && file !== "darknet-diagnostics.txt" && file !== "darknet-success.txt" && file !== "darknet-words.txt" && file !== "darknet-keys.txt") {
                        const content = ns.read(file);
                        const matches = content.match(/[a-zA-Z0-9_]+/g) || [];
                        for (const word of matches) {
                            if (word.length >= 3 && word.length <= 14) discoveredWords.add(word);
                        }
                    }
                }
                if (discoveredWords.size > 0) {
                    ns.write("darknet-words.txt", Array.from(discoveredWords).join("\n"), "w");
                }
            } catch (e) {
                ns.tryWritePort(14, `[WORD-HARVEST-ERR] ${e}`);
            }
        } else {
            try {
                if (ns.fileExists("darknet-words.txt", "home")) {
                    ns.scp("darknet-words.txt", currentHost, "home");
                }
            } catch (e) { }
        }

        // Exfiltrate standard loot markers (.txt ONLY) from local directory structures back to home base
        const activeFiles = ns.ls(currentHost);
        for (let i = 0; i < activeFiles.length; i++) {
            const aFile = activeFiles[i];
            if (!aFile.endsWith(".txt")) continue;
            if (aFile === "darknet-diagnostics.txt" || aFile === "darknet-success.txt" || aFile === "infil-log.txt" || aFile === "darknet-words.txt") continue;

            const fileKey = currentHost + ":" + aFile;

            if (!dataFilesCopied.has(fileKey)) {
                try {
                    const success = ns.scp(aFile, "home", currentHost);
                    if (success) {
                        dataFilesCopied.add(fileKey);
                        ns.tryWritePort(15, "[DATA-FILE] [" + getTimestamp() + "] [" + WORM_VERSION + "] [" + currentHost + "]: Harvested " + aFile);
                    }
                } catch (e) {
                    ns.tryWritePort(14, "[EXCEPTION20] [" + getTimestamp() + "] [" + WORM_VERSION + "] File Error on " + currentHost + " for " + aFile + " - " + e);
                }
            }
        }

        const nearbyServers = ns.dnet.probe();
        const prioritizedTargets = nearbyServers.map(hostname => {
            try {
                const details = ns.dnet.getServerDetails(hostname);
                return { hostname, depth: details.depth || 0, modelId: details.modelId };
            } catch (e) {
                ns.tryWritePort(14, "[EXCEPTION6] [" + getTimestamp() + "] [" + WORM_VERSION + "] - " + e);
                return { hostname, depth: 0, modelId: "Unknown" };
            }
        }).sort((a, b) => b.depth - a.depth);

        // =========================================================================
        // 🌀 DISTRIBUTED TRIAGE AND COLONIZATION LOOP
        // =========================================================================
        for (const target of prioritizedTargets) {
            const hostname = target.hostname;
            if (hostname == null) continue;
            const isLabyrinth = target.modelId === "(The Labyrinth)" || hostname === "ub3r_l4byr1nth" || hostname === "th3_l4byr1nth";

            const authResult = await serverSolver(ns, hostname, getTimestamp);
            if (!authResult || !authResult.success) continue;

            const bootstrapper = "dnet-bootstrap.js";
            
            // Analyze remote execution contexts cleanly from the outside
            let targetProcesses = ns.ps(hostname);
            let runningWormInstance = targetProcesses.find(p => p.filename === scriptName);

            const isLocalNewer = (local, remote) => {
                const l = String(local).replace(/[^0-9.]/g, '').split('.').map(Number);
                const r = String(remote).replace(/[^0-9.]/g, '').split('.').map(Number);
                for (let i = 0; i < Math.max(l.length, r.length); i++) {
                    if ((l[i] || 0) > (r[i] || 0)) return true;
                    if ((l[i] || 0) < (r[i] || 0)) return false;
                }
                return false;
            };

            // 🔄 CRITICAL FUNCTIONALITY PRESERVED: Hot-Upgrade Outdated Monoliths
            if (runningWormInstance) {
                let remoteVersion = runningWormInstance.args[0] || "v0.0.0";
                if (remoteVersion !== WORM_VERSION && isLocalNewer(WORM_VERSION, remoteVersion)) {
                    ns.tryWritePort(14, "[HOT-UPGRADE] [" + getTimestamp() + "] [" + WORM_VERSION + "] Upgrading outdated worm on " + hostname + " from " + remoteVersion + "...");
                    ns.kill(runningWormInstance.pid);
                } else {
                    continue; 
                }
            }

            const targetMaxRam = ns.getServerMaxRam(hostname);
            const targetUsedRam = ns.getServerUsedRam(hostname);
            let targetFreeRam = targetMaxRam - targetUsedRam;

            // 🛑 TIER 1: CORE MEMORY STARVATION FALLBACK (< 4GB)
            if (targetMaxRam < 4) {
                try {
                    await ns.dnet.induceServerMigration(hostname);
                } catch (e) {
                    ns.tryWritePort(14, `[MIGRATION-ERR] [${getTimestamp()}] Failed migration on ${hostname}: ${e}`);
                }
                continue;
            }

            // 🔑 CRITICAL FUNCTIONALITY PRESERVED: Password Vault Core Synced to Ports
            if (typeof authResult.password === 'string') {
                globalPasswordVault[hostname] = authResult.password;
                try {
                    ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: authResult.password }));
                } catch (e) {
                    ns.tryWritePort(14, "[EXCEPTION-5] [" + getTimestamp() + "] [" + WORM_VERSION + "] Vault Port Synchronization Failure for " + hostname + " - " + e);
                }
            }

            // ⚡ TIER 2: ASYNC PARENT-HOSTED REMOTE REALLOCATION (4GB to < 15GB)
            if (targetMaxRam < WORM_COST) {
                // Check local memory of the current parent server to scale thread allocation safely
                const localFreeRam = ns.getServerMaxRam(currentHost) - ns.getServerUsedRam(currentHost);
                let optimalThreads = Math.floor(localFreeRam / BOOTSTRAP_COST);

                // Check if an allocation task is already targeting this host from this parent
                let parentProcesses = ns.ps(currentHost);
                let activeTask = parentProcesses.find(p => p.filename === bootstrapper && p.args[1] === hostname);

                if (!activeTask && optimalThreads > 0) {
                    // Pre-stage the binary file map onto the target ahead of execution
                    ns.scp(scriptName, hostname, currentHost);
                    
                    // Run the reallocator locally on Server A targeting Server B remotely
                    ns.exec(bootstrapper, currentHost, { threads: optimalThreads }, WORM_VERSION, hostname);
                }
                continue;
            }

            // 🚀 TIER 3: DIRECT MONOLITH COLONIZATION (>= 15GB)
            if (targetMaxRam >= WORM_COST) {
                try {
                    ns.scp(scriptName, hostname, currentHost);
                } catch (e) {
                    ns.tryWritePort(14, "[EXCEPTION] SCP Transfer Failure to " + hostname + " - " + e);
                }

                if (authResult.alreadyActive) {
                    try {
                        ns.exec(scriptName, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION, BOOTSTRAP_VERSION);
                    } catch (e) {
                        ns.tryWritePort(14, "[EXCEPTION-4] [" + getTimestamp() + "] [" + WORM_VERSION + "] Legacy Handoff Execution Failure on " + hostname + " - " + e);
                    }
                    continue;
                }

                // 📦 CRITICAL FUNCTIONALITY PRESERVED: Labyrinth Looter Script Branching
                if (!isLabyrinth) {
                    try {
                        ns.exec(scriptName, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION, BOOTSTRAP_VERSION);
                    } catch (e) {
                        ns.tryWritePort(14, "[EXCEPTION-6] [" + getTimestamp() + "] [" + WORM_VERSION + "] Primary Colonization Invocation Failure on " + hostname + " - " + e);
                    }
                } else {
                    try {
                        const looterScript = "dnet-loot.js";
                        const looterCode = `export async function main(ns) {
                            const host = ns.getHostname();
                            const caches = ns.ls(host, '.cache');
                            for (const file of caches) {
                                try {
                                    const result = await ns.dnet.openCache(file);
                                    ns.tryWritePort(15, \`[LOOT] [\${host}] Opened \${file}! Contents: \${JSON.stringify(result)}\`);
                                } catch (e) {
                                    ns.tryWritePort(14, \`[LOOT-ERR] Failed to decrypt cache on \${host}: \${e}\`);
                                }
                            }
                        }`;
                        ns.write(looterScript, looterCode, "w");
                        ns.scp(looterScript, hostname, currentHost);
                        ns.exec(looterScript, hostname, 1);
                    } catch (e) {
                        ns.tryWritePort(14, "[EXCEPTION-LAB-LOOT] [" + getTimestamp() + "] [" + WORM_VERSION + "] Payload deployment failed on " + hostname + " - " + e);
                    }
                }
            }
        }

        // if (currentHost !== "home" && currentHost !== "darkweb") {
        //     try { await ns.dnet.phishingAttack(); }
        //     catch (e) { ns.tryWritePort(14, "[EXCEPTION10] [" + getTimestamp() + "] [" + WORM_VERSION + "] - " + e); }
        // }

        // if (currentHost !== "home" && currentHost !== "darkweb") {
        //     let whaleTarget = ns.peek(16);
        //     if (whaleTarget !== "NULL DATA" && whaleTarget !== "NULL PORT DATA" && whaleTarget) {
        //         try { await ns.dnet.promoteStock(whaleTarget); }
        //         catch (e) { ns.tryWritePort(14, "[EXCEPTION11] [" + getTimestamp() + "] [" + WORM_VERSION + "] - " + e); }
        //     }
        // }

        await ns.sleep(2000);
    }
}

async function serverSolver(ns, hostname, getTimestamp) {
    let solveStartTime = Date.now();

    if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) return false;
    if (deadTopology.has(hostname)) return false;

    const details = ns.dnet.getServerDetails(hostname);
    if (!details.isConnectedToCurrentServer || !details.isOnline) return false;

    if (details.hasSession && details.modelId !== "(The Labyrinth)") {
        return { success: true, modelId: details.modelId, duration: 0, password: null, alreadyActive: true };
    }

    if (typeof globalPasswordVault[hostname] === 'string') {
        try {
            ns.dnet.connectToSession(hostname, globalPasswordVault[hostname]);
            const checkDetails = ns.dnet.getServerDetails(hostname);
            if (checkDetails.hasSession) {
                return { success: true, modelId: details.modelId, duration: 0, password: globalPasswordVault[hostname], alreadyActive: true };
            } else {
                delete globalPasswordVault[hostname];
            }
        } catch (e) {
            delete globalPasswordVault[hostname];
        }
    }

    if (!acquireNetworkLock(ns, hostname, details.modelId)) return false;

    try {
        const authPayload = await executeCrackingMatrix(ns, hostname, details, getTimestamp);

        if (!authPayload || !authPayload.success) {
            try {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb) {
                    if (hb.code === ns.enums.DarknetResponseCode.DirectConnectionRequired) {
                        localCooldowns.set(hostname, Date.now() + 10000);
                    } else if (hb.code === ns.enums.DarknetResponseCode.ServiceUnavailable) {
                        return false;
                    } else {
                        let stallKey = hostname + "-" + hb.code;
                        if (!reportedStalls.has(stallKey)) {
                            await dumpDetailedDiagnostic(ns, hostname, details, getTimestamp);
                            reportedStalls.add(stallKey);
                        }
                    }
                }
            } catch (innerError) {
                ns.tryWritePort(14, "[" + WORM_VERSION + "] Logging failed: " + innerError);
            }
        }

        return authPayload && authPayload.success ? { success: true, modelId: details.modelId, duration: Date.now() - solveStartTime, password: authPayload.password, alreadyActive: false } : false;

    } catch (fatalException) {
        let exceptionKey = hostname + "-" + fatalException.toString();
        if (!reportedUnknowns.has(exceptionKey)) {
            ns.tryWritePort(14, "💥 [MATRIX-CRASH] [" + getTimestamp() + "] [" + WORM_VERSION + "] Unhandled runtime exception on " + hostname + " (" + details.modelId + "): " + (fatalException.message || fatalException));
            reportedUnknowns.add(exceptionKey);
        }
        return false;
    } finally {
        releaseNetworkLock(ns, hostname);
    }
}

async function dumpDetailedDiagnostic(ns, hostname, details, getTimestamp) {
    const divider = "================================================================================";
    let logBuffer = [];

    logBuffer.push("\n📡 [STALL-ALERT] FULL METADATA DUMP FOR UNRESOLVED HOST: " + hostname);
    logBuffer.push(divider);
    logBuffer.push("[UI FIELDS] Model: " + details.modelId);
    logBuffer.push("[UI FIELDS] Hint:  " + details.passwordHint);
    logBuffer.push("[UI FIELDS] Rules: Length: " + details.passwordLength + " | Format: " + details.passwordFormat);
    if (details.data) {
        logBuffer.push("[UI FIELDS] Variable Payload Data: " + JSON.stringify(details.data));
    }
    logBuffer.push(divider);

    try {
        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
        if (hb) {
            logBuffer.push("[FIREWALL RESPONSE] Status: " + (hb.success ? "SUCCESS" : "FAILED"));
            logBuffer.push("[FIREWALL RESPONSE] Code:   " + (hb.code || 401));
            logBuffer.push("[FIREWALL RESPONSE] Msg:    " + (hb.message || "Unauthorized"));
            logBuffer.push(divider);
            let stringifiedHB = JSON.stringify(hb, null, 2);
            logBuffer.push("[RAW LOGS] hb:\n" + stringifiedHB);
        }
    } catch (e) { ns.tryWritePort(14, "[EXCEPTION13] [" + getTimestamp() + "] [" + WORM_VERSION + "] - " + e); }

    logBuffer.push(divider);
    let finalDiagnosticReport = logBuffer.join("\n");
    ns.tryWritePort(14, "[" + WORM_VERSION + "] " + finalDiagnosticReport);
}

/** * High-fidelity generic puzzle solver engineered to parse dynamic telemetry filters.
 * @param {NS} ns
 * @param {string} hostname
 * @param {any} details
 */
async function executeCrackingMatrix(ns, hostname, details, getTimestamp) {
    const parseRoman = (str) => {
        if (!str) return 0;
        if (str.toLowerCase() === "nulla") return 0;
        const rMap = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
        let val = 0;
        for (let i = 0; i < str.length; i++) {
            let curr = rMap[str[i].toUpperCase()];
            let next = rMap[str[i + 1]?.toUpperCase()];
            if (next > curr) { val += (next - curr); i++; }
            else { val += curr; }
        }
        return val;
    };

    switch (details.modelId) {
        case "ZeroLogon":
            return { success: (await ns.dnet.authenticate(hostname, "")).success, password: "" };

        case "FreshInstall_1.0":
            if (details.passwordFormat === "numeric") {
                let fiLen = details.passwordLength || 4;

                const commonPins = [
                    "1234567890".slice(0, fiLen),
                    "0123456789".slice(0, fiLen),
                    "9876543210".slice(0, fiLen)
                ];

                ["0", "1", "9", "5"].forEach(digit => commonPins.push(digit.repeat(fiLen)));

                let validPins = Array.from(new Set(commonPins));
                for (const guess of validPins) {
                    if ((await ns.dnet.authenticate(hostname, guess)).success) {
                        return { success: true, password: guess };
                    }
                }

                for (let i = 0; i < Math.pow(10, fiLen); i++) {
                    let guess = i.toString().padStart(fiLen, '0');
                    if ((await ns.dnet.authenticate(hostname, guess)).success) {
                        return { success: true, password: guess };
                    }

                    if (i % 25 === 0) {
                        if (ns.dnet.getServerDetails(hostname).hasSession) {
                            return { success: true, password: null, alreadyActive: true };
                        }
                    }
                }
            } else {
                const words = details.passwordHint.trim().split(" ");
                const lastWord = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, "");
                if (lastWord && (await ns.dnet.authenticate(hostname, lastWord)).success) return { success: true, password: lastWord };

                const commonDefaults = ["password", "admin", "root", "1234", "default", "settings"];
                for (const pwd of commonDefaults) {
                    let adjustedPwd = pwd;
                    if (adjustedPwd.length > details.passwordLength) adjustedPwd = adjustedPwd.slice(0, details.passwordLength);
                    if ((await ns.dnet.authenticate(hostname, adjustedPwd)).success) return { success: true, password: adjustedPwd };
                }
            }
            return { success: false };

        case "AccountsManager_4.2": {
            let fiLen = details.passwordLength || 4;
            let low = 0;
            let high = Math.pow(10, fiLen) - 1;

            let rangeMatch = details.passwordHint.match(/\d+/g);
            if (rangeMatch && rangeMatch.length >= 2) {
                high = parseInt(rangeMatch[rangeMatch.length - 1], 10);
                low = parseInt(rangeMatch[rangeMatch.length - 2], 10);
            }

            let accountsGuesses = 0;
            while (low <= high && accountsGuesses < 15) {
                accountsGuesses++;
                let mid = Math.floor((low + high) / 2);
                let guessStr = mid.toString().padStart(fiLen, '0');

                if ((await ns.dnet.authenticate(hostname, guessStr)).success) return { success: true, password: guessStr };
                await ns.sleep(40);

                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                    let feedbackText = "";

                    for (let i = 0; i < logsArr.length; i++) {
                        let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]).toLowerCase();
                        if (logStr.includes(`"passwordattempted":"${guessStr}"`) || logStr.includes(`passwordattempted: ${guessStr}`)) {
                            feedbackText = logStr;
                            break;
                        }
                    }

                    if (feedbackText.includes("higher")) {
                        low = mid + 1;
                    } else if (feedbackText.includes("lower")) {
                        high = mid - 1;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            for (let i = low; i <= high; i++) {
                let finalGuess = i.toString().padStart(fiLen, '0');
                if ((await ns.dnet.authenticate(hostname, finalGuess)).success) return { success: true, password: finalGuess };
            }
            return { success: false };
        }

        case "BellaCuore":
            let bHint = details.passwordHint || "";
            if (bHint.includes("between")) {
                let limits = bHint.match(/'([^']+)'/g);
                if (limits && limits.length >= 2) {
                    let minVal = parseRoman(limits[0].replace(/'/g, ''));
                    let maxVal = parseRoman(limits[1].replace(/'/g, ''));
                    let bLen = details.passwordLength || 3;

                    let low = minVal;
                    let high = maxVal;
                    let bGuesses = 0;

                    while (low <= high && bGuesses < 15) {
                        bGuesses++;
                        let mid = Math.floor((low + high) / 2);
                        let guess = mid.toString().padStart(bLen, '0');

                        if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                        await ns.sleep(40);

                        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                        if (hb && hb.logs) {
                            let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                            let feedbackText = "";

                            for (let i = 0; i < logsArr.length; i++) {
                                let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]).toUpperCase();
                                if (logStr.includes(`"PASSWORDATTEMPTED":"${guess}"`) || logStr.includes(`PASSWORDATTEMPTED: ${guess}`) || logStr.includes(`PASSWORDATTEMPTED: ${mid}`)) {
                                    feedbackText = logStr;
                                    break;
                                }
                            }

                            if (feedbackText.includes("PARUM")) {
                                low = mid + 1;
                            } else if (feedbackText.includes("NIMIS") || feedbackText.includes("LONGUS") || feedbackText.includes("MAGNUS") || feedbackText.includes("ALTA")) {
                                high = mid - 1;
                            } else {
                                high = mid - 1;
                            }
                        } else {
                            break;
                        }
                    }

                    for (let i = low; i <= high; i++) {
                        let guess = i.toString().padStart(bLen, '0');
                        if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                        if (i % 15 === 0) await ns.sleep(20);
                    }
                }
            } else {
                let romanStr = details.data || "";
                if (!romanStr) {
                    let rMatch = bHint.match(/'([IVXLCDM]+)'/);
                    if (rMatch) romanStr = rMatch[1];
                }
                if (romanStr) {
                    let pw = parseRoman(romanStr).toString();
                    if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
                }
            }
            return { success: false };

        case "DeskMemo_3.1":
            const memoMatch = details.passwordHint.match(/\d+/);
            return memoMatch ? { success: (await ns.dnet.authenticate(hostname, memoMatch[0])).success, password: memoMatch[0] } : { success: false };

        case "CloudBlare(tm)":
            let captchaDigits = "";
            if (details.data) {
                for (const char of details.data) {
                    if (!isNaN(char) && char !== " ") captchaDigits += char;
                }
            }
            if (captchaDigits && (await ns.dnet.authenticate(hostname, captchaDigits)).success) return { success: true, password: captchaDigits };
            let blareMatch = details.passwordHint.match(/\d+/);
            return blareMatch ? { success: (await ns.dnet.authenticate(hostname, blareMatch[0])).success, password: blareMatch[0] } : { success: false };

        case "RateMyPix.Auth": {
            let rpmLen = details.passwordLength || 5;
            let alphaNumericPool = "0123456789";
            if (details.passwordFormat === "alphabetic") {
                alphaNumericPool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            } else if (details.passwordFormat === "alphanumeric") {
                alphaNumericPool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':,./<>?";
            }

            let currentPin = Array(rpmLen).fill(alphaNumericPool[0]);

            const getChiliScore = async (guessStr) => {
                let authRes = await ns.dnet.authenticate(hostname, guessStr);
                if (authRes.success) return "MATCH_FOUND";

                for (let retry = 0; retry < 10; retry++) {
                    await ns.sleep(30);
                    let hb = await ns.dnet.heartbleed(hostname, { peek: true });

                    if (hb && hb.logs) {
                        let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];

                        for (let i = logsArr.length - 1; i >= 0; i--) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            let cleanLogStr = logStr.replace(/\\/g, '');

                            if (cleanLogStr.includes(`"passwordAttempted":"${guessStr}"`) || cleanLogStr.includes(`passwordAttempted: ${guessStr}`)) {
                                let m = cleanLogStr.match(/"data"\s*:\s*"([^"]+)"/) || cleanLogStr.match(/data:\s*([^\s]+)/);
                                if (m) {
                                    let feedbackData = m[1];
                                    if (feedbackData.startsWith("0/")) return 0;
                                    return (feedbackData.match(/🌶️/g) || []).length;
                                }
                            }
                        }
                    }
                }
                return null;
            };

            for (let pos = 0; pos < rpmLen; pos++) {
                let baselineScore = await getChiliScore(currentPin.join(''));
                if (baselineScore === "MATCH_FOUND") return { success: true, password: currentPin.join('') };

                let originalChar = currentPin[pos];

                for (let cIdx = 1; cIdx < alphaNumericPool.length; cIdx++) {
                    let nextChar = alphaNumericPool[cIdx];
                    currentPin[pos] = nextChar;

                    let guessString = currentPin.join('');
                    let newScore = await getChiliScore(guessString);

                    if (newScore === "MATCH_FOUND") {
                        return { success: true, password: guessString };
                    }

                    if (newScore !== null && newScore > baselineScore) {
                        baselineScore = newScore;
                        break;
                    }

                    if (newScore !== null && newScore < baselineScore) {
                        currentPin[pos] = originalChar;
                        break;
                    }
                }
            }

            let finalGuess = currentPin.join('');
            return { success: (await ns.dnet.authenticate(hostname, finalGuess)).success, password: finalGuess };
        }

        case "Factori-Os": {
            let fLength = details.passwordLength || 2;
            if (details.passwordFormat !== "numeric") return { success: false };

            if ((await ns.dnet.authenticate(hostname, "0".repeat(fLength))).success) return { success: true, password: "0".repeat(fLength) };
            if ((await ns.dnet.authenticate(hostname, "1".padStart(fLength, '0'))).success) return { success: true, password: "1".padStart(fLength, '0') };

            let maxVal = Math.pow(10, fLength) - 1;
            let knownProduct = 1;
            let loopThrottler = 0;

            const primePool = [
                2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
                157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233,
                239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317,
                331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419,
                421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503,
                509, 521, 523, 541
            ];

            const isPrime = (num) => {
                if (num < 2) return false;
                if (num % 2 === 0 || num % 3 === 0) return false;
                for (let i = 5; i <= Math.sqrt(num); i += 6) {
                    if (num % i === 0 || num % (i + 2) === 0) return false;
                }
                return true;
            };

            const checkDivisibility = async (guess) => {
                let guessStr = String(guess).padStart(fLength, '0');
                let authResult = await ns.dnet.authenticate(hostname, guessStr);
                if (authResult.success) return "MATCH_FOUND";

                await ns.sleep(30);
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });

                if (hb && hb.logs) {
                    let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                    for (let i = 0; i < logsArr.length; i++) {
                        let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);

                        if (logStr.includes(`"passwordAttempted":"${guessStr}"`) || logStr.includes(`passwordAttempted: ${guessStr}`)) {
                            if (logStr.includes("IS divisible") || logStr.includes('"data":true') || logStr.includes('data: true')) {
                                return true;
                            }
                            return false;
                        }
                    }
                }
                return false;
            };

            let pIndex = 0;
            let currentPrime = primePool[0];

            while (currentPrime <= maxVal) {
                if (currentPrime > maxVal / knownProduct) break;

                loopThrottler++;
                if (loopThrottler % 200 === 0) await ns.sleep(1);

                let power = 1;
                while (true) {
                    let testVal = Math.pow(currentPrime, power);
                    if (testVal > maxVal) break;

                    let isDivisible = await checkDivisibility(testVal);

                    if (isDivisible === "MATCH_FOUND") {
                        return { success: true, password: String(testVal).padStart(fLength, '0') };
                    }

                    if (isDivisible === true) {
                        power++;
                    } else {
                        break;
                    }
                }

                let highestPower = power - 1;
                if (highestPower > 0) {
                    knownProduct *= Math.pow(currentPrime, highestPower);
                    let finalStr = String(knownProduct).padStart(fLength, '0');
                    if ((await ns.dnet.authenticate(hostname, finalStr)).success) {
                        return { success: true, password: finalStr };
                    }
                    await ns.sleep(30);
                }

                pIndex++;
                if (pIndex < primePool.length) {
                    currentPrime = primePool[pIndex];
                } else {
                    currentPrime += 2;
                    while (currentPrime <= maxVal && !isPrime(currentPrime)) {
                        currentPrime += 2;
                        loopThrottler++;
                        if (loopThrottler % 500 === 0) await ns.sleep(1);
                    }
                }
            }

            for (let i = 0; i <= maxVal; i++) {
                let fallbackStr = i.toString().padStart(fLength, '0');
                if ((await ns.dnet.authenticate(hostname, fallbackStr)).success) return { success: true, password: fallbackStr };
                if (i % 50 === 0) await ns.sleep(20);
            }
            return { success: false };
        }

        case "KingOfTheHill": {
            let kLength = details.passwordLength || 2;
            let maxVal = Math.pow(10, kLength) - 1;

            const getAltitude = async (guessInt) => {
                let guessStr = guessInt.toString().padStart(kLength, '0');
                if ((await ns.dnet.authenticate(hostname, guessStr)).success) {
                    return { success: true, password: guessStr, altitude: Infinity };
                }

                await ns.sleep(40);
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                let altitude = 0;

                if (hb && hb.logs) {
                    let logStr = Array.isArray(hb.logs) ? JSON.stringify(hb.logs) : String(hb.logs);
                    logStr = logStr.replace(/\\/g, '');

                    let match = logStr.match(/current altitude:\s*(\d+(?:\.\d+)?)/i) ||
                        logStr.match(/data:\s*(\d+(?:\.\d+)?)/i);

                    if (match) altitude = parseFloat(match[1]);
                }
                return { success: false, altitude: altitude };
            };

            let step = 5, left = 0, right = maxVal, bestGuess = -1, bestAltitude = -1;

            while (left <= right) {
                let lowProbe = await getAltitude(left);
                if (lowProbe.success) return { success: true, password: lowProbe.password };
                if (lowProbe.altitude > bestAltitude) {
                    bestAltitude = lowProbe.altitude;
                    bestGuess = left;
                }

                if (left !== right) {
                    let highProbe = await getAltitude(right);
                    if (highProbe.success) return { success: true, password: highProbe.password };
                    if (highProbe.altitude > bestAltitude) {
                        bestAltitude = highProbe.altitude;
                        bestGuess = right;
                    }
                }
                if (bestAltitude > 0) break;
                left += step;
                right -= step;
            }

            if (bestGuess !== -1 && bestAltitude > 0) {
                step = 5;
                let trackingValue = bestGuess;

                while (step >= 1) {
                    let forwardTarget = trackingValue + step;
                    if (forwardTarget <= maxVal) {
                        let probe = await getAltitude(forwardTarget);
                        if (probe.success) return { success: true, password: probe.password };
                        if (probe.altitude > bestAltitude) {
                            bestAltitude = probe.altitude;
                            trackingValue = forwardTarget;
                            continue;
                        }
                    }

                    let backwardTarget = trackingValue - step;
                    if (backwardTarget >= 0) {
                        let probe = await getAltitude(backwardTarget);
                        if (probe.success) return { success: true, password: probe.password };
                        if (probe.altitude > bestAltitude) {
                            bestAltitude = probe.altitude;
                            trackingValue = backwardTarget;
                            continue;
                        }
                    }
                    if (step === 5) step = 1;
                    else if (step === 1) break;
                }

                let fallbackStart = Math.max(0, trackingValue - 5);
                let fallbackEnd = Math.min(maxVal, trackingValue + 5);
                for (let i = fallbackStart; i <= fallbackEnd; i++) {
                    let finalStr = i.toString().padStart(kLength, '0');
                    if ((await ns.dnet.authenticate(hostname, finalStr)).success) return { success: true, password: finalStr };
                }
            }

            for (let i = 0; i <= maxVal; i++) {
                let fallbackStr = i.toString().padStart(kLength, '0');
                if ((await ns.dnet.authenticate(hostname, fallbackStr)).success) return { success: true, password: fallbackStr };
            }
            return { success: false };
        }

        case "Laika4":
            const dogGuesses = ["laika", "laika4", "fido", "spot", "rover", "max"];
            for (const pup of dogGuesses) {
                if ((await ns.dnet.authenticate(hostname, pup)).success) return { success: true, password: pup };
                if ((await ns.dnet.authenticate(hostname, pup.toUpperCase())).success) return { success: true, password: pup.toUpperCase() };
            }
            return { success: false };

        case "NIL": {
            let nLen = details.passwordLength || 6;
            const tFormat = details.passwordFormat || "numeric";

            let pool = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
            if (tFormat === "alphanumeric") {
                pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
            } else if (tFormat === "alphabetic") {
                pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
            }

            let discoveredPassword = Array(nLen).fill(null);

            for (let char of pool) {
                if (discoveredPassword.every(c => c !== null)) break;

                let guessStr = char.repeat(nLen);
                let immediateAuth = await ns.dnet.authenticate(hostname, guessStr);
                if (immediateAuth.success) {
                    return { success: true, password: guessStr };
                }

                await ns.sleep(40);

                let h = await ns.dnet.heartbleed(hostname, { peek: true });
                if (h && h.logs) {
                    let logsArr = Array.isArray(h.logs) ? h.logs : [h.logs];
                    let charMatchedInLogs = false;

                    for (let entry of logsArr) {
                        let entryStr = typeof entry === 'object' ? JSON.stringify(entry) : String(entry).replace(/\\/g, '');

                        let matchWrap = entryStr.includes(`"passwordAttempted":"${guessStr}"`);
                        let matchRaw = entryStr.includes(`passwordAttempted: ${guessStr}`);

                        if (matchWrap || matchRaw) {
                            charMatchedInLogs = true;
                            let dataMatch = entryStr.match(/"data"\s*:\s*"([^"]+)"/) || entryStr.match(/data:\s*(\d+)/);

                            if (dataMatch) {
                                let feedbackArray = dataMatch[1].split(',');
                                for (let i = 0; i < nLen; i++) {
                                    if (feedbackArray[i] === "yes") {
                                        discoveredPassword[i] = char;
                                    }
                                }
                            }
                        }
                    }

                    if (!charMatchedInLogs) {
                        let code = h.code;
                        if (code === ns.enums.DarknetResponseCode.DirectConnectionRequired ||
                            code === ns.enums.DarknetResponseCode.ServiceUnavailable) {
                            return { success: false };
                        }
                    }
                }
            }

            let finalGuess = discoveredPassword.map(c => c || pool[0]).join('');
            if ((await ns.dnet.authenticate(hostname, finalGuess)).success) return { success: true, password: finalGuess };
            return { success: false };
        }

        case "(The Labyrinth)": {
            const homeHost = "home";
            const currentHost = ns.getHostname();
            const saveFile = `maze-grid-${hostname}.txt`;

            async function getLabState() {
                try {
                    let labReportObj = await ns.dnet.labreport(hostname);
                    if (!labReportObj || !labReportObj.coords) return null;

                    let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    let rawData = "";

                    if (hb && hb.logs) {
                        let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                        for (let i = 0; i < logsArr.length; i++) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            let m = logStr.match(/"data"\s*:\s*"([^"]+)"/);
                            if (m) {
                                rawData = m[1].replace(/\\n/g, '\n');
                                break;
                            }
                        }
                    }
                    return { labReportObj, rawData };
                } catch (e) {
                    ns.tryWritePort(14, `[MAZE-STATE-ERROR] [${Date.now()}] [${WORM_VERSION}] ${e}`);
                    return null;
                }
            }

            // REMOVED: Legacy hardcoded blind 'south' initialization to prevent wall-spamming on restarts
            let globalGrid = {};

            if (ns.fileExists(saveFile, homeHost)) {
                if (ns.scp(saveFile, currentHost, homeHost)) {
                    try {
                        let fileContent = ns.read(saveFile);
                        if (fileContent) globalGrid = JSON.parse(fileContent);
                    } catch (e) {
                        ns.tryWritePort(14, `[GRID-READ-ERR] Failed parsing shared map: ${e}`);
                    }
                }
            }

            const syncGridToHome = () => {
                try {
                    let latestGrid = {};
                    if (ns.fileExists(saveFile, homeHost)) {
                        if (ns.scp(saveFile, currentHost, homeHost)) {
                            let fileContent = ns.read(saveFile);
                            if (fileContent) latestGrid = JSON.parse(fileContent);
                        }
                    }
                    globalGrid = Object.assign({}, latestGrid, globalGrid);
                    ns.write(saveFile, JSON.stringify(globalGrid), "w");
                    ns.scp(saveFile, homeHost, currentHost);
                } catch (e) {
                    ns.tryWritePort(14, `[GRID-SYNC-ERR] Map fusion failed: ${e}`);
                }
            };

            function findNextMoveToFrontier(startKey, grid) {
                let queue = [startKey];
                let visited = new Set([startKey]);
                let parentMap = new Map();
                let targetNode = null;

                while (queue.length > 0) {
                    let curr = queue.shift();
                    let cell = grid[curr];
                    if (!cell) continue;

                    let foundUnexplored = false;
                    for (let dir of ["south", "east", "north", "west"]) {
                        if (cell[dir] === true && (!cell.connections || cell.connections[dir] === null)) {
                            targetNode = curr;
                            foundUnexplored = true;
                            break;
                        }
                    }
                    if (foundUnexplored) break;

                    for (let dir of ["south", "east", "north", "west"]) {
                        let nextKey = cell.connections ? cell.connections[dir] : null;
                        if (nextKey && !visited.has(nextKey)) {
                            visited.add(nextKey);
                            parentMap.set(nextKey, { from: curr, dir: dir });
                            queue.push(nextKey);
                        }
                    }
                }

                if (!targetNode) return null;

                let currStep = targetNode;
                if (currStep === startKey) {
                    let cell = grid[startKey];
                    if (!cell) return null;
                    for (let dir of ["south", "east", "north", "west"]) {
                        if (cell[dir] === true && (!cell.connections || cell.connections[dir] === null)) return dir;
                    }
                }

                let firstDir = null;
                while (currStep !== startKey) {
                    let edge = parentMap.get(currStep);
                    if (!edge) break;
                    firstDir = edge.dir;
                    currStep = edge.from;
                }
                return firstDir;
            }

            let state = await getLabState();
            let lastCoordStr = null;
            let lastMoveDir = null;

            while (state) {
                let { labReportObj, rawData } = state;

                ns.tryWritePort(14, `[GRID-TELEMETRY] Host ${currentHost} is active at coordinates [${labReportObj.coords[0]},${labReportObj.coords[1]}]`);

                if (rawData.includes("!!") || (rawData && !rawData.includes("█") && rawData.trim().length > 0)) {
                    let finalPass = rawData.trim();
                    if ((await ns.dnet.authenticate(hostname, finalPass)).success) {
                        await ns.sleep(100);
                        let serverFiles = ns.ls(hostname);
                        for (let file of serverFiles) {
                            if (file.endsWith(".cache")) ns.scp(file, homeHost, hostname);
                        }
                        ns.write(saveFile, "", "w");
                        ns.scp(saveFile, homeHost, currentHost);
                        return { success: true, password: finalPass };
                    }
                }

                let x = labReportObj.coords[0];
                let y = labReportObj.coords[1];
                let curCoordStr = `${x},${y}`;

                if (!globalGrid[curCoordStr]) {
                    globalGrid[curCoordStr] = {
                        north: labReportObj.north,
                        south: labReportObj.south,
                        east: labReportObj.east,
                        west: labReportObj.west,
                        connections: { north: null, south: null, east: null, west: null }
                    };
                }

                if (lastCoordStr && lastMoveDir) {
                    if (globalGrid[lastCoordStr]) {
                        globalGrid[lastCoordStr].connections[lastMoveDir] = curCoordStr;
                    }
                    const opposites = { north: "south", south: "north", east: "west", west: "east" };
                    // FIXED: Patched the 'curGrid' variable typo to reference 'curCoordStr' correctly
                    if (globalGrid[curCoordStr] && globalGrid[curCoordStr][opposites[lastMoveDir]] === true) {
                        globalGrid[curCoordStr].connections[opposites[lastMoveDir]] = lastCoordStr;
                    }
                    syncGridToHome();
                }

                let chosenMove = null;
                for (let dir of ["south", "east", "north", "west"]) {
                    if (labReportObj[dir] === true && globalGrid[curCoordStr].connections[dir] === null) {
                        chosenMove = dir;
                        break;
                    }
                }

                if (!chosenMove) {
                    chosenMove = findNextMoveToFrontier(curCoordStr, globalGrid);
                }

                if (!chosenMove) {
                    ns.tryWritePort(14, `[GRID-COMPLETE] Swarm node ${currentHost} confirms maze topology fully mapped.`);
                    break;
                }

                lastCoordStr = curCoordStr;
                lastMoveDir = chosenMove;

                await ns.dnet.authenticate(hostname, `go ${chosenMove}`);
                await ns.sleep(60);

                state = await getLabState();
            }
            return { success: false };
        }

        case "Pr0verFl0":
            let pfLength = details.passwordLength || 7;
            await ns.dnet.authenticate(hostname, "A".repeat(pfLength));
            let pfHb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (pfHb && pfHb.logs) {
                let pLogStr = String(Array.isArray(pfHb.logs) ? JSON.stringify(pfHb.logs) : pfHb.logs).replace(/\\/g, '');
                let prefixMatch = pLogStr.match(/expected '([^■']+)/i) || pLogStr.match(/passwordExpected:\s*([^■\s]+)/i);
                let knownPrefix = prefixMatch ? prefixMatch[1] : "";
                let pool = Array.from(new Set(pLogStr.replace(/[^a-zA-Z0-9]/g, '').split('')));
                if (knownPrefix && pfLength - knownPrefix.length === 3) {
                    for (let c1 of pool) {
                        for (let c2 of pool) {
                            for (let c3 of pool) {
                                let guess = knownPrefix + c1 + c2 + c3;
                                if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                            }
                        }
                    }
                }
            }
            let fallbackGuess = "A".repeat(pfLength + 8);
            return { success: (await ns.dnet.authenticate(hostname, fallbackGuess)).success, password: fallbackGuess };

        case "OpenWebAccessPoint": {
            let owLen = details.passwordLength || 4;
            const owFormat = details.passwordFormat || "alphabetic";

            const agitationSeeds = ["admin", "password", "guest", "123456789"].map(w => w.slice(0, owLen));
            if (owFormat === "numeric") agitationSeeds.push("9".repeat(owLen), "0".repeat(owLen));

            for (let seed of agitationSeeds) {
                let authRes = await ns.dnet.authenticate(hostname, seed);
                if (authRes.success) return { success: true, password: seed };
                await ns.sleep(40);

                let hStream = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hStream && hStream.logs) {
                    let logsArr = Array.isArray(hStream.logs) ? hStream.logs : [hStream.logs];

                    for (let logEntry of logsArr) {
                        let logStr = typeof logEntry === 'object' ? JSON.stringify(logEntry) : String(logEntry);
                        let dataMatch = logStr.match(/"data"\s*:\s*"([^"]+)"/);

                        if (dataMatch) {
                            let rawDataStr = dataMatch[1];
                            let signature = `${hostname}:`;
                            let sigIdx = rawDataStr.indexOf(signature);
                            if (sigIdx !== -1) {
                                let potentialPassword = rawDataStr.substr(sigIdx + signature.length, owLen);
                                if ((await ns.dnet.authenticate(hostname, potentialPassword)).success) return { success: true, password: potentialPassword };
                            }

                            for (let i = 0; i <= rawDataStr.length - owLen; i++) {
                                let sub = rawDataStr.substr(i, owLen);
                                if ((await ns.dnet.authenticate(hostname, sub)).success) return { success: true, password: sub };
                            }
                        }
                    }
                }
            }
            return { success: false };
        }

        case "OctantVoxel": {
            let baseStr = "", numStr = "";
            if (details.data && String(details.data).includes(',')) {
                let parts = String(details.data).split(',');
                baseStr = parts[0]; numStr = parts[1];
            } else if (details.passwordHint) {
                let voxelMatch = details.passwordHint.match(/base\s+(\d+(?:\.\d+)?)\s+number\s+([a-fA-F0-9.]+)/i);
                if (voxelMatch) { baseStr = voxelMatch[1]; numStr = voxelMatch[2]; }
            }

            if (baseStr && numStr) {
                const baseVal = parseFloat(baseStr);
                const numParts = numStr.split('.');
                const intPart = numParts[0]; const fracPart = numParts[1] || "";
                let accumulatedSum = 0.0;

                for (let i = 0; i < intPart.length; i++) {
                    accumulatedSum += parseInt(intPart[intPart.length - 1 - i], 36) * Math.pow(baseVal, i);
                }
                for (let i = 0; i < fracPart.length; i++) {
                    accumulatedSum += parseInt(fracPart[i], 36) * Math.pow(baseVal, -(i + 1));
                }

                let finalPassword = Math.round(accumulatedSum).toString();
                if ((await ns.dnet.authenticate(hostname, finalPassword)).success) return { success: true, password: finalPassword };
            }
            return { success: false };
        }

        case "DeepGreen": {
            let dgLen = details.passwordLength || 3;
            const tFormat = details.passwordFormat || "numeric";
            let pool = "0123456789";
            if (tFormat === "alphanumeric") pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            else if (tFormat === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            let dgCants = [];
            const generateCombos = (prefix, depth) => {
                if (depth === 0) { dgCants.push(prefix); return; }
                for (let i = 0; i < pool.length; i++) generateCombos(prefix + pool[i], depth - 1);
            };
            generateCombos("", dgLen);

            let mastermindRuns = 0;
            while (dgCants.length > 0 && mastermindRuns < 120) {
                mastermindRuns++;
                let currentGuess = dgCants[0];

                if ((await ns.dnet.authenticate(hostname, currentGuess)).success) return { success: true, password: currentGuess };

                let targetExact = null, targetWrong = null, guesses = 0;
                while (guesses < 15) {
                    await ns.sleep(40);
                    let h = await ns.dnet.heartbleed(hostname, { peek: true });

                    if (h && h.logs) {
                        let logsArr = Array.isArray(h.logs) ? h.logs : [hb.logs];
                        let foundTargetLog = false;

                        for (let i = logsArr.length - 1; i >= 0; i--) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            let cleanLogStr = logStr.replace(/\\/g, '');

                            if (cleanLogStr.includes(`passwordAttempted: ${currentGuess}`) || cleanLogStr.includes(`"passwordAttempted":"${currentGuess}"`)) {
                                let dataMatch = cleanLogStr.match(/"data"\s*:\s*"(\d+),(\d+)"/) || cleanLogStr.match(/data:\s*(\d+),(\d+)/);
                                if (dataMatch) {
                                    targetExact = parseInt(dataMatch[1], 10);
                                    targetWrong = parseInt(dataMatch[2], 10);
                                    foundTargetLog = true;
                                    break;
                                }
                            }
                        }
                        if (foundTargetLog) break;
                    }
                    guesses++;
                }

                if (targetExact === null || targetWrong === null) { dgCants.shift(); continue; }

                dgCants = dgCants.filter(cand => {
                    let exact = 0, wrong = 0, cArr = cand.split(''), gArr = currentGuess.split('');
                    for (let j = 0; j < dgLen; j++) {
                        if (cArr[j] === gArr[j]) { exact++; cArr[j] = null; gArr[j] = null; }
                    }
                    for (let j = 0; j < dgLen; j++) {
                        if (gArr[j] !== null) {
                            let idx = cArr.indexOf(gArr[j]);
                            if (idx !== -1) { wrong++; cArr[idx] = null; }
                        }
                    }
                    return exact === targetExact && wrong === targetWrong;
                });
            }
            return { success: false };
        }

        case "PHP 5.4":
            let phpDigits = (details.data || details.passwordHint || "").replace(/[^0-9]/g, "");
            if (phpDigits.length > 0) {
                const generatePermutations = (str) => {
                    if (str.length <= 1) return [str];
                    let out = [];
                    for (let i = 0; i < str.length; i++) {
                        let rem = str.slice(0, i) + str.slice(i + 1);
                        for (let sub of generatePermutations(rem)) out.push(str[i] + sub);
                    }
                    return Array.from(new Set(out));
                };
                for (let p of generatePermutations(phpDigits)) {
                    if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
                }
            }
            return { success: false };

        case "OrdoXenos":
            let cipherText = "", maskPool = [], oData = details.data || "";
            if (oData.includes(";")) {
                let parts = oData.split(";"); cipherText = parts[0];
                maskPool = parts[1].split(" ").map(b => parseInt(b, 2));
            }
            if (cipherText && maskPool.length >= cipherText.length) {
                let decrypted = "";
                for (let i = 0; i < cipherText.length; i++) decrypted += String.fromCharCode(cipherText.charCodeAt(i) ^ maskPool[i]);
                if ((await ns.dnet.authenticate(hostname, decrypted)).success) return { success: true, password: decrypted };
            }
            return { success: false };

        case "PrimeTime 2":
            let numMatch = details.passwordHint.match(/\d+/);
            if (numMatch) {
                let num = parseInt(numMatch[0], 10), divisor = 2;
                while (divisor * divisor <= num) { if (num % divisor === 0) num /= divisor; else divisor++; }
                if ((await ns.dnet.authenticate(hostname, num.toString())).success) return { success: true, password: num.toString() };
            }
            return { success: false };

        case "110100100":
            let binarySource = details.data || "";
            if (!binarySource) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let m = JSON.stringify(hb.logs).match(/"data"\s*:\s*"([^"]+)"/);
                    if (m) binarySource = m[1];
                }
            }
            if (binarySource && binarySource.includes(" ")) {
                let decodedText = binarySource.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
                if ((await ns.dnet.authenticate(hostname, decodedText)).success) return { success: true, password: decodedText };
            }
            return { success: false };

        case "EuroZone Free": {
            const euCountries = [
                "albania", "andorra", "austria", "belgium", "bulgaria", "croatia", "cyprus",
                "denmark", "estonia", "finland", "france", "germany", "greece", "hungary",
                "iceland", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta",
                "netherlands", "norway", "poland", "portugal", "romania", "russia", "serbia",
                "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "ukraine", "united kingdom"
            ];
            let tLen = details.passwordLength || 5;
            let filteredCountries = euCountries.filter(c => c.length === tLen);

            for (let country of filteredCountries) {
                const titleCase = country.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                const guesses = [country, country.toUpperCase(), titleCase];
                for (let guess of guesses) {
                    if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                }
            }
            return { success: false };
        }

        case "BigMo%od": {
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
            let moduli = [], remainders = [];

            for (let p of primes) {
                let pStr = p.toString();
                if ((await ns.dnet.authenticate(hostname, pStr)).success) return { success: true, password: pStr };
                await ns.sleep(40);
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logStr = JSON.stringify(hb.logs).replace(/\\/g, '');
                    let m = logStr.match(/"data"\s*:\s*"(\d+)"/) || logStr.match(/data:\s*(\d+)/) || logStr.match(/=\s*(\d+)/);
                    if (m) { moduli.push(BigInt(p)); remainders.push(BigInt(m[1])); }
                }
            }

            if (moduli.length > 0) {
                let N = 1n; for (let m of moduli) N *= m;
                let result = 0n;
                for (let i = 0; i < moduli.length; i++) {
                    let ni = moduli[i], ri = remainders[i], Ni = N / ni, inv = 0n;
                    for (let j = 1n; j < ni; j++) { if ((Ni * j) % ni === 1n) { inv = j; break; } }
                    result += ri * Ni * inv;
                }
                let finalPassword = (result % N).toString();
                if ((await ns.dnet.authenticate(hostname, finalPassword)).success) return { success: true, password: finalPassword };
            }
            return { success: false };
        }

        case "2G_cellular": {
            let cellLen = details.passwordLength || 6;
            const cellPool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let cellGuess = Array(cellLen).fill(cellPool[0]);

            for (let pos = 0; pos < cellLen; pos++) {
                for (let cIdx = 0; cIdx < cellPool.length; cIdx++) {
                    cellGuess[pos] = cellPool[cIdx];
                    let guessStr = cellGuess.join('');

                    if ((await ns.dnet.authenticate(hostname, guessStr)).success) return { success: true, password: guessStr };

                    let mismatchIdx = null, guesses = 0;
                    while (guesses < 15) {
                        await ns.sleep(40);
                        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                        if (hb && hb.logs) {
                            let logStr = JSON.stringify(hb.logs);
                            if (logStr.includes(guessStr)) {
                                let match = logStr.match(/character \((\d+)\)/i);
                                if (match) { mismatchIdx = parseInt(match[1], 10); break; }
                            }
                        }
                        guesses++;
                    }
                    if (mismatchIdx !== null && mismatchIdx > pos) break;
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, cellGuess.join(''))).success, password: cellGuess.join('') };
        }

        case "MathML":
            if (details.data) {
                try {
                    let cleanExpr = String(details.data).split(',')[0].replace(/ҳ/g, '*').replace(/➕/g, '+').replace(/➖/g, '-').replace(/÷/g, '/');
                    if (/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
                        const evalRes = Function(`return (${cleanExpr})`)();
                        let resStr = evalRes.toString().slice(0, details.passwordLength || 2);
                        if ((await ns.dnet.authenticate(hostname, resStr)).success) return { success: true, password: resStr };
                    }
                } catch (e) { }
            }
            return { success: false };

        case "TopPass": {
            let tLen = details.passwordLength || 6;

            const passwordDictionary = {
                4: ["1234", "0000", "1111", "9999", "qwer", "test", "love", "root", "admin", "pass"],
                5: ["12345", "00000", "11111", "99999", "login", "admin", "hello", "cyber"],
                6: [
                    "123456", "654321", "112233", "123123", "987654", "121212", "012345",
                    "696969", "666666", "123321", "967609", "555555", "131313", "777777",
                    "qwerty", "secret", "dragon", "master", "system", "qazwsx", "123qwe",
                    "jordan", "pepper", "zxcvbn", "maggie", "159753", "aaaaaa", "ginger",
                    "buster", "asdfgh", "hunter", "430165", "abc123", "monkey", "shadow"
                ],
                7: ["letmein", "7777777", "zxcvbnm", "1234567", "mustang", "jessica", "freedom"],
                8: ["baseball", "football", "12345678", "superman", "1qaz2wsx", "trustno1", "jennifer", "44215175", "michelle", "11111111"],
                9: ["123456789"],
                10: ["qwertyuiop"]
            };

            let candidates = passwordDictionary[tLen] || [];

            if (ns.fileExists("darknet-words.txt")) {
                try {
                    const lines = ns.read("darknet-words.txt").split("\n");
                    for (let word of lines) {
                        word = word.trim();
                        if (word.length === tLen) {
                            candidates.push(word);
                            candidates.push(word.toLowerCase());
                            candidates.push(word.toUpperCase());
                            candidates.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
                        }
                    }
                } catch (e) { }
            }

            let uniqueGuesses = Array.from(new Set(candidates));
            for (const guess of uniqueGuesses) {
                if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
            }
            return { success: false };
        }

        default:
            if (!reportedUnknowns.has(hostname)) {
                ns.tryWritePort(14, `[NEW MODEL] [${Date.now()}] [${WORM_VERSION}] Host: ${hostname} | Model: ${details.modelId}`);
                reportedUnknowns.add(hostname);
            }
            return { success: false };
    }
}

/**
 * POOL MUTEX SYSTEM ALLOCATION 
 * @param {NS} ns */
function acquireNetworkLock(ns, hostname, modelId) {
    if (modelId === "(The Labyrinth)" || hostname.includes("l4byr1nth")) {
        return true;
    }

    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lockPort = 10 + Math.abs(hash % 4);

    let currentLocksData = ns.readPort(lockPort);
    let locks = (currentLocksData === "NULL PORT DATA" || currentLocksData === "NULL DATA" || !currentLocksData) ? [] : JSON.parse(currentLocksData);

    let now = Date.now(), validLocks = [], isLocked = false;
    const currentHost = ns.getHostname();

    for (let lock of locks) {
        let targetHost = typeof lock === 'string' ? lock : lock.host;
        let lockerHost = lock.locker || 'Unknown';
        let acquiredAt = lock.acquiredAt || now;

        if (targetHost === hostname) {
            if (now - acquiredAt <= 300000) {
                isLocked = true;
                validLocks.push({ host: targetHost, locker: lockerHost, model: lock.model || 'Unknown', acquiredAt });
            }
        } else {
            if (now - acquiredAt <= 300000) {
                validLocks.push({ host: targetHost, locker: lockerHost, model: lock.model || 'Unknown', acquiredAt });
            }
        }
    }

    if (isLocked) {
        ns.writePort(lockPort, JSON.stringify(validLocks));
        localCooldowns.set(hostname, Date.now() + 1000);
        return false;
    }

    validLocks.push({ host: hostname, locker: currentHost, model: modelId, acquiredAt: now });
    ns.writePort(lockPort, JSON.stringify(validLocks));
    return true;
}

/**
 * SHARDED MUTEX CLEANUP INTERFACE
 * @param {NS} ns */
function releaseNetworkLock(ns, hostname) {
    if (hostname.includes("l4byr1nth")) return;

    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lockPort = 10 + Math.abs(hash % 4);

    let currentLocksData = ns.readPort(lockPort);
    if (currentLocksData === "NULL PORT DATA" || currentLocksData === "NULL DATA" || !currentLocksData) return;

    const currentHost = ns.getHostname();
    let locks = JSON.parse(currentLocksData).filter(lock => {
        let targetHost = typeof lock === 'string' ? lock : lock.host;
        let lockerHost = lock.locker || 'Unknown';
        return !(targetHost === hostname && lockerHost === currentHost);
    });

    ns.writePort(lockPort, JSON.stringify(locks));
    localCooldowns.set(hostname, Date.now() + 500);
}

/** @param {AutocompleteData} data */
export function autocomplete(data) { return ["--tail"]; }
