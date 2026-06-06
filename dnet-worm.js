// Global tracking sets to prevent duplicate data flooding across log files
const reportedUnknowns = new Set();
const reportedSpecs = new Set();
const reportedStalls = new Set(); // 🆕 Tracker to block repeating log spam
const deadTopology = new Set();   // 🆕 Blacklist to block physically impossible paths
const localCooldowns = new Map(); // 🆕 Tracker to stop hammering fluctuating targets

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();

    // =========================================================================
    // 🔁 SELF-HEALING DEPENDENCY BOOTLOADER
    // If running on the master home node, automatically ensure the logger is alive
    // =========================================================================
    if (currentHost === "home") {
        const loggerScript = "dnet-logger.js";

        if (!ns.scriptRunning(loggerScript, "home")) {
            ns.tprint("📋 [SYSTEM] Central logging daemon was offline. Initiating self-healing launch...");
            if (ns.fileExists(loggerScript, "home")) {
                ns.exec(loggerScript, "home");
                ns.tprint("🟢 [SYSTEM] dnet-logger.js successfully activated in the background.");
            } else {
                ns.tprint(`⚠️ [ERROR] Cannot boot logger: ${loggerScript} is missing from home storage!`);
            }
        }
    }
    // =========================================================================

    while (true) {
        // 1. Core Housekeeping: Free up blocked RAM on Darknet servers
        if (currentHost !== "home" && currentHost !== "darkweb") {
            try {
                await ns.dnet.memoryReallocation();
            } catch (e) {
                // Background safety catch
            }
        }

        // 2. Looting: Look for, automatically unlock, and print any .cache files
        const cacheFiles = ns.ls(currentHost, '.cache');
        for (const cacheFile of cacheFiles) {
            try {
                const result = await ns.dnet.openCache(cacheFile);
                const lootMessage = `[LOOT] [${currentHost}] Opened ${cacheFile}! Contents: ${JSON.stringify(result)}`;
                ns.tryWritePort(15, lootMessage);
            } catch (e) {
                // Background safety catch
            }
        }

        // 3. Propagation: Find and target adjacent connected darknet servers
        const nearbyServers = ns.dnet.probe();
        for (const hostname of nearbyServers) {
            const authenticated = await serverSolver(ns, hostname);
            if (!authenticated) {
                continue;
            }

            ns.tryWritePort(15, `[AUTH-SUCCESS] [${currentHost}] Colonized and secured access to: ${hostname}`);
            ns.scp(scriptName, hostname, currentHost);
            ns.exec(scriptName, hostname, { preventDuplicates: true });
        }

        // 4. Monetization: Use leftover RAM on colonized servers to Phish
        if (currentHost !== "home" && currentHost !== "darkweb") {
            try {
                await ns.dnet.phishingAttack();
            } catch (e) {
                // Fallback
            }
        }

        // 5. Market Manipulation: Focus 100% botnet power on our single largest holding
        if (currentHost !== "home" && currentHost !== "darkweb") {
            let whaleTarget = ns.peek(16);

            if (whaleTarget !== "NULL DATA" && whaleTarget !== "NULL PORT DATA" && whaleTarget) {
                try {
                    await ns.dnet.promoteStock(whaleTarget);
                } catch (e) {
                    // Context change protection
                }
            }
        }

        await ns.sleep(2000);
    }
}

/** * Orchestrates server status gates, transaction locks, and comprehensive log dumps.
 * @param {NS} ns 
 * @param {string} hostname 
 */
/** * Orchestrates server status gates, transaction locks, and comprehensive log dumps.
 * @param {NS} ns 
 * @param {string} hostname 
 */
async function serverSolver(ns, hostname) {
    // 🛡️ COOLDOWN GATE: Skip hitting global ports if we dealt with this host recently
    if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) {
        return false;
    }

    // 🛡️ TOPOLOGY GATE: If this node previously threw a 351, skip it instantly
    if (deadTopology.has(hostname)) {
        return false;
    }

    const details = ns.dnet.getServerDetails(hostname);

    if (!details.isConnectedToCurrentServer || !details.isOnline) {
        return false;
    }

    if (details.hasSession) {
        ns.tryWritePort(14, `[MUTEX-TRACE] [${ns.getHostname()}] Skipping ${hostname} -> Session already active.`);
        return true;
    }

    if (!acquireNetworkLock(ns, hostname)) {
        return false;
    }

    if (!reportedSpecs.has(hostname)) {
        ns.tryWritePort(14, `[TARGET-SPEC] [${ns.getHostname()}] Scanning ${hostname} | Model: ${details.modelId} | Hint: ${details.passwordHint}`);
        reportedSpecs.add(hostname);
    }

    const success = await executeCrackingMatrix(ns, hostname, details);

    if (!success) {
        try {
            // Proactively intercept the firewall log to categorize the failure type
            let hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb) {
                // If it's a routing failure, permanently blacklist it on this node
                if (hb.code === 351) {
                    deadTopology.add(hostname);
                }

                // Only generate a file write if we haven't logged this specific alert code yet
                let stallKey = `${hostname}-${hb.code}`;
                if (!reportedStalls.has(stallKey)) {
                    await dumpDetailedDiagnostic(ns, hostname, details);
                    reportedStalls.add(stallKey);
                }
            }
        } catch (e) {
            // Background safety catch
        }
    }

    releaseNetworkLock(ns, hostname);
    return success;
}

