// Global tracking sets to prevent duplicate data flooding across log files
const reportedUnknowns = new Set();
const reportedSpecs = new Set();
const reportedStalls = new Set();
const deadTopology = new Set();
const localCooldowns = new Map();
const scriptCost = 13.80;
const WORM_VERSION = "v1.3.17";

// Global Password Vault to permanently track cracked keys across resets
let globalPasswordVault = {};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();

    // =========================================================================
    // \ud83d\udd01 SELF-HEALING DEPENDENCY BOOTLOADER & FILE INITIALIZATION
    // =========================================================================
    if (currentHost === "home") {
        const loggerScript = "dnet-logger.js";

        if (!ns.scriptRunning(loggerScript, "home")) {
            if (ns.fileExists(loggerScript, "home")) {
                ns.exec(loggerScript, "home");
            }
        }

        if (ns.fileExists("darknet-keys.txt")) {
            try {
                const fileData = ns.read("darknet-keys.txt");
                if (fileData) globalPasswordVault = JSON.parse(fileData);
            } catch (e) { ns.tryWritePort(14, `[EXCEPTION1] - ${e}`) }
        }
    } // =========================================================================

    while (true) {
        if (currentHost === "home") {
            let portUpdate = ns.readPort(17);
            let vaultUpdated = false;

            while (portUpdate !== "NULL PORT DATA" && portUpdate !== "NULL DATA" && portUpdate) {
                try {
                    const updatePayload = JSON.parse(portUpdate);
                    if (updatePayload.host && updatePayload.pass) {
                        if (globalPasswordVault[updatePayload.host] !== updatePayload.pass) {
                            globalPasswordVault[updatePayload.host] = updatePayload.pass;
                            vaultUpdated = true;
                        }
                    }
                } catch (e) { ns.tryWritePort(14, `[EXCEPTION2] - ${e}`) }

                portUpdate = ns.readPort(17);
            }

            if (vaultUpdated) {
                ns.write("darknet-keys.txt", JSON.stringify(globalPasswordVault), "w");
            }
        } else {
            try {
                if (ns.fileExists("darknet-keys.txt", "home")) {
                    if (ns.scp("darknet-keys.txt", currentHost, "home")) {
                        const fileData = ns.read("darknet-keys.txt");
                        if (fileData) {
                            const remoteVault = JSON.parse(fileData);
                            globalPasswordVault = Object.assign({}, remoteVault, globalPasswordVault);
                        }
                    }
                }
            } catch (e) { ns.tryWritePort(14, `[EXCEPTION3] - ${e}`) }
        }

        if (currentHost !== "home" && currentHost !== "darkweb") {
            try {
                let details = ns.dnet.getServerDetails(currentHost);
                let safetyTimeout = 0;
                while (details.ramBlocked > 0 && safetyTimeout < 30) {
                    await ns.dnet.memoryReallocation();
                    details = ns.dnet.getServerDetails(currentHost);
                    safetyTimeout++;
                    if (details.ramBlocked > 0) await ns.sleep(100);
                }
            } catch (e) { ns.tryWritePort(14, `[EXCEPTION4] - ${e}`) }
        }

        const cacheFiles = ns.ls(currentHost, '.cache');
        for (const cacheFile of cacheFiles) {
            try {
                const result = await ns.dnet.openCache(cacheFile);
                ns.tryWritePort(15, `[LOOT] [${currentHost}] Opened ${cacheFile}! Contents: ${JSON.stringify(result)}`);
            } catch (e) { ns.tryWritePort(14, `[EXCEPTION5] - ${e}`) }
        }

        // =========================================================================
        // \ud83d\udd01 SPEARHEAD DEPTH PRIORITIZATION TUNNEL
        // =========================================================================
        const nearbyServers = ns.dnet.probe();

        const prioritizedTargets = nearbyServers.map(hostname => {
            try {
                const details = ns.dnet.getServerDetails(hostname);
                return {
                    hostname,
                    depth: details.depth || 0,
                    modelId: details.modelId,
                    isHighValue: (details.modelId === "(The Labyrinth)" || details.depth > 15)
                };
            } catch (e) {
                ns.tryWritePort(14, `[EXCEPTION6] - ${e}`)
                return { hostname, depth: 0, modelId: "Unknown", isHighValue: false };
            }
        }).sort((a, b) => {
            if (a.isHighValue && !b.isHighValue) return -1;
            if (!a.isHighValue && b.isHighValue) return 1;
            return b.depth - a.depth;
        });

        // =========================================================================
        // \ud83d\udd01 DETERMINISTIC HARDWARE ALLOCATION ENGINE (LINEAR SECURITY REGIME)
        // =========================================================================
        for (const target of prioritizedTargets) {
            const hostname = target.hostname;
            if (hostname == null) continue;
            const isLabyrinth = target.modelId === "(The Labyrinth)" || hostname === "ub3r_l4byr1nth";

            // \ud83d\udd01 GATE 1: AUTHENTICATION & ACCESS VERIFICATION
            const authResult = await serverSolver(ns, hostname);
            if (!authResult || !authResult.success) continue;

            // \ud83d\udd01 GATE 2: ADMINISTRATIVE AUDIT
            try {
                let activeProcesses = ns.ps(hostname);
                let runningWormInstance = activeProcesses.find(p => p.filename === scriptName);

                if (runningWormInstance && !isLabyrinth) {
                    let isUpToDate = runningWormInstance.args.includes(WORM_VERSION);

                    if (isUpToDate) {
                        continue;
                    } else {
                        ns.tryWritePort(14, `[HOT-UPGRADE] Upgrading outdated worm on ${hostname} from ${runningWormInstance.args[0] || "Legacy"} to ${WORM_VERSION}...`);
                        ns.kill(runningWormInstance.pid);
                    }
                }
            } catch (e) {
                ns.tryWritePort(14, `[EXCEPTION-1] Admin Audit Failure on ${hostname} - ${e}`);
            }

            // \ud83d\udd01 GATE 3: HARDWARE METRIC PROBE
            const targetMaxRam = ns.getServerMaxRam(hostname);
            const targetUsedRam = ns.getServerUsedRam(hostname);
            const targetFreeRam = targetMaxRam - targetUsedRam;
            const bootstrapper = "dnet-bootstrap.js";

            // \ud83d\udd01 GATE 4: FORCE PAYLOAD OVERWRITE
            try {
                ns.scp(bootstrapper, hostname, currentHost);
                ns.scp(scriptName, hostname, currentHost);
            } catch (e) {
                ns.tryWritePort(14, `[EXCEPTION-2] SCP Payload Transfer Failure to ${hostname} - ${e}`);
            }

            // \ud83d\udd01 GATE 5: BLOCKED SYSTEM ALLOCATION FALLBACK
            if (targetFreeRam < scriptCost && targetMaxRam >= scriptCost && !isLabyrinth) {
                ns.tryWritePort(14, `[RAM-BLOCKED] Host: ${hostname} | Free: ${targetFreeRam}GB / Max: ${targetMaxRam}GB. Deploying lightweight bootstrapper...`);

                try {
                    let bootPid = ns.exec(bootstrapper, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION, hostname);
                    if (bootPid === 0) {
                        if (!ns.ps(hostname).find(p => p.filename === bootstrapper || p.filename === "dnet-worm.js")) {
                            ns.tryWritePort(14, `[DEPLOY-FAIL] Host: ${hostname} | Even bootstrapper failed to clear allocation space.`);
                        }
                    }
                } catch (e) {
                    ns.tryWritePort(14, `[EXCEPTION-3] Bootstrapper Invocation Failure on ${hostname} - ${e}`);
                }
                continue;
            }

            // \ud83d\udd01 GATE 6: INSUFFICIENT HARDWARE BYPASS
            if (targetMaxRam < scriptCost && !isLabyrinth) {
                if (targetMaxRam === 0) {
                    ns.tryWritePort(14, `[RAM-ZERO] Host: ${hostname} | Inducing migration...`);
                    for (let j = 0; j < 5; j++) {
                        await ns.dnet.induceServerMigration(hostname);
                        await ns.sleep(40);
                    }
                } else {
                    ns.tryWritePort(14, `[RAM-INSUFFICIENT] Host: ${hostname} | Max RAM (${targetMaxRam}GB) cannot support monolith cost (${scriptCost}GB). Bypass logged.`);
                }
                continue;
            }

            // \ud83d\udd01 GATE 7: STANDARD EXECUTION DISPATCH
            if (authResult.alreadyActive && !isLabyrinth) {
                try {
                    ns.exec(scriptName, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION);
                } catch (e) {
                    ns.tryWritePort(14, `[EXCEPTION-4] Legacy Handoff Execution Failure on ${hostname} - ${e}`);
                }
                continue;
            }

            if (authResult.password) {
                globalPasswordVault[hostname] = authResult.password;
                try {
                    ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: authResult.password }));
                } catch (e) {
                    ns.tryWritePort(14, `[EXCEPTION-5] Vault Port Synchronization Failure for ${hostname} - ${e}`);
                }
            }

            ns.tryWritePort(15, `[AUTH-SUCCESS] [${currentHost}] Colonized: ${hostname} (${target.modelId})`);

            if (!isLabyrinth) {
                try {
                    ns.exec(scriptName, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION);
                } catch (e) {
                    ns.tryWritePort(14, `[EXCEPTION-6] Primary Colonization Invocation Failure on ${hostname} - ${e}`);
                }
            }
        }

        if (currentHost !== "home" && currentHost !== "darkweb") {
            try { await ns.dnet.phishingAttack(); }
            catch (e) { ns.tryWritePort(14, `[EXCEPTION10] - ${e}`) }
        }

        if (currentHost !== "home" && currentHost !== "darkweb") {
            let whaleTarget = ns.peek(16);
            if (whaleTarget !== "NULL DATA" && whaleTarget !== "NULL PORT DATA" && whaleTarget) {
                try {
                    await ns.dnet.promoteStock(whaleTarget);
                } catch (e) { ns.tryWritePort(14, `[EXCEPTION11] - ${e}`) }
            }
        }

        await ns.sleep(2000);
    }
}