/**
 * 🚨 AUTOMATED TERMINAL EMULATOR: Captures and stringifies full background UI states to Port 14.
 * @param {NS} ns
 * @param {string} hostname
 * @param {any} details
 */
async function dumpDetailedDiagnostic(ns, hostname, details) {
    const divider = "=".repeat(80);
    let logBuffer = [];

    logBuffer.push(`\n🚨 [STALL-ALERT] FULL METADATA DUMP FOR UNRESOLVED HOST: ${hostname}`);
    logBuffer.push(divider);

    logBuffer.push(`[UI FIELDS] Model: ${details.modelId}`);
    logBuffer.push(`[UI FIELDS] Hint:  ${details.passwordHint}`);
    logBuffer.push(`[UI FIELDS] Rules: Length: ${details.passwordLength} | Format: ${details.passwordFormat}`);
    logBuffer.push(`[UI FIELDS] Specs: Difficulty: ${details.difficulty} | Depth: ${details.depth}`);
    if (details.data) {
        logBuffer.push(`[UI FIELDS] Variable Payload Data: ${JSON.stringify(details.data)}`);
    }
    logBuffer.push(divider);

    try {
        let hb = await ns.dnet.heartbleed(hostname, { peek: true });
        if (hb.code == ns.enums.DarknetResponseCode.DirectConnectionRequired ||
            hb.code == ns.enums.DarknetResponseCode.ServiceUnavailable) return;
        if (hb) {
            logBuffer.push(`[FIREWALL RESPONSE] Status: ${hb.success ? "SUCCESS" : "FAILED"}`);
            logBuffer.push(`[FIREWALL RESPONSE] Code:   ${hb.code || 401}`);
            logBuffer.push(`[FIREWALL RESPONSE] Msg:    ${hb.message || "Unauthorized"}`);
            logBuffer.push(divider);
            let stringifiedHB = JSON.stringify(hb, null, 2);
            logBuffer.push(`[RAW LOGS] hb:\n${stringifiedHB}`);
            if (stringifiedHB.includes("401")) {
                ns.tprint(`model: ${modelId}`);
                ns.tprint(`host: ${hostname}`);
                ns.tprint(stringifiedHB);
            }
            logBuffer.push(divider);

            if (hb.logs) {
                logBuffer.push(`[HEARTBLEED MEMORY STACK] Scraped Buffer Logs:`);
                if (Array.isArray(hb.logs)) {
                    hb.logs.forEach((line, index) => {
                        let cleanLine = typeof line === 'object' ? JSON.stringify(line) : String(line);
                        logBuffer.push(`   Line [${index}]: ${cleanLine}`);
                    });
                } else {
                    let lines = String(hb.logs).split("\n");
                    lines.forEach(line => logBuffer.push(`   > ${line.trim()}`));
                }
            } else {
                logBuffer.push(`[HEARTBLEED MEMORY STACK] Log buffer slot is completely empty [].`);
            }
        }
    } catch (e) {
        logBuffer.push(`[HEARTBLEED ERROR] Failed to execute query channel step - modelID:${modelId} - ${e}`);
    }

    logBuffer.push(divider);
    logBuffer.push(`[WORM NODE: ${ns.getHostname()}] End of data transaction frame.\n`);

    let finalDiagnosticReport = logBuffer.join("\n");
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
            return (await ns.dnet.authenticate(hostname, "")).success;

        case "FreshInstall_1.0":
            if (details.passwordFormat === "numeric") {
                let fiLen = details.passwordLength || 4;
                for (let i = 0; i < Math.pow(10, Math.min(fiLen, 4)); i++) {
                    let guess = i.toString().padStart(fiLen, '0');
                    if ((await ns.dnet.authenticate(hostname, guess)).success) return true;
                }
            } else {
                const words = details.passwordHint.trim().split(" ");
                const lastWord = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, "");
                if (lastWord && (await ns.dnet.authenticate(hostname, lastWord)).success) return true;

                const commonDefaults = ["password", "admin", "root", "1234", "default", "settings"];
                for (const pwd of commonDefaults) {
                    if ((await ns.dnet.authenticate(hostname, pwd)).success) return true;
                }
            }
            return false;

        case "AccountsManager_4.2": {
            let fiLen = details.passwordLength || 2;
            let low = 0;
            let high = Math.pow(10, fiLen) - 1; // Dynamically sets cap (e.g., length 2 = 99, length 3 = 999)

            let rangeMatch = details.passwordHint.match(/\d+/g);
            if (rangeMatch && rangeMatch.length >= 2) {
                high = parseInt(rangeMatch[rangeMatch.length - 1], 10);
                low = parseInt(rangeMatch[rangeMatch.length - 2], 10);
            }

            let accountsAttempts = 0;
            while (low <= high && accountsAttempts < 15) {
                accountsAttempts++;
                let mid = Math.floor((low + high) / 2);

                // 🎯 FIXED: Zero-pad the guess string to match the strict length rule (e.g., 5 -> "05")
                let guessStr = mid.toString().padStart(fiLen, '0');

                if ((await ns.dnet.authenticate(hostname, guessStr)).success) return true;

                // ⏳ CRITICAL TIMING FIX: Sleep immediately after auth so the database can commit the log entry
                await ns.sleep(40);

                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                    let feedbackText = "";

                    for (let i = 0; i < logsArr.length; i++) {
                        let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]).toLowerCase();

                        // 🎯 FIXED: Explicitly verify that the log line belongs to this EXACT guess token
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
                        break; // If token signature is missing or garbled, jump straight to linear safety sweep
                    }
                } else {
                    break;
                }
            }

            // Linear safety sweep covering the remaining narrow boundary window
            for (let i = low; i <= high; i++) {
                let finalGuess = i.toString().padStart(fiLen, '0');
                if ((await ns.dnet.authenticate(hostname, finalGuess)).success) return true;
            }
            return false;
        }

        case "BellaCuore":
            let bHint = details.passwordHint || "";
            if (bHint.includes("between")) {
                let limits = bHint.match(/'([^']+)'/g);
                if (limits && limits.length >= 2) {
                    let minVal = parseRoman(limits[0].replace(/'/g, ''));
                    let maxVal = parseRoman(limits[1].replace(/'/g, ''));
                    let bLen = details.passwordLength || 3;
                    for (let i = minVal; i <= maxVal; i++) {
                        let guess = i.toString().padStart(bLen, '0');
                        if ((await ns.dnet.authenticate(hostname, guess)).success) return true;
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
                    if ((await ns.dnet.authenticate(hostname, parseRoman(romanStr).toString())).success) return true;
                }
            }
            return false;

        case "DeskMemo_3.1":
            const memoMatch = details.passwordHint.match(/\d+/);
            return memoMatch ? (await ns.dnet.authenticate(hostname, memoMatch[0])).success : false;

        case "CloudBlare(tm)":
            let captchaDigits = "";
            if (details.data) {
                for (const char of details.data) {
                    if (!isNaN(char) && char !== " ") captchaDigits += char;
                }
            }
            if (captchaDigits && (await ns.dnet.authenticate(hostname, captchaDigits)).success) return true;
            let blareMatch = details.passwordHint.match(/\d+/);
            return blareMatch ? (await ns.dnet.authenticate(hostname, blareMatch[0])).success : false;

        case "RateMyPix.Auth":
            let rpmLen = details.passwordLength || 5;
            let currentPin = Array(rpmLen).fill('0');

            // 🎯 DYNAMIC OPTIMIZATION POOL
            // If the firewall specifies numeric, drop the alphabet entirely to accelerate execution
            const alphaNumericPool = details.passwordFormat === "numeric"
                ? "0123456789"
                : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            // Firing first check to map the baseline score for "00000..."
            await ns.dnet.authenticate(hostname, currentPin.join(''));
            await ns.sleep(40);
            let hbInit = await ns.dnet.heartbleed(hostname, { peek: true });
            let lastScore = 0;
            if (hbInit && hbInit.logs) {
                let logStr = Array.isArray(hbInit.logs) ? JSON.stringify(hbInit.logs) : String(hbInit.logs);
                let m = logStr.match(/(\d+)\/\d+/);
                if (m) lastScore = parseInt(m[1], 10);
            }

            for (let pos = 0; pos < rpmLen; pos++) {
                let originalChar = currentPin[pos];
                let locked = false;

                for (let cIdx = 0; cIdx < alphaNumericPool.length; cIdx++) {
                    let char = alphaNumericPool[cIdx];
                    currentPin[pos] = char;
                    let guess = currentPin.join('');

                    if ((await ns.dnet.authenticate(hostname, guess)).success) return true;
                    await ns.sleep(40); // Hard sync database pause

                    let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    if (hb && hb.logs) {
                        let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                        let newScore = null;

                        for (let i = 0; i < logsArr.length; i++) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            if (logStr.includes(`"passwordAttempted":"${guess}"`) || logStr.includes(`passwordAttempted: ${guess}`)) {
                                let m = logStr.match(/(\d+)\/\d+/);
                                if (m) { newScore = parseInt(m[1], 10); break; }
                            }
                        }

                        if (newScore !== null) {
                            if (newScore > lastScore) {
                                lastScore = newScore;
                                locked = true;
                                break; // Score improved, keep character and advance column
                            } else if (newScore < lastScore) {
                                currentPin[pos] = originalChar; // Score dropped, revert to baseline
                                locked = true;
                                break;
                            }
                        }
                    }
                }
                if (!locked) currentPin[pos] = originalChar;
            }
            return (await ns.dnet.authenticate(hostname, currentPin.join(''))).success;

        case "Factori-Os":
            let fLength = details.passwordLength || 2;
            if (details.passwordFormat === "numeric" && fLength <= 4) {
                let fCandidates = [];
                for (let i = 0; i < Math.pow(10, fLength); i++) fCandidates.push(i.toString().padStart(fLength, '0'));

                let fHb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (fHb && fHb.logs) {
                    let fLogStr = Array.isArray(fHb.logs) ? JSON.stringify(fHb.logs) : String(fHb.logs);
                    let incMatches = [...fLogStr.matchAll(/IS divisible by '(\d+)'/gi)];
                    for (let match of incMatches) fCandidates = fCandidates.filter(c => parseInt(c, 10) % parseInt(match[1]) === 0);
                    let excMatches = [...fLogStr.matchAll(/is not divisible by '(\d+)'/gi)];
                    for (let match of excMatches) fCandidates = fCandidates.filter(c => parseInt(c, 10) % parseInt(match[1]) !== 0);
                }
                for (let guess of fCandidates) {
                    if ((await ns.dnet.authenticate(hostname, guess)).success) return true;
                }
            }
            return false;

        case "KingOfTheHill":
            let kLength = details.passwordLength || 2;
            if (details.passwordFormat === "numeric" && kLength <= 3) {
                for (let i = 0; i < Math.pow(10, kLength); i++) {
                    if ((await ns.dnet.authenticate(hostname, i.toString().padStart(kLength, '0'))).success) return true;
                }
            } else {
                const mountainGuesses = ["everest", "8848", "8849", "mountain", "summit", "peak", "k2"];
                for (const peak of mountainGuesses) {
                    if ((await ns.dnet.authenticate(hostname, peak)).success) return true;
                    if ((await ns.dnet.authenticate(hostname, peak.toUpperCase())).success) return true;
                }
            }
            return false;

        case "Laika4":
            const dogGuesses = ["laika", "laika4", "fido", "spot", "rover", "max"];
            for (const pup of dogGuesses) {
                if ((await ns.dnet.authenticate(hostname, pup)).success) return true;
                if ((await ns.dnet.authenticate(hostname, pup.toUpperCase())).success) return true;
            }
            return false;

        case "NIL": {
            let nLen = details.passwordLength || 6;
            const tFormat = details.passwordFormat || "numeric";

            // 🎯 DEFENSIVE CHARACTER POOL SELECTION
            let pool = "0123456789";
            if (tFormat === "alphanumeric") {
                pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            } else if (tFormat === "alphabetic") {
                pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            }

            // Fill our baseline signature buffer using the first index item of our target pool
            let currentPin = Array(nLen).fill(pool[0]);

            // Isolated inner execution context to parse the stringified JSON data frames
            const checkMatch = async (pinArr) => {
                await ns.dnet.authenticate(hostname, pinArr.join(''));
                await ns.sleep(50); // Balanced synchronization delay for database commit

                let h = await ns.dnet.heartbleed(hostname, { peek: true });
                let lStr = Array.isArray(h?.logs) ? JSON.stringify(h.logs) : String(h?.logs || "");

                // 🧼 SANITIZATION FIX: Strip out all literal backslashes to normalize double-stringified JSON payload
                lStr = lStr.replace(/\\/g, '');

                // Extract the array block contained inside the leaked data field
                let match = lStr.match(/"data"\s*:\s*"([^"]+)"/) || lStr.match(/data:\s*([^\s,]+(?:,[^\s,]+)*)/);
                return match ? match[1].split(',') : [];
            };

            // Prime the system stack to read our baseline array map
            let currentFeedback = await checkMatch(currentPin);

            // If the target firewall supports positional telemetry feedback, engage the climber
            if (currentFeedback.length > 0 && (currentFeedback.includes("yes") || currentFeedback.includes("yesn't"))) {
                for (let pos = 0; pos < nLen; pos++) {
                    // If the baseline character already satisfies this position slot, do not shift it
                    if (currentFeedback[pos] === "yes") continue;

                    // Sweep linearly through the active character pool space
                    for (let cIdx = 1; cIdx < pool.length; cIdx++) {
                        currentPin[pos] = pool[cIdx];
                        let newFeedback = await checkMatch(currentPin);

                        // Check if we hit the correct character for this specific isolated slot
                        if (newFeedback && newFeedback[pos] === "yes") {
                            // Character locked! Update baseline tracking snapshot for future position lookups
                            currentFeedback = newFeedback;
                            break;
                        }
                    }
                }

                // Run final confirmation unlock transaction
                const finalRes = await ns.dnet.authenticate(hostname, currentPin.join(''));
                if (finalRes.success) return true;
            }

            // 📉 LOW-OVERHEAD CRASH FALLBACK DICTIONARY
            const nilGuesses = ["", "nil", "null", "none", "authorized", "0".repeat(nLen), "1".repeat(nLen)];
            for (let guess of nilGuesses) {
                let adjusted = guess;
                if (adjusted.length > nLen) adjusted = adjusted.slice(0, nLen);
                else if (adjusted.length < nLen && adjusted.length > 0) adjusted = adjusted.padEnd(nLen, '0');

                if (adjusted.length === nLen || adjusted === "") {
                    if ((await ns.dnet.authenticate(hostname, adjusted)).success) return true;
                }
            }
            return false;
        }

        case "(The Labyrinth)": {
            const moveHistory = [];
            const opposites = {
                "north": "south",
                "south": "north",
                "east": "west",
                "west": "east"
            };

            // 🎯 COLD START GATE: Prime the log buffer if it's completely fresh
            let preHb = await ns.dnet.heartbleed(hostname, { peek: true });
            let preLogStr = preHb && preHb.logs ? JSON.stringify(preHb.logs) : "";

            // If no data frame exists yet, issue an initial probe to force the map to draw
            if (!preLogStr.includes('"data"')) {
                await ns.dnet.authenticate(hostname, "south");
                await ns.sleep(60); // Small wait to ensure database transaction commits
            }

            // Engage standard radar-guided DFS tracking loop
            for (let step = 0; step < 100; step++) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (!hb || !hb.logs) break;

                let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                let rawData = "";

                for (let i = 0; i < logsArr.length; i++) {
                    let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                    let m = logStr.match(/"data"\s*:\s*"([^"]+)"/);
                    if (m) {
                        rawData = m[1].replace(/\\n/g, '\n');
                        break;
                    }
                }

                if (!rawData) break;

                let lines = rawData.split('\n').filter(l => l.length > 0);
                if (lines.length < 3) break;

                // Map out openings around the central '@' character element
                let openMoves = [];
                if (lines[0][1] !== '█') openMoves.push("north");
                if (lines[2][1] !== '█') openMoves.push("south");
                if (lines[1][2] !== '█') openMoves.push("east");
                if (lines[1][0] !== '█') openMoves.push("west");

                let lastMove = moveHistory[moveHistory.length - 1];
                let lastMoveOpposite = lastMove ? opposites[lastMove] : null;
                let forwardMoves = openMoves.filter(dir => dir !== lastMoveOpposite);

                let chosenMove = "";

                if (forwardMoves.length > 0) {
                    chosenMove = forwardMoves[0];
                    moveHistory.push(chosenMove);
                } else if (moveHistory.length > 0) {
                    let deadMove = moveHistory.pop();
                    chosenMove = opposites[deadMove];
                } else {
                    break;
                }

                let res = await ns.dnet.authenticate(hostname, `go ${chosenMove}`);
                if (res.success) return true;

                await ns.sleep(60);
            }
            return false;
        }

        case "Pr0verFl0":
            let pLength = details.passwordLength || 7;
            await ns.dnet.authenticate(hostname, "A".repeat(pLength));
            let pHb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (pHb && pHb.logs) {
                let pLogStr = Array.isArray(pHb.logs) ? JSON.stringify(pHb.logs) : String(pHb.logs);
                pLogStr = pLogStr.replace(/\\/g, '');
                let prefixMatch = pLogStr.match(/expected '([^■']+)/i) || pLogStr.match(/passwordExpected:\s*([^■\s]+)/i);
                let knownPrefix = prefixMatch ? prefixMatch[1] : "";
                let pool = Array.from(new Set(pLogStr.replace(/[^a-zA-Z0-9]/g, '').split('')));
                if (knownPrefix && pLength - knownPrefix.length === 3) {
                    for (let c1 of pool) {
                        for (let c2 of pool) {
                            for (let c3 of pool) {
                                if ((await ns.dnet.authenticate(hostname, knownPrefix + c1 + c2 + c3)).success) return true;
                            }
                        }
                    }
                }
            }
            return (await ns.dnet.authenticate(hostname, "A".repeat(pLength + 8))).success;

        case "OpenWebAccessPoint": {
            let owLen = details.passwordLength || 4;

            // 1. Unconditionally inspect the heartbleed logs regardless of format profile
            let oHb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (oHb && oHb.logs) {
                let oLogStr = Array.isArray(oHb.logs) ? JSON.stringify(oHb.logs) : String(oHb.logs);
                let cleanHost = hostname.split(':')[0];

                // 🎯 OPTIMIZATION A: Expanded pattern matcher to support alphanumeric key leaks ([a-zA-Z0-9])
                let pattern = new RegExp(cleanHost.replace(/[^a-zA-Z0-9_&%]/g, '\\$&') + ":([a-zA-Z0-9]+)");
                let match = oLogStr.match(pattern);

                if (match && match[1].length === owLen) {
                    if ((await ns.dnet.authenticate(hostname, match[1])).success) return true;
                }

                // 🎯 OPTIMIZATION B: Token-Specific Word Miner fallback
                // Instead of ripping raw numbers, look for strings sitting adjacent to explicit hint phrases
                let genericMatches = oLogStr.match(/[a-zA-Z0-9]+/g) || [];
                for (let token of Array.from(new Set(genericMatches))) {
                    if (token.length === owLen && token !== "1234567890".slice(0, owLen)) {
                        if ((await ns.dnet.authenticate(hostname, token)).success) return true;
                    }
                }
            }

            // 2. Fallback execution tracks if the memory log is completely wiped/empty
            if (details.passwordFormat === "numeric") {
                let numericPool = (hostname + details.passwordHint + (details.data || "")).replace(/[^0-9]/g, '');
                if (numericPool.length >= owLen && (await ns.dnet.authenticate(hostname, numericPool.slice(0, owLen))).success) return true;
                if ((await ns.dnet.authenticate(hostname, "1234567890".slice(0, owLen))).success) return true;
            } else {
                const standardWifiDefaults = ["", "cafe", "coffee", "guest", "wifi", "public", "open", "password", "admin"];
                for (const guess of standardWifiDefaults) {
                    let adjustedGuess = guess;
                    if (adjustedGuess.length > owLen) adjustedGuess = adjustedGuess.slice(0, owLen);
                    if ((await ns.dnet.authenticate(hostname, adjustedGuess)).success) return true;
                }
            }
            return false;
        }

        case "OctantVoxel":
            let base = 8, numStr = "";
            if (details.data && String(details.data).includes(',')) {
                let parts = String(details.data).split(',');
                base = parseInt(parts[0], 10); numStr = parts[1];
            } else {
                let voxelMatch = details.passwordHint.match(/base\s+(\d+)\s+number\s+([a-fA-F0-9]+)/i);
                if (voxelMatch) { base = parseInt(voxelMatch[1], 10); numStr = voxelMatch[2]; }
            }
            return numStr ? (await ns.dnet.authenticate(hostname, parseInt(numStr, base).toString())).success : false;

        case "DeepGreen":
            let dgLen = details.passwordLength || 3;
            let dgCants = [];
            for (let i = 0; i < Math.pow(10, dgLen); i++) dgCants.push(i.toString().padStart(dgLen, '0'));
            let mastermindRuns = 0;
            while (dgCants.length > 0 && mastermindRuns < 25) {
                mastermindRuns++;
                let currentGuess = dgCants[0];
                const res = await ns.dnet.authenticate(hostname, currentGuess);
                if (res.success) {
                    ns.tryWritePort(14, `🎉 [MASTERMIND-SUCCESS] [${ns.getHostname()}] Successfully cracked ${hostname} using password: ${currentGuess}`);
                    return true;
                }
                let targetExact = null, targetWrong = null;
                await ns.sleep(60);
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                    for (let i = logsArr.length - 1; i >= 0; i--) {
                        let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                        logStr = logStr.replace(/\\/g, '');
                        if (logStr.includes(`"passwordAttempted":"${currentGuess}"`) || logStr.includes(`passwordAttempted: ${currentGuess}`)) {
                            let dataMatch = logStr.match(/"data"\s*:\s*"(\d+),(\d+)"/) || logStr.match(/data:\s*(\d+),(\d+)/);
                            if (dataMatch) { targetExact = parseInt(dataMatch[1], 10); targetWrong = parseInt(dataMatch[2], 10); break; }
                        }
                    }
                }
                if (targetExact === null) { dgCants.shift(); continue; }
                dgCants = dgCants.filter(cand => {
                    let exact = 0, wrong = 0;
                    let cArr = cand.split(''), gArr = currentGuess.split('');
                    for (let j = 0; j < dgLen; j++) { if (cArr[j] === gArr[j]) { exact++; cArr[j] = null; gArr[j] = null; } }
                    for (let j = 0; j < dgLen; j++) { if (gArr[j] !== null && cArr.indexOf(gArr[j]) !== -1) { wrong++; cArr[cArr.indexOf(gArr[j])] = null; } }
                    return exact === targetExact && wrong === targetWrong;
                });
            }
            return false;

        case "PHP 5.4":
            // 🛡️ GENERIC ADAPTIVE PERMUTATION SOLVER: Processes all lengths dynamically
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
                    if ((await ns.dnet.authenticate(hostname, p)).success) return true;
                }
            }
            return false;

        case "OrdoXenos":
            // 🛡️ BITWISE STRING STREAM MASKER: Handles sequential layout keys automatically
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
                if ((await ns.dnet.authenticate(hostname, decrypted)).success) return true;
            }
            let maskStr = details.passwordHint.match(/"([^"]+)"/);
            if (maskStr) {
                let encrypted = maskStr[1];
                for (let key = 1; key < 256; key++) {
                    let decrypted = "";
                    for (let i = 0; i < encrypted.length; i++) decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key);
                    if ((await ns.dnet.authenticate(hostname, decrypted)).success) return true;
                }
            }
            return false;

        case "PrimeTime 2":
            let numMatch = details.passwordHint.match(/\d+/);
            if (numMatch) {
                let num = parseInt(numMatch[0], 10), divisor = 2;
                while (divisor * divisor <= num) { if (num % divisor === 0) num /= divisor; else divisor++; }
                if ((await ns.dnet.authenticate(hostname, num.toString())).success) return true;
            }
            return false;

        case "110100100":
            // 🛡️ DYNAMIC BINARY DECRYPTOR: Converts space-separated byte arrays natively
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
                if ((await ns.dnet.authenticate(hostname, decodedText)).success) return true;
            }
            return (await ns.dnet.authenticate(hostname, parseInt(details.modelId, 2).toString())).success;

        case "EuroZone Free":
            // 🌍 COMPREHENSIVE EU MEMBER STATE DICTIONARY
            // Expanded to cover all official EU nations, common variants, and regional neighbors
            const euCountries = [
                "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia",
                "czech republic", "denmark", "estonia", "finland", "france", "germany",
                "greece", "hungary", "ireland", "italy", "latvia", "lithuania",
                "luxembourg", "malta", "netherlands", "poland", "portugal", "romania",
                "slovakia", "slovenia", "spain", "sweden", "united kingdom", "uk",
                "switzerland", "norway"
            ];

            for (let country of euCountries) {
                // 1. Test standard lowercase format (e.g., "france")
                if ((await ns.dnet.authenticate(hostname, country)).success) return true;

                // 2. Test strict uppercase format (e.g., "FRANCE")
                if ((await ns.dnet.authenticate(hostname, country.toUpperCase())).success) return true;

                // 3. Test proper noun Title Case format (e.g., "France")
                let titleCase = country[0].toUpperCase() + country.slice(1);
                if ((await ns.dnet.authenticate(hostname, titleCase)).success) return true;
            }
            return false;

        case "BigMo%od":
            return details.data ? (await ns.dnet.authenticate(hostname, String(details.data))).success : false;

        case "2G_cellular":
            // 🛡️ SIDE-CHANNEL ATTACK ENGINE: Exploits character verification loop leaks
            let cellLen = details.passwordLength || 6;

            // Optimization pool filter: Skip the alphabet entirely if format is strictly numeric
            const cellPool = details.passwordFormat === "numeric"
                ? "0123456789"
                : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            let cellGuess = Array(cellLen).fill(cellPool[0]);

            for (let pos = 0; pos < cellLen; pos++) {
                for (let cIdx = 0; cIdx < cellPool.length; cIdx++) {
                    cellGuess[pos] = cellPool[cIdx];
                    let guessStr = cellGuess.join('');

                    // Issue authorization token payload
                    if ((await ns.dnet.authenticate(hostname, guessStr)).success) return true;
                    await ns.sleep(40); // Standard stack commit window

                    let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    if (hb && hb.logs) {
                        let logsArr = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                        let mismatchIdx = null;

                        // Parse history trace for this specific string transaction
                        for (let i = 0; i < logsArr.length; i++) {
                            let logStr = typeof logsArr[i] === 'object' ? JSON.stringify(logsArr[i]) : String(logsArr[i]);
                            if (logStr.includes(`"passwordAttempted":"${guessStr}"`) || logStr.includes(`passwordAttempted: ${guessStr}`)) {
                                let match = logStr.match(/checking each character \((\d+)\)/i);
                                if (match) {
                                    mismatchIdx = parseInt(match[1], 10);
                                    break;
                                }
                            }
                        }

                        // If the mismatch target index has moved past our current slot, lock it!
                        if (mismatchIdx !== null && mismatchIdx > pos) {
                            break;
                        }
                    }
                }
            }
            return (await ns.dnet.authenticate(hostname, cellGuess.join(''))).success;

        case "MathML":
            if (details.data && /^[0-9+\-*/().\s]+$/.test(String(details.data))) {
                try {
                    const evalRes = Function(`return (${String(details.data)})`)();
                    if ((await ns.dnet.authenticate(hostname, String(evalRes))).success) return true;
                } catch (e) { }
            }
            return false;

        case "TopPass": {
            const tLen = details.passwordLength || 6;
            const tFormat = details.passwordFormat || "alphabetic";
            let tCandidates = [];

            if (tFormat === "numeric") {
                // 🔢 COMMON NUMERIC PIN DICTIONARY
                // Dynamically builds high-probability sequential and repeating PIN clusters
                const commonPins = [
                    "1234567890".slice(0, tLen),             // Forward sequence (1234)
                    "0123456789".slice(0, tLen),             // Zero-start sequence (0123)
                    "9876543210".slice(0, tLen),             // Reverse sequence (9876)
                    "4321098765".slice(0, tLen),             // Classic countdown (4321)
                    "1212121212".slice(0, tLen),             // Alternate repeat (1212)
                    "2020202020".slice(0, tLen),             // Century repeat (2020)
                    "2026202620".slice(0, tLen)              // Current timestamp anchor (2026)
                ];

                // Generate pure repeating blocks (0000, 1111, 2222, 5555, 7777, 9999)
                ["0", "1", "2", "3", "5", "7", "9"].forEach(d => commonPins.push(d.repeat(tLen)));

                tCandidates = Array.from(new Set(commonPins));
            } else {
                // 🔤 COMMON ALPHABETIC WORD DICTIONARY
                const topDictionary = [
                    "root", "admin", "pass", "user", "login", "hello", "trust", "qwerty",
                    "secret", "passwd", "matrix", "master", "shadow", "server", "crypto",
                    "oracle", "access", "online", "secure", "welcome", "network", "connect",
                    "warrior", "phoenix", "hacking", "gateway", "password", "security",
                    "internet", "computer"
                ];

                tCandidates = topDictionary.filter(pwd => pwd.length === tLen);

                // Fallback pad/slice if no dictionary words match the exact required layout length
                if (tCandidates.length === 0) {
                    tCandidates = ["admin", "password", "network"].map(w =>
                        w.length > tLen ? w.slice(0, tLen) : w.padEnd(tLen, 'a')
                    );
                }
            }

            // Execute rapid authorization sweeps across candidates
            for (const guess of tCandidates) {
                if ((await ns.dnet.authenticate(hostname, guess)).success) return true;
            }
            return false;
        }

        default:
            if (!reportedUnknowns.has(hostname)) {
                ns.tryWritePort(14, `[NEW MODEL] Host: ${hostname} | Model: ${details.modelId} | Hint: ${details.passwordHint} | Dump: ${JSON.stringify(details)}`);
                reportedUnknowns.add(hostname);
            }
            return false;
    }
}