/** * Orchestrates server status gates, transaction locks, and comprehensive log dumps.
 * @param {NS} ns
 * @param {string} hostname
 */
async function serverSolver(ns, hostname) {
    let solveStartTime = Date.now();

    if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) return false;
    if (deadTopology.has(hostname)) return false;

    const details = ns.dnet.getServerDetails(hostname);
    if (!details.isConnectedToCurrentServer || !details.isOnline) return false;

    if (details.hasSession) {
        return { success: true, modelId: details.modelId, duration: 0, password: null, alreadyActive: true };
    }

    if (globalPasswordVault[hostname]) {
        try {
            ns.dnet.connectToSession(hostname, globalPasswordVault[hostname]);

            const checkDetails = ns.dnet.getServerDetails(hostname);
            if (checkDetails.hasSession) {
                return { success: true, modelId: details.modelId, duration: 0, password: globalPasswordVault[hostname], alreadyActive: true };
            } else {
                ns.tryWritePort(14, `\\u26a0\\ufe0f [VAULT-STALE] Stale password rejected for ${hostname}. Purging key.`);
                delete globalPasswordVault[hostname];
            }
        } catch (e) {
            ns.tryWritePort(14, `[EXCEPTION12] - Session connection failed on ${hostname} - ${e}`);
            delete globalPasswordVault[hostname];
        }
    }

    if (!acquireNetworkLock(ns, hostname, details.modelId)) return false;

    try {
        const authPayload = await executeCrackingMatrix(ns, hostname, details);

        if (!authPayload || !authPayload.success) {
            try {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb) {
                    if (hb.code === ns.enums.DarknetResponseCode.DirectConnectionRequired) {
                        deadTopology.add(hostname);
                    } else if (hb.code === ns.enums.DarknetResponseCode.ServiceUnavailable) {
                        return false;
                    } else {
                        let stallKey = `${hostname}-${hb.code}`;
                        if (!reportedStalls.has(stallKey)) {
                            await dumpDetailedDiagnostic(ns, hostname, details);
                            reportedStalls.add(stallKey);
                        }
                    }
                }
            } catch (innerError) {
                ns.tryWritePort(14, `Logging failed: ${innerError}`);
            }
        }

        return authPayload && authPayload.success ? { success: true, modelId: details.modelId, duration: Date.now() - solveStartTime, password: authPayload.password, alreadyActive: false } : false;

    } catch (fatalException) {
        let exceptionKey = `${hostname}-${fatalException.toString()}`;

        if (!reportedUnknowns.has(exceptionKey)) {
            ns.tryWritePort(14, `\ud83d\udd01 [MATRIX-CRASH] Unhandled runtime exception on ${hostname} (${details.modelId}): ${fatalException.message || fatalException}`);
            reportedUnknowns.add(exceptionKey);
        }
        return false;

    } finally {
        releaseNetworkLock(ns, hostname);
    }
}

/**
 * \ud83d\udd01 AUTOMATED TERMINAL EMULATOR: Captures and stringifies full background UI states to Port 14.
 * @param {NS} ns
 * @param {string} hostname
 * @param {any} details
 */
async function dumpDetailedDiagnostic(ns, hostname, details) {
    const divider = "=".repeat(80);
    let logBuffer = [];

    logBuffer.push(`
\ud83d\udd01 [STALL-ALERT] FULL METADATA DUMP FOR UNRESOLVED HOST: ${hostname}`);
    logBuffer.push(divider);
    logBuffer.push(`[UI FIELDS] Model: ${details.modelId}`);
    logBuffer.push(`[UI FIELDS] Hint:  ${details.passwordHint}`);
    logBuffer.push(`[UI FIELDS] Rules: Length: ${details.passwordLength} | Format: ${details.passwordFormat}`);
    if (details.data) {
        logBuffer.push(`[UI FIELDS] Variable Payload Data: ${JSON.stringify(details.data)}`);
    }
    logBuffer.push(divider);

    try {
        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
        if (hb) {
            logBuffer.push(`[FIREWALL RESPONSE] Status: ${hb.success ? "SUCCESS" : "FAILED"}`);
            logBuffer.push(`[FIREWALL RESPONSE] Code:   ${hb.code || 401}`);
            logBuffer.push(`[FIREWALL RESPONSE] Msg:    ${hb.message || "Unauthorized"}`);
            logBuffer.push(divider);
            let stringifiedHB = JSON.stringify(hb, null, 2);
            logBuffer.push(`[RAW LOGS] hb:
${stringifiedHB}`);
        }
    } catch (e) { ns.tryWritePort(14, `[EXCEPTION13] - ${e}`) }

    logBuffer.push(divider);
    let finalDiagnosticReport = logBuffer.join("");
    ns.tryWritePort(14, finalDiagnosticReport);
}

/** * High-fidelity generic puzzle solver engineered to parse dynamic telemetry filters.
 * @param {NS} ns
 * @param {string} hostname
 * @param {any} details
 */