/**
 * 🛡️ SHARDED & INSTRUMENTED MUTEX: Spreads locks across ports 10-13 and logs pool sizes.
 * @param {NS} ns */
function acquireNetworkLock(ns, hostname) {
    // 🔍 OPTION 2: Hash the hostname to pick a port from 10 to 13
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
        hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lockPort = 10 + Math.abs(hash % 4);
    const diagPort = 14;
    const currentHost = ns.getHostname();

    let currentLocksData = ns.peek(lockPort);
    let locks = (currentLocksData === "NULL DATA" || currentLocksData === "NULL PORT DATA" || !currentLocksData) ? [] : JSON.parse(currentLocksData);

    if (locks.includes(hostname)) {
        // Lock is held. Set a 10-second local cooldown so we don't spam this specific port
        localCooldowns.set(hostname, Date.now() + 10000);
        ns.tryWritePort(diagPort, `[SHARD-TRACE] [${currentHost}] Port ${lockPort} DENIED ${hostname}. Lock busy.`);
        return false;
    }

    locks.push(hostname);
    ns.clearPort(lockPort);
    ns.writePort(lockPort, JSON.stringify(locks));

    // PROOF POINT: Log the port used and the size of its specific array
    ns.tryWritePort(diagPort, `[SHARD-TRACE] [${currentHost}] Port ${lockPort} ACQUIRED ${hostname}. Current Shard Pool Size: ${locks.length}`);
    return true;
}

/**
 * 🛡️ SHARDED MUTEX CLEANUP: Releases the lock on the correct shard and applies back-off cooldown.
 * @param {NS} ns */
function releaseNetworkLock(ns, hostname) {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
        hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lockPort = 10 + Math.abs(hash % 4);

    let currentLocksData = ns.peek(lockPort);
    if (currentLocksData === "NULL DATA" || currentLocksData === "NULL PORT DATA" || !currentLocksData) return;

    let locks = JSON.parse(currentLocksData);
    locks = locks.filter(lockedHost => lockedHost !== hostname);
    ns.clearPort(lockPort);
    ns.writePort(lockPort, JSON.stringify(locks));

    // 🔍 OPTION 3: Set a 30-second local cooldown after finishing a cycle to let topology settle
    localCooldowns.set(hostname, Date.now() + 30000);
}

/** @param {AutocompleteData} data */
export function autocomplete(data) {
    return ["--tail"];
}