async function executeCrackingMatrix(ns, hostname, details) {
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
            let searchLimit = Math.ceil(Math.log2(high - low + 1) * 1.1) + 2;
            while (low <= high && accountsGuesses < searchLimit) {
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

                    let searchLimit = Math.ceil(Math.log2(high - low + 1) * 1.1) + 2;

                    while (low <= high && bGuesses < searchLimit) {
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

        case "RateMyPix.Auth":
            let rpmLen = details.passwordLength || 5;
            let currentPin = Array(rpmLen).fill('0');

            const alphaNumericPool = details.passwordFormat === "numeric"
                ? "0123456789"
                : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':,./<>?";

            await ns.dnet.authenticate(hostname, currentPin.join(''));
            await ns.sleep(40);
            let hbInit = await ns.dnet.heartbleed(hostname, { peek: true });
            let lastScore = 0;
            if (hbInit && hbInit.logs) {
                let logStr = Array.isArray(hbInit.logs) ? JSON.stringify(hbInit.logs) : String(hbInit.logs);
                let m = logStr.match(/"data"\s*:\s*"([^"]+)\/\d+"/) || logStr.match(/([^"{\s]+)\/\d+/);
                if (m) {
                    let val = m[1].trim();
                    lastScore = /^\d+$/.test(val) ? parseInt(val, 10) : Array.from(val).length;
                }
            }

            for (let pos = 0; pos < rpmLen; pos++) {
                let originalChar = currentPin[pos];
                let locked = false;

                for (let cIdx = 0; cIdx < alphaNumericPool.length; cIdx++) {
                    let char = alphaNumericPool[cIdx];
                    currentPin[pos] = char;
                    let guess = currentPin.join('');

                    if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                    await ns.sleep(40);

                    let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    if (hb && hb.logs) {
                        let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                        let newScore = null;

                        for (let i = 0; i < logsArr.length; i++) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            if (logStr.includes(`"passwordAttempted":"${guess}"`) || logStr.includes(`passwordAttempted: ${guess}`)) {
                                let m = logStr.match(/"data"\s*:\s*"([^"]+)\/\d+"/) || logStr.match(/([^"{\s]+)\/\d+/);
                                if (m) {
                                    let val = m[1].trim();
                                    newScore = /^\d+$/.test(val) ? parseInt(val, 10) : Array.from(val).length;
                                    break;
                                }
                            }
                        }

                        if (newScore !== null) {
                            if (newScore > lastScore) {
                                lastScore = newScore;
                                locked = true;
                                break;
                            } else if (newScore < lastScore) {
                                currentPin[pos] = originalChar;
                                locked = true;
                                break;
                            }
                        }
                    }
                }
                if (!locked) currentPin[pos] = originalChar;
            }
            return { success: (await ns.dnet.authenticate(hostname, currentPin.join(''))).success, password: currentPin.join('') };

        case "Factori-Os": {
            let fLength = details.passwordLength || 2;
            if (details.passwordFormat !== "numeric") return { success: false };

            let maxVal = Math.pow(10, fLength) - 1;
            await ns.dnet.authenticate(hostname, "0".repeat(fLength));
            await ns.sleep(40);

            let fHb = await ns.dnet.heartbleed(hostname, { peek: true });
            let divisors = [], nonDivisors = [];
            if (fHb && fHb.logs) {
                let fLogStr = Array.isArray(fHb.logs) ? JSON.stringify(fHb.logs) : String(fHb.logs);
                let incMatches = [...fLogStr.matchAll(/IS divisible by '(\d+)'/gi)];
                divisors = incMatches.map(m => parseInt(m[1], 10)).filter(d => d > 0);
                let excMatches = [...fLogStr.matchAll(/is not divisible by '(\d+)'/gi)];
                nonDivisors = excMatches.map(m => parseInt(m[1], 10)).filter(d => d > 0);
            }

            let step = 1;
            if (divisors.length > 0) {
                const gcd = (a, b) => b ? gcd(b, a % b) : a;
                const lcm = (a, b) => (a * b) / gcd(a, b);
                step = divisors.reduce((acc, curr) => lcm(acc, curr), 1);
            }

            for (let i = step; i <= maxVal; i += step) {
                if (nonDivisors.some(d => i % d === 0)) continue;
                let finalStr = i.toString().padStart(fLength, '0');
                if ((await ns.dnet.authenticate(hostname, finalStr)).success) return { success: true, password: finalStr };
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

                    if (match) {
                        altitude = parseFloat(match[1]);
                    }
                }
                return { success: false, altitude: altitude };
            };

            let step = 5;
            let left = 0;
            let right = maxVal;
            let bestGuess = -1;
            let bestAltitude = -1;

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

                await ns.dnet.authenticate(hostname, char.repeat(nLen));
                await ns.sleep(40);

                let h = await ns.dnet.heartbleed(hostname, { peek: true });
                if (h && h.logs) {
                    let logsArr = Array.isArray(h.logs) ? h.logs : [h.logs];
                    for (let entry of logsArr) {
                        let entryStr = typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
                        entryStr = entryStr.replace(/\\/g, '');

                        if (entryStr.includes(`"passwordAttempted":"${char.repeat(nLen)}"`) || entryStr.includes(`passwordAttempted: ${char.repeat(nLen)}`)) {
                            let dataMatch = entryStr.match(/"data"\s*:\s*"([^"]+)"/) || entryStr.match(/data:\s*([^\s,]+(?:,[^\s,]+)*)/);
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
                }
            }

            let finalGuess = discoveredPassword.map(c => c || pool[0]).join('');
            if ((await ns.dnet.authenticate(hostname, finalGuess)).success) return { success: true, password: finalGuess };
            return { success: false };
        }

        case "(The Labyrinth)": {
            const opposites = { "north": "south", "south": "north", "east": "west", "west": "east" };

            const visitedNodes = new Map();
            let trailStack = [];
            let junctionStack = [];

            try {
                let checkHb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (checkHb && checkHb.logs) {
                    let logStr = JSON.stringify(checkHb.logs);
                    let reportMatch = logStr.match(/\{"coords":\[\d+,\d+\],.*?\}/);
                    if (reportMatch) {
                        let parsedData = JSON.parse(reportMatch[0]);
                        ns.tryWritePort(19, `[SWARM-PING] Host: ${currentHost} | Node Coordinates: ${parsedData.coords[0]},${parsedData.coords[1]}`);
                    }
                }
            } catch (e) { ns.tryWritePort(14, `[EXCEPTION14] - ${e}`) }

            const saveFile = `maze-${hostname}.txt`;
            const homeHost = "home";

            if (ns.fileExists(saveFile, homeHost)) {
                if (ns.scp(saveFile, currentHost, homeHost)) {
                    try {
                        let fileContent = ns.read(saveFile);
                        if (fileContent) {
                            let parsedData = JSON.parse(fileContent);
                            junctionStack = parsedData.junctionStack || [];
                            if (parsedData.visitedNodes) {
                                for (let [coords, nodeData] of Object.entries(parsedData.visitedNodes)) {
                                    visitedNodes.set(coords, nodeData);
                                }
                            }
                        }
                    } catch (e) {
                        ns.tryWritePort(14, `[MAZE-LOAD-ERROR] Failed parsing state for ${hostname}`);
                    }
                }
            }

            const syncMazeToHome = () => {
                try {
                    let payload = {
                        junctionStack: junctionStack,
                        visitedNodes: Object.fromEntries(visitedNodes)
                    };
                    ns.write(saveFile, JSON.stringify(payload), "w");
                    ns.scp(saveFile, homeHost, currentHost);
                } catch (e) { ns.tryWritePort(14, `[EXCEPTION15] - ${e}`) }
            };

            let preHb = await ns.dnet.heartbleed(hostname, { peek: true });
            let preLogStr = preHb && preHb.logs ? JSON.stringify(preHb.logs) : "";

            if (!preLogStr.includes('"data"')) {
                await ns.dnet.authenticate(hostname, "south");
                await ns.sleep(60);
            }

            for (let step = 0; step < 400; step++) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (!hb || !hb.logs) break;

                let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                let rawData = "";
                let labReportObj = null;

                for (let i = 0; i < logsArr.length; i++) {
                    let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                    let m = logStr.match(/"data"\s*:\s*"([^"]+)"/);
                    if (m) rawData = m[1].replace(/"\/g"/, '');

                    let reportMatch = logStr.match(/\{"coords":\[\d+,\d+\],.*?\}/);
                    if (reportMatch) {
                        try {
                            labReportObj = JSON.parse(reportMatch[0]);
                        } catch (e) { ns.tryWritePort(14, `[EXCEPTION16] - ${e}`) }
                    }
                }

                if (!rawData || !labReportObj) {
                    await ns.sleep(40);
                    continue;
                }

                if (rawData.includes("!!") || !rawData.includes("\\u2588")) {
                    let finalPass = rawData.trim();
                    if ((await ns.dnet.authenticate(hostname, finalPass)).success) {
                        ns.write(saveFile, "", "w");
                        ns.scp(saveFile, homeHost, currentHost);
                        return { success: true, password: finalPass };
                    }
                }

                let curX = labReportObj.coords[0];
                let curY = labReportObj.coords[1];
                let curCoordStr = `${curX},${curY}`;

                if (rawData.includes("Not a valid move") || rawData.includes("wall")) {
                    ns.tryWritePort(14, `[MAZE-WALL] Collision detected at ${curCoordStr}. Wiping direction vector cache.`);
                    if (trailStack.length > 0) trailStack.pop();
                }

                if (!visitedNodes.has(curCoordStr)) {
                    let allOpenDirs = [];
                    if (labReportObj.north) allOpenDirs.push("north");
                    if (labReportObj.south) allOpenDirs.push("south");
                    if (labReportObj.east) allOpenDirs.push("east");
                    if (labReportObj.west) allOpenDirs.push("west");

                    let availableDirs = [];
                    for (let dir of allOpenDirs) {
                        let tX = curX, tY = curY;
                        if (dir === "north") tY -= 1;
                        if (dir === "south") tY += 1;
                        if (dir === "east") tX += 1;
                        if (dir === "west") tX -= 1;

                        if (!visitedNodes.has(`${tX},${tY}`)) {
                            availableDirs.push(dir);
                        }
                    }

                    visitedNodes.set(curCoordStr, {
                        availableDirs: availableDirs,
                        allOpenDirs: allOpenDirs
                    });

                    if (allOpenDirs.length > 2 && availableDirs.length > 0) {
                        junctionStack.push(curCoordStr);
                    }
                    syncMazeToHome();
                }

                let node = visitedNodes.get(curCoordStr);

                if (node.availableDirs.length > 0) {
                    let nextDir = node.availableDirs.shift();
                    trailStack.push({ coord: curCoordStr, dir: nextDir });
                    syncMazeToHome();
                    await ns.dnet.authenticate(hostname, `go ${nextDir}`);
                } else {
                    if (trailStack.length > 0) {
                        let lastStep = trailStack.pop();
                        let backDir = opposites[lastStep.dir];
                        ns.tryWritePort(14, `[MAZE-BACKTRACK] Backtracking from ${curCoordStr} via direction: [${backDir}]`);
                        await ns.dnet.authenticate(hostname, `go ${backDir}`);

                        if (junctionStack.length > 0 && junctionStack[junctionStack.length - 1] === curCoordStr) {
                            if (node.availableDirs.length === 0) {
                                junctionStack.pop();
                                syncMazeToHome();
                            }
                        }
                    } else if (junctionStack.length > 0) {
                        let targetJunction = junctionStack[junctionStack.length - 1];
                        let queue = [[curCoordStr, []]];
                        let bfsVisited = new Set([curCoordStr]);
                        let shortcutPath = null;

                        while (queue.length > 0) {
                            let [curr, path] = queue.shift();
                            if (curr === targetJunction) {
                                shortcutPath = path;
                                break;
                            }
                            let memoNode = visitedNodes.get(curr);
                            if (memoNode) {
                                for (let dir of memoNode.allOpenDirs) {
                                    let [bX, bY] = curr.split(',').map(Number);
                                    if (dir === "north") bY -= 1;
                                    if (dir === "south") bY += 1;
                                    if (dir === "east") bX += 1;
                                    if (dir === "west") bX -= 1;
                                    let nextNodeStr = `${bX},${bY}`;

                                    if (!bfsVisited.has(nextNodeStr) && visitedNodes.has(nextNodeStr)) {
                                        bfsVisited.add(nextNodeStr);
                                        queue.push([nextNodeStr, path.concat({ coord: curr, dir: dir })]);
                                    }
                                }
                            }
                        }

                        if (shortcutPath && shortcutPath.length > 0) {
                            let recoveryStep = shortcutPath[0];
                            trailStack.push(recoveryStep);
                            await ns.dnet.authenticate(hostname, `go ${recoveryStep.dir}`);
                        } else {
                            let recoveryJunction = junctionStack.pop();
                            ns.tryWritePort(14, `[MAZE-RECOVERY] Pathfinder failure at ${curCoordStr}. Resetting routing track to junction: ${recoveryJunction}`);
                            syncMazeToHome();
                            break;
                        }
                    } else {
                        await ns.dnet.authenticate(hostname, "go north");
                        break;
                    }
                }

                await ns.sleep(60);
            }
            return { success: false };
        }

        case "Pr0verFl0":
            let pLength = details.passwordLength || 7;
            await ns.dnet.authenticate(hostname, "A".repeat(pLength));
            let pHb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (pHb && pHb.logs) {
                let pLogStr = Array.isArray(pHb.logs) ? JSON.stringify(pHb.logs) : String(pHb.logs);
                pLogStr = pLogStr.replace(/\\/g, '');
                let prefixMatch = pLogStr.match(/expected '([^\\u25a0']+)/i) || pLogStr.match(/passwordExpected:\s*([^\\u25a0\s]+)/i);
                let knownPrefix = prefixMatch ? prefixMatch[1] : "";
                let pool = Array.from(new Set(pLogStr.replace(/[^a-zA-Z0-9]/g, '').split('')));
                if (knownPrefix && pLength - knownPrefix.length === 3) {
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
            let fallbackGuess = "A".repeat(pLength + 8);
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

                                let isValid = false;
                                if (owFormat === "numeric" && /^\d+$/.test(potentialPassword)) isValid = true;
                                if (owFormat === "alphabetic" && /^[a-zA-Z]+$/.test(potentialPassword)) isValid = true;
                                if (owFormat === "alphanumeric" && /^[a-zA-Z0-9]+$/.test(potentialPassword)) isValid = true;

                                if (isValid) {
                                    if ((await ns.dnet.authenticate(hostname, potentialPassword)).success) {
                                        return { success: true, password: potentialPassword };
                                    }
                                }
                            }

                            for (let i = 0; i <= rawDataStr.length - owLen; i++) {
                                let sub = rawDataStr.substr(i, owLen);
                                let isValid = false;
                                if (owFormat === "numeric" && /^\d+$/.test(sub)) isValid = true;
                                if (owFormat === "alphabetic" && /^[a-zA-Z]+$/.test(sub)) isValid = true;
                                if (owFormat === "alphanumeric" && /^[a-zA-Z0-9]+$/.test(sub)) isValid = true;

                                if (isValid) {
                                    if ((await ns.dnet.authenticate(hostname, sub)).success) {
                                        return { success: true, password: sub };
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return { success: false };
        }

        case "OctantVoxel": {
            let baseStr = "";
            let numStr = "";

            if (details.data && String(details.data).includes(',')) {
                let parts = String(details.data).split(',');
                baseStr = parts[0];
                numStr = parts[1];
            } else if (details.passwordHint) {
                let voxelMatch = details.passwordHint.match(/base\s+(\d+(:\.\d+)?)\s+number\s+([a-fA-F0-9.]+)/i);
                if (voxelMatch) {
                    baseStr = voxelMatch[1];
                    numStr = voxelMatch[2];
                }
            }

            if (baseStr && numStr) {
                const baseVal = parseFloat(baseStr);
                const numParts = numStr.split('.');
                const intPart = numParts[0];
                const fracPart = numParts[1] || "";

                let accumulatedSum = 0.0;

                for (let i = 0; i < intPart.length; i++) {
                    let char = intPart[intPart.length - 1 - i];
                    let digitValue = parseInt(char, 36);
                    accumulatedSum += digitValue * Math.pow(baseVal, i);
                }

                for (let i = 0; i < fracPart.length; i++) {
                    let char = fracPart[i];
                    let digitValue = parseInt(char, 36);
                    accumulatedSum += digitValue * Math.pow(baseVal, -(i + 1));
                }

                let finalPassword = Math.round(accumulatedSum).toString();
                if ((await ns.dnet.authenticate(hostname, finalPassword)).success) {
                    return { success: true, password: finalPassword };
                }
            }
            return { success: false };
        }

        case "DeepGreen": {
            let dgLen = details.passwordLength || 3;
            const tFormat = details.passwordFormat || "numeric";
            let pool = "0123456789";
            if (tFormat === "alphanumeric") {
                pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            } else if (tFormat === "alphabetic") {
                pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            }
            const clues = [];
            const checkCandidate = (cand) => {
                for (const clue of clues) {
                    let exact = 0, wrong = 0;
                    let cArr = cand.split(""), gArr = clue.guess.split("");
                    for (let j = 0; j < dgLen; j++) {
                        if (cArr[j] === gArr[j]) { exact++; cArr[j] = null; gArr[j] = null; }
                    }
                    for (let j = 0; j < dgLen; j++) {
                        if (gArr[j] !== null) {
                            let idx = cArr.indexOf(gArr[j]);
                            if (idx !== -1) { wrong++; cArr[idx] = null; }
                        }
                    }
                    if (exact !== clue.exact || wrong !== clue.wrong) return false;
                }
                return true;
            };
            let yieldCounter = 0;
            const findNextCandidate = async (prefix) => {
                if (prefix.length === dgLen) {
                    return checkCandidate(prefix) ? prefix : null;
                }
                for (let i = 0; i < pool.length; i++) {
                    yieldCounter++;
                    if (yieldCounter % 5000 === 0) await ns.sleep(0);
                    let res = await findNextCandidate(prefix + pool[i]);
                    if (res) return res;
                }
                return null;
            };
            let mastermindRuns = 0;
            let currentGuess = pool[0].repeat(dgLen);
            while (mastermindRuns < 120) {
                mastermindRuns++;
                const res = await ns.dnet.authenticate(hostname, currentGuess);
                if (res.success) return { success: true, password: currentGuess };
                let targetExact = null, targetWrong = null, lStr = "", guesses = 0;
                while (guesses < 15) {
                    await ns.sleep(40);
                    let h = await ns.dnet.heartbleed(hostname, { peek: true });
                    lStr = Array.isArray(h?.logs) ? JSON.stringify(h.logs) : String(h?.logs || "");
                    lStr = lStr.replace(/\\/g, "");
                    if (lStr.includes(`"passwordAttempted":"${currentGuess}"`) || lStr.includes(`passwordAttempted: ${currentGuess}`)) break;
                    guesses++;
                }
                let dMatch = lStr.match(/"data"\s*:\s*"(\d+),(\d+)"/) || lStr.match(/data:\s*(\d+),(\d+)/);
                if (dMatch) {
                    targetExact = parseInt(dMatch[1], 10);
                    targetWrong = parseInt(dMatch[2], 10);
                    clues.push({ guess: currentGuess, exact: targetExact, wrong: targetWrong });
                }
                yieldCounter = 0;
                let nextCand = await findNextCandidate("");
                if (!nextCand) break;
                currentGuess = nextCand;
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
                        let char = str[i];
                        let rem = str.slice(0, i) + str.slice(i + 1);
                        for (let sub of generatePermutations(rem)) {
                            out.push(char + sub);
                        }
                    }
                    return Array.from(new Set(out));
                };
                for (let p of generatePermutations(phpDigits)) {
                    if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
                }
            }
            return { success: false };

        case "OrdoXenos":
            let cipherText = "";
            let maskPool = [];
            let oData = details.data || "";
            if (oData.includes(";")) {
                let parts = oData.split(";");
                cipherText = parts[0];
                maskPool = parts[1].split(" ").map(b => parseInt(b, 2));
            }
            if (cipherText && maskPool.length >= cipherText.length) {
                let decrypted = "";
                for (let i = 0; i < cipherText.length; i++) {
                    decrypted += String.fromCharCode(cipherText.charCodeAt(i) ^ maskPool[i]);
                }
                if ((await ns.dnet.authenticate(hostname, decrypted)).success) return { success: true, password: decrypted };
            }
            let maskStr = details.passwordHint.match(/"([^"]+)"/);
            if (maskStr) {
                let encrypted = maskStr[1];
                for (let key = 1; key < 256; key++) {
                    let decrypted = "";
                    for (let i = 0; i < encrypted.length; i++) String.fromCharCode(encrypted.charCodeAt(i) ^ key);
                    if ((await ns.dnet.authenticate(hostname, decrypted)).success) return { success: true, password: decrypted };
                }
            }
            return { success: false };

        case "PrimeTime 2":
            let numMatch = details.passwordHint.match(/\d+/);
            if (numMatch) {
                let num = parseInt(numMatch[0], 10), divisor = 2;
                while (divisor * divisor <= num) { if (num % divisor === 0) num /= divisor; else divisor++; }
                let pw = num.toString();
                if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
            }
            return { success: false };

        case "110100100":
            let binarySource = details.data || "";
            if (!binarySource) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logStr = Array.isArray(hb.logs) ? JSON.stringify(hb.logs) : String(hb.logs);
                    let m = logStr.match(/"data"\s*:\s*"([^"]+)"/) || logStr.match(/data:\s*([01\s]+)/);
                    if (m) binarySource = m[1];
                }
            }
            if (binarySource && binarySource.includes(" ")) {
                let decodedText = binarySource.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
                if ((await ns.dnet.authenticate(hostname, decodedText)).success) return { success: true, password: decodedText };
            }
            let fallbackPw = parseInt(details.modelId, 2).toString();
            return { success: (await ns.dnet.authenticate(hostname, fallbackPw)).success, password: fallbackPw };

        case "EuroZone Free": {
            const euCountries = [
                "albania", "andorra", "andorra la vella", "austria", "balgariya", "belarus",
                "belgien", "belgique", "belgium", "belgi\u00eb", "belorussia", "bih",
                "bosna i hercegovina", "bosnia", "bosnia & herzegovina", "bosnia and hercegovina",
                "bosnia-herzegovina", "brd", "britain", "bssr", "bulgaria", "bulgariya",
                "byelorussia", "ceska republika", "cesko", "ch", "citta del vaticano",
                "confoederatio helvetica", "conf\u0153deratio helvetica", "crna gora", "croatia",
                "croatie", "cyprus", "czech republic", "czechia", "czechoslovakia", "danmark",
                "denmark", "deutschland", "east germany", "eesti", "eesti vabariik", "eire",
                "ellada", "elliniki dimokratia", "espana", "espa\u00f1a", "estonia",
                "federal republic of germany", "finland", "france", "french republic", "frg",
                "fuerstentum liechtenstein", "fyrom", "f\u00fcrstentum liechtenstein", "gb", "georgia",
                "germany", "grand duchy of luxembourg", "grand-duche de luxembourg",
                "grand-duch\u00e9 de luxembourg", "great britain", "great britain & ni", "greece",
                "gro\u00dfherzogtum luxemburg", "gruziya", "hellas", "hellenic republic", "holland",
                "hrvatska", "hrvatska republika", "hungarian republic", "hungary", "iceland",
                "ireland", "irish free state", "island", "italia", "italian republic", "italy",
                "kazakhstan", "kazakstan", "kibris", "kingdom of belgium", "kingdom of denmark",
                "kingdom of greece", "kingdom of norway", "kingdom of sweden", "kingdom of the netherlands",
                "kongeriget danmark", "koninkrijk belgi\u00eb", "konungariket sverige", "kosova",
                "kosovo", "kosovo i metohija", "kroatien", "kypros", "k\u00f6nigreich belgien",
                "k\u00f6nigreich spanien", "la france", "latvia", "latvija", "latvijas republika",
                "letzebuerg", "liechtenstein", "lietuva", "lietuvos respublika", "lithuania",
                "luxembourg", "lydveldid island", "l\u00ebtzebuerg", "l\u00fd\u00f0veldi\u00f0 \u00edsland", "macedonia",
                "magyarorszag", "malta", "moldavia", "moldova", "monaco", "montenegro",
                "most serene republic of san marino", "nederland", "netherlands", "noreg", "norge",
                "north macedonia", "norway", "oesterreich", "osterreich", "people's socialist republic of albania",
                "peoples socialist republic of albania", "poblacht na heireann", "poblacht na h\u00e9ireann",
                "poland", "polska", "portugal", "principality andorra", "principality monaco",
                "principality of andorra", "principality of liechtenstein", "principality of monaco",
                "principante de monaco", "principalt d'andorra", "principat d'andorra",
                "principat dandorra", "qazaqstan", "reino de espana", "reino de espa\u00f1a",
                "repubblica di san marino", "repubblica italiana", "repubblika ta malta",
                "repubblika ta' malta", "republic of albania", "republic of andorra",
                "republic of austria", "republic of belarus", "republic of croatia",
                "republic of cyprus", "republic of eire", "republic of estonia",
                "republic of france", "republic of germany", "republic of greece",
                "republic of hungary", "republic of iceland", "republic of ireland",
                "republic of italy", "republic of kosovo", "republic of latvia",
                "republic of luxembourg", "republic of malta", "republic of moldova",
                "republic of north macedonia", "republic of poland", "republic of san marino",
                "republic of serbia", "republic of spain", "republic of turkey",
                "republic of turkiye", "republic of t\u00fcrkiye", "republic of ukraine",
                "republica moldova", "republica portuguesa", "republik \u00f6sterreich",
                "republika e shqip\u00ebris\u00eb", "republika slovenija", "republika srbija",
                "republiken finland", "republik bulgarien", "republik slowenien",
                "rep\u00fablica portuguesa", "romania", "rom\u00e2nia", "rossiya", "rossiyskaya federatsiya",
                "roumania", "royaume de belgique", "rumania", "russia", "russian federation",
                "rzeczpospolita polska", "r\u00e9publique fran\u00e7aise", "sakartvelo", "san marino",
                "san marino republic", "schweiz", "serbia", "severna makedonija", "shqiperi",
                "shqiperia", "shqip\u00ebri", "shqip\u00ebria", "slovak republic", "slovakia",
                "slovenia", "slovenija", "slovenska republika", "slovensko", "slovensk\u00e1 republika",
                "southern cyprus", "southern ireland", "soviet union", "spain", "srbija",
                "state of vatican city", "status civitatis vaticanae", "suisse", "suomen tasavalta",
                "suomi", "sverige", "svizzera", "sweden", "swiss confederation", "switzerland",
                "the czech republic", "the federal republic", "the french republic", "the holy see",
                "the holy see vatican", "the irish free state", "the kingdom of spain",
                "the russian empire", "the slovak republic", "the swiss federation", "the ukraine",
                "the united kingdom", "the vatican", "turkey", "turkiye", "turkiye cumhuriyeti",
                "t\u00fcrkiye", "t\u00fcrkiye cumhuriyeti", "ukraina", "ukraine", "ukrayina", "united kingdom",
                "united kingdom of gb", "united kingdom of great britain and northern ireland",
                "ussr", "vatican", "vatican city", "vatican city state", "west germany",
                "white russia", "yugoslavia", "\u00e9ire", "\u00edsland", "\u00f6sterreich", "\u010desko", "\u010desk\u00e1 republika",
                "gibraltar", "faroe islands", "faeroe islands", "isle of man", "greenland",
                "guernsey", "jersey", "svalbard", "aland", "\u00e5land", "england", "scotland", "wales",
                "northern ireland", "armenia", "azerbaijan", "republic of armenia", "republic of azerbaijan",
                "akrotiri and dhekelia", "akrotiri", "dhekelia", "transnistria", "abkhazia", "south ossetia",
                "northern cyprus", "turkish republic of northern cyprus"
            ];

            let tLen = details.passwordLength || 5;
            let filteredCountries = euCountries.filter(c => c.length === tLen);

            for (let country of filteredCountries) {
                const uniqueGuesses = new Set();

                const lowercaseWords = ["of", "del", "de", "the", "and", "da", "dandorra", "&"];
                let grammaticalTitle = country.split(' ').map((w, index) => {
                    if (index > 0 && lowercaseWords.includes(w.toLowerCase())) {
                        return w.toLowerCase();
                    }
                    return w.charAt(0).toUpperCase() + w.slice(1);
                }).join(' ');
                uniqueGuesses.add(grammaticalTitle);

                let wordTitle = country.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                uniqueGuesses.add(wordTitle);

                let hyphenTitle = country.split('-').map(part => part.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join('-');
                uniqueGuesses.add(hyphenTitle);

                uniqueGuesses.add(country);
                uniqueGuesses.add(country.toUpperCase());

                for (let guess of uniqueGuesses) {
                    if ((await ns.dnet.authenticate(hostname, guess)).success) {
                        return { success: true, password: guess };
                    }
                }
            }
            return { success: false };
        }

        case "BigMo%od": {
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
            let moduli = [];
            let remainders = [];

            for (let p of primes) {
                let pStr = p.toString();
                let authRes = await ns.dnet.authenticate(hostname, pStr);
                if (authRes.success) return { success: true, password: pStr };

                await ns.sleep(40);
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                    let foundRem = null;

                    for (let i = logsArr.length - 1; i >= 0; i--) {
                        let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                        logStr = logStr.replace(/\\/g, '');

                        if (logStr.includes(`"passwordAttempted":"${pStr}"`) || logStr.includes(`passwordAttempted: ${pStr}`) || logStr.includes(`passwordAttempted: ${p}`)) {
                            let m = logStr.match(/"data"\s*:\s*"(\d+)"/) || logStr.match(/"data"\s*:\s*(\d+)/) || logStr.match(/data:\s*(\d+)/);
                            if (m) {
                                foundRem = parseInt(m[1], 10);
                                break;
                            }
                        }
                    }

                    if (foundRem !== null) {
                        moduli.push(BigInt(p));
                        remainders.push(BigInt(foundRem));
                    }
                }
            }

            if (moduli.length > 0) {
                let N = 1n;
                for (let m of moduli) N *= m;

                let result = 0n;
                for (let i = 0; i < moduli.length; i++) {
                    let ni = moduli[i];
                    let ri = remainders[i];
                    let Ni = N / ni;

                    let inv = 0n;
                    for (let j = 1n; j < ni; j++) {
                        if ((Ni * j) % ni === 1n) {
                            inv = j;
                            break;
                        }
                    }
                    result += ri * Ni * inv;
                }

                let finalPassword = (result % N).toString();

                let bmLen = details.passwordLength;
                if (bmLen && finalPassword.length < bmLen) {
                    finalPassword = finalPassword.padStart(bmLen, '0');
                }

                if ((await ns.dnet.authenticate(hostname, finalPassword)).success) return { success: true, password: finalPassword };
            }
            return { success: false };
        }

        case "2G_cellular": {
            let cellLen = details.passwordLength || 6;
            const cellPool = details.passwordFormat === "numeric" ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let cellGuess = Array(cellLen).fill(cellPool[0]);

            for (let pos = 0; pos < cellLen; pos++) {
                for (let cIdx = 0; cIdx < cellPool.length; cIdx++) {
                    cellGuess[pos] = cellPool[cIdx];
                    let guessStr = cellGuess.join('');

                    if ((await ns.dnet.authenticate(hostname, guessStr)).success) return { success: true, password: guessStr };

                    let mismatchIdx = null;
                    let guesses = 0;
                    while (guesses < 15) {
                        await ns.sleep(40);
                        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                        if (hb && hb.logs) {
                            let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                            let logFound = false;

                            for (let i = 0; i < logsArr.length; i++) {
                                let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                                if (logStr.includes(`"passwordAttempted":"${guessStr}"`) || logStr.includes(`passwordAttempted: ${guessStr}`)) {
                                    logFound = true;
                                    let match = logStr.match(/checking each character \((\d+)\)/i);
                                    if (match) {
                                        mismatchIdx = parseInt(match[1], 10);
                                        break;
                                    }
                                }
                            }
                            if (logFound) break;
                        }
                        guesses++;
                    }

                    if (mismatchIdx !== null && mismatchIdx > pos) {
                        break;
                    }
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, cellGuess.join(''))).success, password: cellGuess.join('') };
        }

        case "MathML":
            if (details.data) {
                try {
                    let cleanExpr = String(details.data).split(',')[0];

                    cleanExpr = cleanExpr.replace(/\u04b3/g, '*')
                        .replace(/\u2795/g, '+')
                        .replace(/\u2796/g, '-')
                        .replace(/\u00f7/g, '/');

                    if (/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
                        const evalRes = Function(`return (${cleanExpr})`)();
                        let targetLen = details.passwordLength || 2;
                        let resStr = evalRes.toString();

                        if (resStr.length > targetLen) {
                            resStr = resStr.slice(0, targetLen);
                        } else if (resStr.length < targetLen && resStr.includes('.')) {
                            resStr = evalRes.toFixed(targetLen - resStr.indexOf('.') - 1);
                        } else if (resStr.length < targetLen) {
                            resStr = resStr.padEnd(targetLen, '0');
                        }

                        if ((await ns.dnet.authenticate(hostname, resStr)).success) return { success: true, password: resStr };
                    }
                } catch (e) { ns.tryWritePort(14, `[EXCEPTION17] - ${e}`) }
            }
            return { success: false };

        case "TopPass": {
            let tLen = details.passwordLength || 6;
            const tFormat = details.passwordFormat || "alphabetic";

            const passwordDictionary = {
                3: ["123", "abc", "god", "cat", "dog", "sex", "win", "pop", "sam", "tom", "fox", "ace"],
                4: ["1234", "qwer", "test", "love", "baby", "rock", "star", "king", "pass", "cool", "root", "l33t", "wolf", "lion", "zero", "link"],
                5: ["12345", "login", "admin", "hello", "trust", "enter", "ninja", "tiger", "angel", "jesus", "money", "black", "white", "smart", "cyber", "linux", "apple"],
                6: ["123456", "qwerty", "secret", "dragon", "monkey", "cheese", "shadow", "master", "server", "crypto", "oracle", "access", "online", "secure", "yellow", "purple", "orange", "matrix", "hunter", "killer", "soccer", "player", "wizard", "camera", "kernel", "socket", "binary", "cipher", "vector", "bypass", "bullet", "shield", "system"],
                7: ["1234567", "welcome", "network", "connect", "warrior", "phoenix", "hacking", "gateway", "computer", "sunshine", "letmein", "pokemon", "freedom", "batman", "mustard", "forever", "perfect", "justice", "destiny", "phantom", "crystal", "digital", "unknown", "offline", "account", "startup"],
                8: ["12345678", "password", "iloveyou", "princess", "baseball", "football", "superman", "starwars", "internet", "security", "terminal", "database", "critical", "software", "download", "firewall", "override", "loopback", "infinite", "absolute"],
                9: ["123456789", "character", "anonymous", "dangerous", "interface", "mainframe", "algorithm", "developer", "encrypted", "masterkey", "processor"],
                10: ["1234567890", "letmeingin", "cyberpunk2", "properties", "production", "background", "everything", "collection", "management", "experience"]
            };

            let candidates = [];

            for (let key of Object.keys(globalPasswordVault)) {
                let val = globalPasswordVault[key];
                [key, val].forEach(str => {
                    if (typeof str === 'string') {
                        let tokens = str.split(/[^a-zA-Z0-9]/);
                        for (let token of tokens) {
                            if (token.length === tLen) {
                                candidates.push(token, token.toLowerCase(), token.toUpperCase());
                            }
                        }
                    }
                });
            }

            let lengthPool = passwordDictionary[tLen] || [];
            for (const word of lengthPool) {
                candidates.push(word.toLowerCase(), word.charAt(0).toUpperCase() + word.slice(1), word.toUpperCase());
            }

            if (tFormat === "numeric") {
                const commonPins = ["1234567890".slice(0, tLen), "0123456789".slice(0, tLen), "9876543210".slice(0, tLen)];
                for (let d = 0; d <= 9; d++) commonPins.push(String(d).repeat(tLen));
                candidates.push(...commonPins);
            }

            let uniqueGuesses = Array.from(new Set(candidates)).filter(g => {
                if (g.length !== tLen) return false;
                if (tFormat === "numeric") return /^\d+$/.test(g);
                if (tFormat === "alphabetic") return /^[a-zA-Z]+$/.test(g);
                return true;
            });

            for (const guess of uniqueGuesses) {
                if ((await ns.dnet.authenticate(hostname, guess)).success) {
                    return { success: true, password: guess };
                }
            }

            if (tFormat === "numeric" && tLen <= 6) {
                for (let i = 0; i < Math.pow(10, tLen); i++) {
                    let guess = i.toString().padStart(tLen, '0');
                    if ((await ns.dnet.authenticate(hostname, guess)).success) {
                        return { success: true, password: guess };
                    }
                }
            }
            return { success: false };
        }

        default:
            if (!reportedUnknowns.has(hostname)) {
                ns.tryWritePort(14, `[NEW MODEL] Host: ${hostname} | Model: ${details.modelId} | Hint: ${details.passwordHint} | Dump: ${JSON.stringify(details)}`);
                reportedUnknowns.add(hostname);
            }
            return { success: false };
    }
}

/**
 * \ud83d\udd01\ufe0f SHARDED & INSTRUMENTED MUTEX: Spreads locks across ports 10-13 and logs pool sizes.
 * @param {NS} ns */
function acquireNetworkLock(ns, hostname, modelId) {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
        hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lockPort = 10 + Math.abs(hash % 4);
    const currentHost = ns.getHostname();

    let currentLocksData = ns.readPort(lockPort);
    let locks = (currentLocksData === "NULL PORT DATA" || currentLocksData === "NULL DATA" || !currentLocksData) ? [] : JSON.parse(currentLocksData);

    let now = Date.now();
    let validLocks = [];
    let isLocked = false;

    for (let lock of locks) {
        let targetHost = typeof lock === 'string' ? lock : lock.host;
        let acquiredAt = typeof lock === 'string' ? now : lock.acquiredAt;

        if (targetHost === hostname) {
            if (now - acquiredAt > 300000) {
                // Clean stale configurations
            } else {
                isLocked = true;
                validLocks.push({ host: targetHost, model: typeof lock === 'string' ? 'Unknown' : lock.model, acquiredAt: acquiredAt });
            }
        } else {
            if (now - acquiredAt <= 300000) {
                validLocks.push({ host: targetHost, model: typeof lock === 'string' ? 'Unknown' : lock.model, acquiredAt: acquiredAt });
            }
        }
    }

    if (isLocked) {
        ns.writePort(lockPort, JSON.stringify(validLocks));
        localCooldowns.set(hostname, Date.now() + 1000);
        return false;
    }

    validLocks.push({ host: hostname, model: modelId, acquiredAt: now });
    ns.writePort(lockPort, JSON.stringify(validLocks));
    return true;
}

/**
 * \ud83d\udd01\ufe0f SHARDED MUTEX CLEANUP: Releases the lock on the correct shard and applies back-off cooldown.
 * @param {NS} ns */
function releaseNetworkLock(ns, hostname) {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
        hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lockPort = 10 + Math.abs(hash % 4);

    let currentLocksData = ns.readPort(lockPort);
    if (currentLocksData === "NULL PORT DATA" || currentLocksData === "NULL DATA" || !currentLocksData) return;

    let locks = JSON.parse(currentLocksData);
    locks = locks.filter(lock => (typeof lock === 'string' ? lock : lock.host) !== hostname);
    ns.writePort(lockPort, JSON.stringify(locks));

    localCooldowns.set(hostname, Date.now() + 500);
}

/** @param {AutocompleteData} data */
export function autocomplete(data) {
    return ["--tail"];
}
