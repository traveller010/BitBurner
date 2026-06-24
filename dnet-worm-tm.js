const WORM_VERSION = "v1.6.3";
const WORM_COST = 13.80;
const dataFilesCopied = new Set();
const reportedUnknowns = new Set();
const reportedStalls = new Set();
const stasisFile = "stasis-links.txt";
let globalPasswordVault = {};
let stasisLinks = [];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();

    function getTimestamp() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}:${String(d.getMilliseconds()).padStart(3, '0')}`;
    }

    function logSuccess(msg) { ns.tryWritePort(15, `[${getTimestamp()}] [${currentHost}] [${WORM_VERSION}] SUCCESS: ${msg}`); }
    function logDiag(msg) { ns.tryWritePort(14, `[${getTimestamp()}] [${currentHost}] [${WORM_VERSION}] DIAG: ${msg}`); }

    getVaultPasswords(ns, currentHost, logDiag, logSuccess);
    lootCacheFiles(ns, currentHost, logDiag, logSuccess);
    stasisLinks = getStasisLinks(ns,currentHost, logDiag);

    while (true) {
        lootCacheFiles(ns, currentHost, logDiag, logSuccess);
        establishStasisLink(ns, currentHost, logDiag, logSuccess);

        if (currentHost == "home") {
            let portUpdate = ns.readPort(17);
            let vaultUpdated = false;
            while (portUpdate !== "NULL PORT DATA" && portUpdate !== "NULL DATA" && portUpdate) {
                try {
                    const update = JSON.parse(portUpdate);
                    if (update.host && update.pass) {
                        globalPasswordVault[update.host] = update.pass;
                        vaultUpdated = true;
                    }
                } catch (e) { }
                portUpdate = ns.readPort(17);
            }
            if (vaultUpdated) {
                ns.write("darknet-keys.js", JSON.stringify(globalPasswordVault), "w");
            }
        }

        const targets = getRankedNearbyServers(ns);
        for (const target of targets) {
            const hostname = target.hostname;
            const serverDetails = ns.dnet.getServerDetails(hostname);
            if (!serverDetails.isOnline) continue;

            const auth = await serverSolver(ns, hostname, currentHost, logDiag, logSuccess);
            if (!auth) {
                continue;
            }
            if (auth.auth && !auth.success) {
                const code = auth.auth.code;
                if (code !== 351 && code !== 503) {
                    if (!JSON.stringify(auth).includes("Unauthorized")) {
                        logDiag(`SERVER SOLVER RESULT: ${JSON.stringify(auth)}`);
                    }
                }
            }

            if (!auth.success) continue;

            if (auth.password && globalPasswordVault[hostname] !== auth.password) {
                globalPasswordVault[hostname] = auth.password;
                ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: auth.password }));
            }

            // 🚀 INTEGRATED SWARM MANAGEMENT: Handle reallocation and deployment directly
            if (auth && auth.success) {
                await manageSwarmDeployment(ns, hostname, currentHost, logDiag, logSuccess);
            }
        }

        // =================================================================
        // 🛰️ OFFICIAL IDLE UTILITY ENGINE
        // =================================================================
        if (currentHost !== "home" && currentHost !== "darkweb") {
            // 1. Stock Manipulation Module (Reads target ticker from Port 16 via ns.peek)
            const stockTarget = ns.peek(16);
            if (stockTarget && stockTarget !== "NULL PORT DATA" && stockTarget !== "NULL DATA" && stockTarget !== "") {
                try {
                    await ns.dnet.promoteStock(stockTarget);
                } catch (e) {
                    logDiag(`Stock promotion error: ${e}`)
                }
            }

            // 2. Phishing Attack Module (Restricted strictly to darknet servers)
            try {
                await ns.dnet.phishingAttack();
            } catch (e) {
                logDiag(`Phishing attack error: ${e}`)
            }
        }
        await ns.sleep(100);
    }
}

/** @param {NS} ns */
// ADD currentHost to the arguments list!
async function serverSolver(ns, hostname, currentHost, logDiag, logSuccess) {
    // if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) return false;

    const details = ns.dnet.getServerDetails(hostname);
    if (!details.isConnectedToCurrentServer || !details.isOnline) return false;

    if (details.hasSession && details.modelId !== "(The Labyrinth)") {
        return { success: true, alreadyActive: true };
    }

    // --- REFINED HEARTBLEED DISCOVERY ---
    const hb = await ns.dnet.heartbleed(hostname, { peek: true });
    if (hb && hb.logs) {
        for (const logEntry of hb.logs) {
            try {
                // Safely attempt to parse; if it fails, it's just a text log, not JSON
                const entry = (typeof logEntry === 'string') ? JSON.parse(logEntry) : logEntry;

                if (entry.code === 200 && entry.passwordAttempted) {
                    const discoveredPass = entry.passwordAttempted;
                    if (globalPasswordVault[hostname] !== discoveredPass) {
                        globalPasswordVault[hostname] = discoveredPass;
                        ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: discoveredPass }));
                        logSuccess(`Discovered ${hostname} password via Heartbleed: ${discoveredPass}`);
                    }
                }
            } catch (e) {
                // Silent catch: logEntry was just text, not JSON, so we ignore it
                continue;
            }
        }
    }

    // Try vault
    if (globalPasswordVault[hostname]) {
        try {
            ns.dnet.connectToSession(hostname, globalPasswordVault[hostname]);
            if (ns.dnet.getServerDetails(hostname).hasSession) {
                return { success: true, password: globalPasswordVault[hostname], alreadyActive: true };
            } else {
                delete globalPasswordVault[hostname];
            }
        } catch (e) { delete globalPasswordVault[hostname]; }
    }

    if (!acquireLock(ns, hostname, details.modelId)) return false;

    try {
        const result = await crackingMatrix(ns, hostname, currentHost, details, logDiag, logSuccess);

        if (!result || !result.success) {
            // 1. Immediately poll the live network status after matrix processing ends
            const freshHb = await ns.dnet.heartbleed(hostname, { peek: true });
            const networkCode = freshHb?.code;

            // 2. Network State Latch: If the server dropped or migrated, override the code
            if (networkCode === 351 || networkCode === 503) {
                if (result && result.auth) {
                    result.auth.code = networkCode;
                    result.auth.message = freshHb.message;
                } else if (result) {
                    result.auth = { code: networkCode, message: freshHb.message };
                }
            }

            const targetAuth = result?.auth || result;
            const code = targetAuth?.code;

            // 3. Evaluate the unified code threshold
            if (code !== 351 && code !== 503) {
                let stallKey = `${hostname}-${details.modelId}`;
                if (!reportedStalls.has(stallKey)) {
                    logDiag(`STALL: ${hostname} (${details.modelId}) Hint: ${details.passwordHint}`);

                    let hbString = JSON.stringify(freshHb);
                    if (!hbString.includes("Server restarting") && !JSON.stringify(targetAuth).includes("Unauthorized")) {
                        logDiag(`STALL DETAILS: ${hbString}`);
                        logDiag(`STALL AUTH DETAILS: ${JSON.stringify(targetAuth)}`);
                    }
                    reportedStalls.add(stallKey);
                }
            }
        }
        return result;
    } catch (e) {
        logDiag(`CRASH in matrix for ${hostname}: ${e}`);
        return false;
    } finally {
        releaseLock(ns, hostname);
    }
}

/** @param {NS} ns */
async function crackingMatrix(ns, hostname, currentHost, details, logDiag, logSuccess) {
    const model = details.modelId;
    const wordSourceFile = "darknet-words.txt";

    // Helper for Heartbleed checks
    const getLogEntry = async (guess) => {
        for (let i = 0; i < 15; i++) {
            await ns.sleep(40);
            const hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb && hb.logs) {
                const logs = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                const entry = logs.find(l => {
                    const s = typeof l === 'string' ? l : JSON.stringify(l);
                    // Match the padded guess ("0050") OR its unpadded version ("50")
                    const unpadded = /^\d+$/.test(guess) ? parseInt(guess, 10).toString() : guess;
                    return s.includes(guess) || s.includes(unpadded);
                });
                if (entry) return entry;
            }
        }
        return null;
    };

    // =================================================================
    // GENERATOR UTILITY (With Editor Linter Bypass Directive)
    // =================================================================
    function* primeGenerator(initialPool = []) {
        for (const p of initialPool) yield p;
        let candidate = initialPool.length > 0 ? initialPool[initialPool.length - 1] + 2 : 2;
        if (candidate === 4) { yield 2; yield 3; candidate = 5; }

        // @ignore-infinite
        while (true) {
            let isPrime = true;
            for (let i = 2; i * i <= candidate; i++) {
                if (candidate % i === 0) { isPrime = false; break; }
            }
            if (isPrime) yield candidate;
            candidate += 2;
        }
    }

    let auth;

    switch (model) {
        case "ZeroLogon":
            auth = await ns.dnet.authenticate(hostname, "");
            return { success: auth.success, password: "", auth: auth };

        case "FreshInstall_1.0": {
            const len = details.passwordLength || 4;
            if (details.passwordFormat === "numeric") {
                const commons = ["123456789".slice(0, len), "0".repeat(len), "1".repeat(len), "9".repeat(len)];
                for (const g of commons) {
                    if ((await ns.dnet.authenticate(hostname, g)).success) {
                        return { success: true, password: g };
                    }
                }
                for (let i = 0; i < Math.pow(10, len); i++) {
                    const g = i.toString().padStart(len, '0');
                    auth = await ns.dnet.authenticate(hostname, g);
                    if (auth.success) return { success: true, password: g };
                    if (i % 50 === 0) await ns.sleep(10);
                }
            } else {
                const hint = details.passwordHint || "";
                const words = hint.split(/\s+/);
                const last = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, "");
                if (last && (await ns.dnet.authenticate(hostname, last)).success) return { success: true, password: last };

                // Harvested Dictionary Fallback Step
                const dict = ["password", "admin", "root", "default"];
                if (ns.fileExists(wordSourceFile, "home")) {
                    if (currentHost === "home" || ns.scp(wordSourceFile, currentHost, "home")) {
                        const harvested = ns.read(wordSourceFile).split(/\r?\n/);
                        for (const w of harvested) {
                            const clean = w.trim();
                            if (clean.length === len) dict.push(clean);
                        }
                    }
                }
                const uniqueCandidates = Array.from(new Set(dict));
                for (const g of uniqueCandidates) {
                    const slicedGuess = g.slice(0, len);
                    auth = await ns.dnet.authenticate(hostname, slicedGuess);
                    if (auth.success) return { success: true, password: slicedGuess };
                }
            }
            return { success: false, auth: auth };
        }

        case "AccountsManager_4.2": {
            const len = details.passwordLength || 4;
            let low = 0, high = Math.pow(10, len) - 1;

            const matches = details.passwordHint.match(/\d+/g);
            if (matches && matches.length >= 2) {
                low = parseInt(matches[0], 10);
                high = parseInt(matches[1], 10);
            }

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const g = mid.toString().padStart(len, '0');

                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return { success: true, password: g };

                await ns.sleep(30);
                const bleed = await ns.dnet.heartbleed(hostname);
                if (bleed && bleed.logs && bleed.logs.length > 0) {
                    let directionFound = false;

                    // Scan backward to match our exact numerical guess signature
                    for (let i = bleed.logs.length - 1; i >= 0; i--) {
                        const logObj = JSON.parse(bleed.logs[i]);
                        if (logObj.passwordAttempted === g) {
                            const feedBackStr = String(logObj.data || "").toLowerCase();
                            if (feedBackStr.includes("higher")) {
                                low = mid + 1;
                                directionFound = true;
                            } else if (feedBackStr.includes("lower")) {
                                high = mid - 1;
                                directionFound = true;
                            }
                            break;
                        }
                    }
                    if (!directionFound) break;
                } else {
                    break;
                }
            }
            return { success: false, auth: auth };
        }

        case "RateMyPix.Auth": {
            const len = details.passwordLength || 5;
            const format = details.passwordFormat || "numeric";
            let pool = "0123456789";
            if (format === "alphanumeric") pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            else if (format === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            let current = Array(len).fill(pool[0]);
            let lastCapturedResult = null;

            const getScore = async (g) => {
                // 1. DIRECT QUERY GATEWAY
                const res = await ns.dnet.authenticate(hostname, g);
                lastCapturedResult = res; // Maintain reference for upward bubbling

                if (res && res.attemptedPassword === g) {
                    if (res.success) return { success: true, score: 999, raw: res };
                    const feedback = res.data || "";
                    const score = feedback.startsWith("0/") ? 0 : (feedback.match(/🌶️/g) || []).length;
                    return { success: false, score: score, raw: res };
                }

                // 2. ASYNCHRONOUS HEARTBLEED FALLBACK BACKSTOP
                for (let retry = 0; retry < 15; retry++) {
                    await ns.sleep(40);
                    const hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    if (hb && hb.logs) {
                        const logs = Array.isArray(hb.logs) ? hb.logs : [hb.logs];

                        for (const l of logs) {
                            try {
                                const entry = (typeof l === 'string') ? JSON.parse(l) : l;

                                // Enforce strict transaction receipt validation
                                if (entry && entry.passwordAttempted === g) {
                                    lastCapturedResult = entry;
                                    if (entry.code === 200 || entry.success) return { success: true, score: 999, raw: entry };

                                    const feedback = entry.data || "";
                                    const score = feedback.startsWith("0/") ? 0 : (feedback.match(/🌶️/g) || []).length;
                                    return { success: false, score: score, raw: entry };
                                }
                            } catch (e) {
                                // Ignore non-JSON system chatter logs lines safely
                                continue;
                            }
                        }
                    }
                }
                return { success: false, score: -1, raw: lastCapturedResult };
            };

            // Establish primary baseline
            let baseRes = await getScore(current.join(''));
            if (baseRes.success || baseRes.score === 999) return { success: true, password: current.join('') };
            let baseScore = baseRes.score;

            let consecutiveErrors = 0;

            // Positional Isolation Search Matrix
            for (let i = 0; i < len; i++) {
                const origChar = current[i];

                for (let j = 1; j < pool.length; j++) {
                    current[i] = pool[j];
                    const res = await getScore(current.join(''));

                    if (res.success || res.score === 999) return { success: true, password: current.join('') };

                    if (res.score === -1) {
                        consecutiveErrors++;
                        if (consecutiveErrors > 5) {
                            current[i] = origChar;
                            break;
                        }
                        j--;
                        await ns.sleep(100);
                        continue;
                    }
                    consecutiveErrors = 0;

                    if (res.score > baseScore) {
                        baseScore = res.score;
                        break; // Step verified, lock current pool[j] and advance position
                    } else if (res.score < baseScore) {
                        current[i] = origChar;
                        break; // Baseline was already optimal, restore and advance position
                    }
                }
            }

            // Total loop expiration fallback: return failure state along with the raw bubbled object
            return { success: false, auth: lastCapturedResult };
        }

        case "Factori-Os": {
            const len = details.passwordLength || 2;
            const max = Math.pow(10, len) - 1;
            const initialPrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43,
                47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127,
                131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199,
                211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283,
                293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383,
                389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467,
                479, 487, 491, 499, 503, 509, 521, 523, 541];

            // Connected to the fallback stream
            const primeStream = primeGenerator(initialPrimes);

            const checkDivisibility = async (n) => {
                const g = n.toString().padStart(len, '0');
                // Leak Path 1 Fixed: Bind sequential prime tests to the matrix frame scope
                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return "WIN";
                await ns.sleep(30);
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    return s.includes("IS divisible") || s.includes('"data":true') || s.includes('data: true');
                }
                return false;
            };

            let knownProduct = 1;
            while (true) {
                const p = primeStream.next().value;
                if (p > max || knownProduct * p > max) break;

                let power = 1;
                while (true) {
                    const testVal = Math.pow(p, power);
                    if (testVal > max) break;
                    const res = await checkDivisibility(testVal);
                    if (res === "WIN") return { success: true, password: testVal.toString().padStart(len, '0') };
                    if (res === true) power++;
                    else break;
                }
                if (power > 1) {
                    knownProduct *= Math.pow(p, power - 1);
                    const finalStr = knownProduct.toString().padStart(len, '0');
                    // Leak Path 2 Fixed: Capture tracking object on partial product checks
                    auth = await ns.dnet.authenticate(hostname, finalStr);
                    if (auth.success) return { success: true, password: finalStr };
                }
            }

            // Fallback localized factor brute step
            for (let i = 0; i <= max; i++) {
                if (i % knownProduct === 0) {
                    const g = i.toString().padStart(len, '0');
                    // Leak Path 3 Fixed: Capture tracking object during fallback brute loop executions
                    auth = await ns.dnet.authenticate(hostname, g);
                    if (auth.success) return { success: true, password: g };
                }
            }

            // Leak Path 4 Fixed: Propagate the absolute final failed transaction telemetry upward
            return { success: false, auth: auth };
        }

        case "EuroZone Free": {
            const countries = ["albania", "andorra", "austria", "belgium", "bulgaria",
                "croatia", "cyprus", "denmark", "estonia", "finland", "france", "germany",
                "greece", "hungary", "iceland", "ireland", "italy", "latvia", "lithuania",
                "luxembourg", "malta", "netherlands", "norway", "poland", "portugal",
                "romania", "russia", "serbia", "slovakia", "slovenia", "spain", "sweden",
                "switzerland", "turkey", "ukraine", "united kingdom", "the united kingdom",
                "republic of cyprus"
            ];
            const len = details.passwordLength;
            const candidates = countries.filter(c => c.length === len);

            // If the filter returns nothing, skip processing and return the gap message instantly
            if (candidates.length === 0) {
                return { success: false, auth: { message: "word length gap", length: len } };
            }

            for (const c of candidates) {
                const variants = [c, c.toUpperCase(), c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
                for (const v of variants) {
                    auth = await ns.dnet.authenticate(hostname, v);
                    if (auth.success) return { success: true, password: v };
                }
            }
            return { success: false, auth: auth };
        }

        case "TopPass": {
            const passDict = {
                3: ["123", "abc", "god", "cat", "dog", "sex", "win", "pop", "sam", "tom", "fox", "ace"],
                4: ["1234", "qwer", "test", "love", "baby", "rock", "star", "king", "pass", "cool", "root", "l33t", "wolf", "lion", "zero", "link"],
                5: ["12345", "login", "admin", "hello", "trust", "enter", "ninja", "tiger", "angel", "jesus", "money", "black", "white", "smart", "cyber", "linux", "apple"],
                6: ["123456", "654321", "112233", "123123", "987654", "121212", "012345", "696969", "666666", "123321", "967609", "555555", "131313", "777777", "qwerty", "secret", "dragon", "master", "system", "qazwsx", "123qwe", "jordan", "pepper", "zxcvbn", "maggie", "159753", "aaaaaa", "ginger", "buster", "asdfgh", "hunter", "430165", "abc123", "monkey", "shadow"],
                7: ["1234567", "welcome", "network", "connect", "warrior", "phoenix", "hacking", "gateway", "computer", "sunshine", "letmein", "pokemon", "freedom", "batman", "mustard", "forever", "perfect", "justice", "destiny", "phantom", "crystal", "digital", "unknown", "offline", "account", "startup"],
                8: ["12345678", "password", "iloveyou", "princess", "baseball", "football", "superman", "starwars", "internet", "security", "terminal", "database", "critical", "software", "download", "firewall", "override", "loopback", "infinite", "absolute", "1qaz2wsx", "trustno1", "jennifer", "44215175", "michelle", "11111111"],
                9: ["123456789", "character", "anonymous", "dangerous", "interface", "mainframe", "algorithm", "developer", "encrypted", "masterkey", "processor"],
                10: ["1234567890", "letmeingin", "cyberpunk2", "properties", "production", "background", "everything", "collection", "management", "experience"]
            };

            const dict = [...(passDict[details.passwordLength] || [])];

            if (ns.fileExists(wordSourceFile, "home")) {
                if (currentHost === "home" || ns.scp(wordSourceFile, currentHost, "home")) {
                    const words = ns.read(wordSourceFile).split(/\r?\n/);
                    for (const w of words) {
                        const cleanWord = w.trim();
                        if (cleanWord.length === details.passwordLength) dict.push(cleanWord);
                    }
                }
            }
            const unique = Array.from(new Set(dict));
            if (unique.length === 0) {
                return { success: false, auth: { message: "word length gap", length: details.passwordLength } };
            }
            for (const g of unique) {
                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return { success: true, password: g };
            }
            return { success: false, auth: auth };
        }

        case "BellaCuore": {
            const parseRoman = (str) => {
                if (!str || str.toLowerCase() === "nulla") return 0;
                const rMap = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
                let val = 0;
                for (let i = 0; i < str.length; i++) {
                    let curr = rMap[str[i].toUpperCase()], next = rMap[str[i + 1]?.toUpperCase()];
                    if (next > curr) { val += (next - curr); i++; } else val += curr;
                }
                return val;
            };
            let hint = details.passwordHint || "";

            // Safe fallback descriptor if regex matching or parsing fails entirely
            auth = { message: "no authentication attempted", hint: hint };

            if (hint.includes("between")) {
                let limits = hint.match(/'([^']+)'/g);
                if (limits && limits.length >= 2) {
                    let low = parseRoman(limits[0].replace(/'/g, '')), high = parseRoman(limits[1].replace(/'/g, ''));
                    const len = details.passwordLength || 3;
                    while (low <= high) {
                        let mid = Math.floor((low + high) / 2), g = mid.toString().padStart(len, '0');

                        // Capture authentication telemetry inside the binary search loop
                        auth = await ns.dnet.authenticate(hostname, g);
                        if (auth.success) return { success: true, password: g };

                        let entry = await getLogEntry(g);
                        if (entry) {
                            let s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).toUpperCase();
                            if (s.includes("PARUM")) low = mid + 1;
                            else if (s.includes("NIMIS") || s.includes("LONGUS") || s.includes("MAGNUS") || s.includes("ALTA")) high = mid - 1;
                            else break;
                        } else break;
                    }
                }
            } else {
                let roman = details.data || (hint.match(/'([IVXLCDM]+)'/) || [])[1];
                if (roman) {
                    let pw = parseRoman(roman).toString();

                    // Capture authentication telemetry for direct translation path
                    auth = await ns.dnet.authenticate(hostname, pw);
                    if (auth.success) return { success: true, password: pw };
                }
            }
            return { success: false, auth: auth };
        }

        case "DeskMemo_3.1":
        case "CloudBlare(tm)": {
            // Seed a safe structural fallback in case regex extraction yields nothing
            auth = { message: "no numeric sequences extracted from metadata", model: model };

            let matches = (details.data || details.passwordHint || "").match(/\d+/g);
            if (matches) {
                for (const g of matches) {
                    // Capture tracking object on parsed hint targets
                    auth = await ns.dnet.authenticate(hostname, g);
                    if (auth.success) return { success: true, password: g };
                }
            }

            if (model === "CloudBlare(tm)" && details.data) {
                let digits = details.data.replace(/\D/g, "");
                if (digits) {
                    // Capture tracking object on complete stripped digit strings
                    auth = await ns.dnet.authenticate(hostname, digits);
                    if (auth.success) return { success: true, password: digits };
                }
            }

            return { success: false, auth: auth };
        }

        case "KingOfTheHill": {
            const len = details.passwordLength || 2, max = Math.pow(10, len) - 1;

            const getAlt = async (n) => {
                const g = n.toString().padStart(len, '0');

                // Telemetry Capture 1: Bind core sampling authentication to matrix scope
                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return { win: true, g };

                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    const m = s.match(/"data"\s*:\s*"([^"]+)"/) || s.match(/data:\s*([^\s,]+)/) || s.match(/altitude:\s*(\d+(?:\.\d+)?)/i);
                    if (m) {
                        const val = parseFloat(m[1]);
                        if (!isNaN(val)) return { win: false, alt: val };
                    }
                }
                return { win: false, alt: -1 }; // Signals a transient network drop
            };

            const samples = [];
            const scanStep = Math.max(1, Math.floor(max / 25));
            for (let i = 0; i <= max; i += scanStep) {
                let res = await getAlt(i);
                if (res.win) return { success: true, password: res.g };
                samples.push({ guess: i, alt: res.alt });
            }

            samples.sort((a, b) => b.alt - a.alt);
            const seeds = [];
            const exclusionZone = max * 0.1;

            for (const s of samples) {
                if (seeds.length >= 3) break;
                if (!seeds.some(p => Math.abs(p.guess - s.guess) < exclusionZone)) {
                    seeds.push(s);
                }
            }

            let bestOverallG = seeds[0].guess;
            let bestOverallAlt = seeds[0].alt;

            for (const seed of seeds) {
                let curr = seed.guess;
                let localBestAlt = seed.alt;
                let step = Math.max(1, Math.floor(max / 50));

                while (step >= 1) {
                    let upTarget = curr + step;
                    let downTarget = curr - step;

                    let upAlt = -1;
                    let downAlt = -1;

                    // Evaluate the upper slope
                    if (upTarget <= max) {
                        let res = await getAlt(upTarget);
                        if (res.win) return { success: true, password: res.g };
                        upAlt = res.alt;
                    }

                    // Evaluate the lower slope simultaneously
                    if (downTarget >= 0) {
                        let res = await getAlt(downTarget);
                        if (res.win) return { success: true, password: res.g };
                        downAlt = res.alt;
                    }

                    // Safeguard: If BOTH paths dropped due to lag (-1), retry without decaying step size
                    if ((upTarget <= max && upAlt === -1) && (downTarget >= 0 && downAlt === -1)) {
                        await ns.sleep(50);
                        continue;
                    }

                    // Steepest Ascent Optimization: March toward the absolute highest peak visible
                    if (upAlt > localBestAlt || downAlt > localBestAlt) {
                        if (upAlt >= downAlt) {
                            localBestAlt = upAlt;
                            curr = upTarget;
                        } else {
                            localBestAlt = downAlt;
                            curr = downTarget;
                        }
                    } else {
                        // Only decay step size if BOTH directions were verified to be lower ground
                        step = Math.floor(step / 2);
                    }
                }

                if (localBestAlt > bestOverallAlt) {
                    bestOverallAlt = localBestAlt;
                    bestOverallG = curr;
                }
            }

            // Localized micro-brute finish
            for (let i = Math.max(0, bestOverallG - 5); i <= Math.min(max, bestOverallG + 5); i++) {
                let res = await getAlt(i);
                if (res.win) return { success: true, password: res.g };
            }

            // Return clean failure state with the absolute final failed verification token
            return { success: false, auth: auth };
        }

        case "Laika4": {
            for (const dog of ["laika", "fido", "spot", "rover", "max", "buddy"]) {
                // Capture tracking object on lowercase variant
                auth = await ns.dnet.authenticate(hostname, dog);
                if (auth.success) return { success: true, password: dog };

                // Capture tracking object on uppercase variant
                auth = await ns.dnet.authenticate(hostname, dog.toUpperCase());
                if (auth.success) return { success: true, password: dog.toUpperCase() };
            }
            return { success: false, auth: auth };
        }

        case "NIL": {
            const len = details.passwordLength || 6, format = details.passwordFormat || "numeric";
            let pool = "0123456789".split("");
            if (format === "alphanumeric") pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            else if (format === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            let res = Array(len).fill(null);

            for (const char of pool) {
                const g = char.repeat(len);

                // Telemetry Capture 1: Bind character mask checks to the matrix frame
                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return { success: true, password: g };

                const entry = await getLogEntry(g);
                if (entry) {
                    const s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                    const m = s.match(/"data"\s*:\s*"([^"]+)"/) || s.match(/data:\s*([^\s,]+)/);
                    if (m) {
                        let feedback = m[1].split(",");
                        for (let i = 0; i < len; i++) if (feedback[i] === "yes") res[i] = char;
                    }
                }
                if (res.every(x => x !== null)) break;
            }

            const final = res.map(x => x || pool[0]).join("");

            // Telemetry Capture 2: Capture the absolute final composite password guess
            auth = await ns.dnet.authenticate(hostname, final);
            if (auth.success) return { success: true, password: final };

            // Propagate the unredacted failure token up to your JSON stringifier
            return { success: false, auth: auth };
        }

        case "Pr0verFl0": {
            const len = details.passwordLength || 7;

            // Telemetry Capture 1: Capture initial exploit memory-leak probe
            auth = await ns.dnet.authenticate(hostname, "A".repeat(len));

            const entry = await getLogEntry("A".repeat(len));
            if (entry) {
                const s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                const m = s.match(/expected '([^■']+)/i) || s.match(/passwordExpected:\s*([^■\s]+)/i);
                if (m) {
                    const prefix = m[1], pool = Array.from(new Set(s.replace(/[^a-zA-Z0-9]/g, '').split('')));
                    if (len - prefix.length === 3) {
                        for (let c1 of pool) for (let c2 of pool) for (let c3 of pool) {
                            let g = prefix + c1 + c2 + c3;

                            // Telemetry Capture 2: Capture combination matrix brute attempts
                            auth = await ns.dnet.authenticate(hostname, g);
                            if (auth.success) return { success: true, password: g };
                        }
                    }
                }
            }

            // Telemetry Capture 3: Capture the definitive parameter overflow fallback crash attempt
            auth = await ns.dnet.authenticate(hostname, "A".repeat(len + 8));
            if (auth.success) return { success: true, password: "A".repeat(len + 8) };

            // Propagate the overflow failure token clean to the stringifier
            return { success: false, auth: auth };
        }

        case "OpenWebAccessPoint": {
            const len = details.passwordLength || 4;

            // Initial fallback message in case log matching fails on all vectors
            auth = { message: "no successful leak extraction achieved", model: "OpenWebAccessPoint" };

            for (const seed of ["admin", "password", "guest", "1234", "0000", "9999"]) {
                const g = seed.slice(0, len);

                // Telemetry Capture 1: Track initial base seed authentication probes
                auth = await ns.dnet.authenticate(hostname, g);
                if (auth.success) return { success: true, password: g };

                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    const m = s.match(/"data"\s*:\s*"([^"]+)"/);
                    if (m) {
                        const data = m[1], sig = `${hostname}:`, idx = data.indexOf(sig);
                        if (idx !== -1) {
                            const p = data.substr(idx + sig.length, len);

                            // Telemetry Capture 2: Track signature-targeted password string extraction
                            auth = await ns.dnet.authenticate(hostname, p);
                            if (auth.success) return { success: true, password: p };
                        }
                        for (let i = 0; i <= data.length - len; i++) {
                            const sub = data.substr(i, len);

                            // Telemetry Capture 3: Track complete data block sliding-window brute tries
                            auth = await ns.dnet.authenticate(hostname, sub);
                            if (auth.success) return { success: true, password: sub };
                        }
                    }
                }
            }
            return { success: false, auth: auth };
        }

        case "OctantVoxel": {
            // Seed a default error signature in case metadata parsing requirements are missed
            auth = { message: "Radix parameters could not be extracted from metadata", model: "OctantVoxel" };

            let base = 0, num = "";
            if (details.data && String(details.data).includes(',')) {
                let p = String(details.data).split(','); base = parseFloat(p[0]); num = p[1];
            } else {
                let m = (details.passwordHint || "").match(/base\s+(\d+(?:\.\d+)?)\s+number\s+([a-fA-F0-9.]+)/i);
                if (m) { base = parseFloat(m[1]); num = m[2]; }
            }

            if (base && num) {
                let [int, frac] = num.split('.'), sum = 0;
                for (let i = 0; i < int.length; i++) sum += parseInt(int[int.length - 1 - i], 36) * Math.pow(base, i);
                if (frac) for (let i = 0; i < frac.length; i++) sum += parseInt(frac[i], 36) * Math.pow(base, -(i + 1));
                const p = Math.round(sum).toString();

                // Telemetry Capture: Track the final base-converted password authentication attempt
                auth = await ns.dnet.authenticate(hostname, p);
                if (auth.success) return { success: true, password: p };
            }

            return { success: false, auth: auth };
        }

        case "DeepGreen": {
            const len = details.passwordLength || 3;
            const format = details.passwordFormat || "numeric";

            let pool = "0123456789";
            if (format === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (format === "alphanumeric") pool += "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            let guessArr = Array(len).fill(pool[0]);

            const getExactCount = async (currentStr) => {
                await ns.sleep(30);
                const bleed = await ns.dnet.heartbleed(hostname);
                if (bleed && bleed.logs && bleed.logs.length > 0) {
                    for (let i = bleed.logs.length - 1; i >= 0; i--) {
                        const logObj = JSON.parse(bleed.logs[i]);
                        if (logObj.passwordAttempted === currentStr) {
                            if (logObj.data && typeof logObj.data === "string") {
                                return parseInt(logObj.data.split(",")[0], 10) || 0;
                            }
                        }
                    }
                }
                return 0;
            };

            auth = await ns.dnet.authenticate(hostname, guessArr.join(""));
            if (auth.success) return { success: true, password: guessArr.join("") };
            let currentExact = await getExactCount(guessArr.join(""));

            for (let pos = 0; pos < len; pos++) {
                const originalChar = guessArr[pos];

                for (let pIdx = 1; pIdx < pool.length; pIdx++) {
                    guessArr[pos] = pool[pIdx];
                    const currentStr = guessArr.join("");

                    auth = await ns.dnet.authenticate(hostname, currentStr);
                    if (auth.success) return { success: true, password: currentStr };

                    const newExact = await getExactCount(currentStr);

                    if (newExact > currentExact) {
                        currentExact = newExact;
                        break;
                    } else if (newExact < currentExact) {
                        guessArr[pos] = originalChar;
                        break;
                    }
                }
            }

            return { success: false, auth: auth };
        }

        case "PHP 5.4": {
            // Seed a secure structural fallback in case no digit tokens exist in metadata
            auth = { message: "No digits extracted from metadata pool", model: "PHP 5.4" };

            let digits = (details.data || details.passwordHint || "").replace(/\D/g, "");
            if (digits) {
                const perm = (s) => {
                    if (s.length <= 1) return [s];
                    let res = [];
                    for (let i = 0; i < s.length; i++) {
                        for (let p of perm(s.slice(0, i) + s.slice(i + 1))) res.push(s[i] + p);
                    }
                    return Array.from(new Set(res));
                };

                for (let p of perm(digits)) {
                    // Telemetry Capture: Trap the specific permutation matrix try
                    auth = await ns.dnet.authenticate(hostname, p);
                    if (auth.success) return { success: true, password: p };
                }
            }

            return { success: false, auth: auth };
        }

        case "OrdoXenos": {
            // Seed baseline for structural validation safety
            auth = { message: "Metadata delimiter missing or unformatted", model: "OrdoXenos" };

            let data = details.data || "";
            if (data.includes(";")) {
                let [cipher, masks] = data.split(";"), mPool = masks.split(" ").map(b => parseInt(b, 2));
                let res = ""; for (let i = 0; i < cipher.length; i++) res += String.fromCharCode(cipher.charCodeAt(i) ^ mPool[i]);
                auth = await ns.dnet.authenticate(hostname, res);
                if (auth.success) return { success: true, password: res };
            }
            return { success: false, auth: auth };
        }

        case "PrimeTime 2": {
            // Seed baseline for structural validation safety
            auth = { message: "No numeric sequences located within hint buffer", model: "PrimeTime 2" };

            let m = (details.passwordHint || "").match(/\d+/);
            if (m) {
                let n = parseInt(m[0]), d = 2;
                while (d * d <= n) { if (n % d === 0) n /= d; else d++; }
                auth = await ns.dnet.authenticate(hostname, n.toString());
                if (auth.success) return { success: true, password: n.toString() };
            }
            return { success: false, auth: auth };
        }

        case "110100100": {
            // Seed baseline for structural validation safety
            auth = { message: "Binary sequence empty or improperly delimited", model: "110100100" };

            let bin = details.data || "";
            if (!bin) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                if (hb && hb.logs) {
                    const logStr = JSON.stringify(hb.logs);
                    bin = (logStr.match(/"data"\s*:\s*"([^"]+)"/) || [])[1] || "";
                }
            }
            if (bin && bin.includes(" ")) {
                let res = bin.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
                auth = await ns.dnet.authenticate(hostname, res);
                if (auth.success) return { success: true, password: res };
            }
            return { success: false, auth: auth };
        }

        case "BigMo%od": {
            const len = details.passwordLength || 4;
            const mods = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n];
            const rems = [];

            for (const p of mods) {
                const pStr = p.toString().padStart(len, '0');

                auth = await ns.dnet.authenticate(hostname, pStr);
                if (auth.success) return { success: true, password: pStr };

                await ns.sleep(30);
                const bleed = await ns.dnet.heartbleed(hostname);
                if (bleed && bleed.logs && bleed.logs.length > 0) {
                    let matchFound = false;
                    for (let i = bleed.logs.length - 1; i >= 0; i--) {
                        const logObj = JSON.parse(bleed.logs[i]);
                        if (logObj.passwordAttempted === pStr) {
                            rems.push(BigInt(logObj.data));
                            matchFound = true;
                            break;
                        }
                    }
                    if (!matchFound) return { success: false, auth: auth };
                } else {
                    return { success: false, auth: auth };
                }
            }

            const N = mods.reduce((a, b) => a * b, 1n);
            let res = 0n;

            for (let i = 0; i < mods.length; i++) {
                const Ni = N / mods[i];
                let inv = 0n;
                for (let j = 1n; j < mods[i]; j++) {
                    if ((Ni * j) % mods[i] === 1n) {
                        inv = j;
                        break;
                    }
                }
                res += rems[i] * Ni * inv;
            }

            const finalAns = res % N;
            const paddedPassword = finalAns.toString().padStart(len, '0');

            auth = await ns.dnet.authenticate(hostname, paddedPassword);
            if (auth.success) return { success: true, password: paddedPassword };

            return { success: false, auth: auth };
        }

        case "2G_cellular": {
            const len = details.passwordLength || 6, pool = "0123456789abcdefghijklmnopqrstuvwxyz";
            let g = Array(len).fill(pool[0]);

            // Seed baseline for structural validation safety
            auth = { message: "Pinning loop completed without matching length requirements", model: "2G_cellular" };

            for (let i = 0; i < len; i++) {
                for (let j = 0; j < pool.length; j++) {
                    g[i] = pool[j];
                    const currentGuess = g.join('');

                    // Telemetry Capture 1: Capture index pinning attempts
                    auth = await ns.dnet.authenticate(hostname, currentGuess);
                    if (auth.success) return { success: true, password: currentGuess };

                    let entry = await getLogEntry(currentGuess);
                    if (entry) {
                        let s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                        let m = s.match(/character \((\d+)\)/i);
                        // If the server confirms it parsed deeper than our current index, lock the slot and advance
                        if (m && parseInt(m[1]) > i) break;
                    }
                }
            }

            const finalGuess = g.join('');
            // Telemetry Capture 2: Capture final fallback verification pass
            auth = await ns.dnet.authenticate(hostname, finalGuess);
            if (auth.success) return { success: true, password: finalGuess };

            return { success: false, auth: auth };
        }

        case "MathML": {
            // Seed a secure structural fallback in case data parsing or regex safety validation fails
            auth = { message: "MathML evaluation bypassed or format validation failed", model: "MathML" };

            if (details.data) {
                try {
                    let cleanExpr = String(details.data).split(',')[0]
                        .replace(/\u04b3/g, '*')
                        .replace(/\u2795/g, '+')
                        .replace(/\u2796/g, '-')
                        .replace(/\u00f7/g, '/');

                    if (/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
                        const evalRes = Function(`return (${cleanExpr})`)();
                        let targetLen = details.passwordLength || 2;
                        let resStr = evalRes.toString();
                        if (resStr.length > targetLen) resStr = resStr.slice(0, targetLen);

                        // Telemetry Capture: Trap the evaluated math token authentication attempt
                        auth = await ns.dnet.authenticate(hostname, resStr);
                        if (auth.success) return { success: true, password: resStr };
                    }
                } catch (e) {
                    logDiag(`MathML error: ${e}`);
                    // Trap execution runtime exceptions to bubble out through the logger
                    auth = { message: "MathML parsing or arithmetic execution error", error: e.toString(), model: "MathML" };
                }
            }
            return { success: false, auth: auth };
        }

        case "(The Labyrinth)":
            return await solveLabyrinth(ns, hostname, logDiag, logSuccess);

        default:
            if (!reportedUnknowns.has(model)) {
                logDiag(`Unknown model: ${model} on ${hostname}. Hint: ${details.passwordHint}`);
                reportedUnknowns.add(model);
            }

            // Secure structural fallback for the stringifier on an unmapped server architecture
            return {
                success: false,
                auth: {
                    message: "Unknown network model classification",
                    model: model || "unspecified",
                    hint: details?.passwordHint || "none"
                }
            };
    }
}

/** @param {NS} ns */
async function solveLabyrinth(ns, hostname, logDiag, logSuccess) {
    const home = "home";
    const currentHost = ns.getHostname();
    
    // Memory state structures preserved
    let state = {
        grid: {},
        pathVisits: {},
        history: []
    };
    let auth;
    let duration;

    // =================================================================
    // INDESTRUCTIBLE TOPOLOGICAL PATHFINDER (GLIDE-PROOF TRÉMAUX)
    // =================================================================
    function findNextExplorationStep(grid, startKey, pathVisits, history) {
        let fStart = performance.now();
        let room = grid[startKey];

        if (!room) {
            duration = performance.now() - fStart;
            logDiag(`findNextExplorationStep [TM]: No room data yet: ${duration}`);
            return null;
        }

        const dirMap = { n: "north", s: "south", e: "east", w: "west" };
        const oppFull = { north: "south", south: "north", east: "west", west: "east" };

        if (!pathVisits[startKey]) pathVisits[startKey] = { north: 0, south: 0, east: 0, west: 0 };

        let availableExits = [];
        for (let shortDir in dirMap) {
            let fullDir = dirMap[shortDir];
            if (room[shortDir]) {
                let marks = pathVisits[startKey][fullDir] || 0;
                availableExits.push({ dir: fullDir, marks });
            }
        }

        // TRÉMAUX RULE 1: Unvisited paths
        let unvisitedExits = availableExits.filter(e => e.marks === 0);
        if (unvisitedExits.length > 0) {
            let choice = unvisitedExits[0];
            pathVisits[startKey][choice.dir] = 1;
            history.push(oppFull[choice.dir]);

            duration = performance.now() - fStart;
            logDiag(`findNextExplorationStep [TM]: Gliding fresh direction ${choice.dir}: ${duration}`);
            return [choice.dir];
        }

        // TRÉMAUX RULE 2: Double-marking dead ends
        if (history.length > 0) {
            let backwardDir = history[history.length - 1];
            let incomingCorridor = availableExits.find(e => e.dir === backwardDir);

            if (incomingCorridor && incomingCorridor.marks === 1) {
                pathVisits[startKey][backwardDir] = 2;
                history.pop();

                duration = performance.now() - fStart;
                logDiag(`findNextExplorationStep [TM]: Backtracking down corridor ${backwardDir}: ${duration}`);
                return [backwardDir];
            }
        }

        // TRÉMAUX RULE 3: Clearing alternative paths
        let oneMarkExits = availableExits.filter(e => e.marks === 1);
        if (oneMarkExits.length > 0) {
            let choice = oneMarkExits[0];
            pathVisits[startKey][choice.dir] = 2;

            if (history[history.length - 1] === choice.dir) history.pop();

            duration = performance.now() - fStart;
            logDiag(`findNextExplorationStep [TM]: Cleaning up alternative open branch ${choice.dir}: ${duration}`);
            return [choice.dir];
        }

        duration = performance.now() - fStart;
        logDiag(`findNextExplorationStep [TM]: Maze section completely explored: ${duration}`);
        return null;
    }

    // Original orientation kickstart sequence (Unchanged)
    let tempDir = ["south", "north", "east", "west"][Math.floor(Math.random() * 4)];
    auth = await ns.dnet.authenticate(hostname, tempDir);

    let lStart = performance.now();
    let initialReport = await ns.dnet.labreport(hostname);
    duration = performance.now() - lStart;
    logDiag(`Lab Report await: ${duration}`);

    if (!initialReport || !initialReport.coords) {
        let randomIndex = Math.floor(Math.random() * 4);
        let randomDirection = ["north", "south", "east", "west"][randomIndex];

        let authStart = performance.now();
        auth = await ns.dnet.authenticate(hostname, "go " + randomDirection);
        duration = performance.now() - authStart;
        logDiag(`authenticate await 1: ${duration}`);
    }

    // Scope tracking variables outside the loop to maintain historical state across glides
    let curKey = null;
    let chosenDir = null;

    try {
        while (true) {
            let wStart = performance.now();
            // 1. INGEST TOPOLOGY snap from Port 28
            let globalDataRaw = ns.peek(28);
            if (globalDataRaw && globalDataRaw !== "NULL PORT DATA" && globalDataRaw !== "NULL DATA") {
                try {
                    let globalTopology = JSON.parse(globalDataRaw);
                    Object.assign(state.grid, globalTopology);
                }
                catch (e) {
                    logDiag(`Error getting topology: ${e}`);
                }
            }
            duration = performance.now() - wStart;
            logDiag(`While loop. Get topology: ${duration}`);

            let labStart = performance.now();

            // 2. POLL SENSORS
            let oldKey = curKey; 
            let report = await ns.dnet.labreport(hostname);
            duration = performance.now() - labStart;
            logDiag(`While loop. LabReport: ${duration}`);
            if (!report || !report.coords) break;

            // 🔄 RESTORED: Dynamic array indexing from your configuration snapshot
            curKey = `${report.coords[0]},${report.coords[1]}`;

            // GLIDE MECHANIC SYNC: Link marks across the glide space
            if (oldKey && oldKey !== curKey && chosenDir) {
                const oppFull = { north: "south", south: "north", east: "west", west: "east" };
                let arrivalDir = oppFull[chosenDir];

                if (!state.pathVisits[curKey]) state.pathVisits[curKey] = { north: 0, south: 0, east: 0, west: 0 };
                if (!state.pathVisits[oldKey]) state.pathVisits[oldKey] = { north: 0, south: 0, east: 0, west: 0 };

                state.pathVisits[curKey][arrivalDir] = state.pathVisits[oldKey][chosenDir];
            }

            // 3. ENFORCE REALITY SUB-LATCH & BROADCAST
            const liveWalls = { n: report.north, s: report.south, e: report.east, w: report.west };
            state.grid[curKey] = liveWalls;

            let portWrite = performance.now();
            const discoveryPacket = { labyrinth: hostname, room: curKey, walls: liveWalls };
            ns.tryWritePort(27, JSON.stringify(discoveryPacket));
            duration = performance.now() - portWrite;
            logDiag(`Write to port duration: ${duration}`);

            let hbStart = performance.now();
            // 4. EXPLOIT SCREENING
            const hb = await ns.dnet.heartbleed(hostname, { peek: true });
            duration = performance.now() - hbStart;
            logDiag(`HB await duration: ${duration}`);

            let successStart = performance.now();
            if (hb && hb.logs) {
                const logStr = JSON.stringify(hb.logs);
                if (logStr.includes("!!")) {
                    const m = logStr.match(/!!([^!]+)!!/);
                    if (m) {
                        const pass = m[0];
                        if ((await ns.dnet.authenticate(hostname, pass)).success) {
                            logSuccess(`LABYRINTH CONQUERED: ${hostname}`);
                            for (const c of ns.ls(hostname, '.cache')) {
                                try { ns.dnet.openCache(c); } catch (e) { }
                            }
                            return { success: true, password: pass };
                        }
                    }
                }
            }
            duration = performance.now() - successStart;
            logDiag(`Check success duration: ${duration}`);

            // 5. CALCULATE GEOMETRIC NEXT STEP
            let nStart = performance.now();
            
            // Pass all mandatory parameters to the local pathfinder
            const path = findNextExplorationStep(state.grid, curKey, state.pathVisits, state.history);

            if (path && path.length > 0) {
                chosenDir = path[0]; // Track direction globally for the next loop's glide check
                let authStart = performance.now();
                auth = await ns.dnet.authenticate(hostname, `go ${chosenDir}`);
                duration = performance.now() - authStart;
                logDiag(`authenticate await2: ${duration}`);
            } else {
                logDiag(`Labyrinth fully explored at ${curKey}. No remaining frontiers found in shared map.`);
                break;
            }
            duration = performance.now() - nStart;
            logDiag(`Calculate Geometric duration: ${duration}`);
        }
    } catch (e) {
        logDiag(`Error in solveLabyrinth: ${e}`);
    }
    return { success: false, auth: auth };
}

/** @param {NS} ns */
function acquireLock(ns, hostname, model) {
    // Do not lock labyrinth
    // if (model == "(The Labyrinth)") return true;
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const port = 10 + Math.abs(hash % 4);

    let portData = ns.readPort(port);
    let locks = (portData === "NULL PORT DATA" || portData === "NULL DATA" || !portData) ? [] : JSON.parse(portData);

    const now = Date.now();
    locks = locks.filter(l => now - l.acquiredAt < 300000);

    if (locks.find(l => l.host === hostname)) {
        ns.writePort(port, JSON.stringify(locks)); // Put them back!
        return false;
    }

    locks.push({ host: hostname, acquiredAt: now });
    ns.writePort(port, JSON.stringify(locks));
    return true;
}

/** @param {NS} ns */
function releaseLock(ns, hostname) {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const port = 10 + Math.abs(hash % 4);

    let portData = ns.readPort(port);
    let locks = (portData === "NULL PORT DATA" || portData === "NULL DATA" || !portData) ? [] : JSON.parse(portData);

    locks = locks.filter(l => l.host !== hostname);
    ns.writePort(port, JSON.stringify(locks));
}


/** @param {NS} ns */
function getVaultPasswords(ns, currentHost, logDiag, logSuccess) {
    // =========================================================================
    // 🛰️ VAULT & STATE INITIALIZATION
    // =========================================================================
    if (currentHost === "home") {
        logSuccess(`Worm ${WORM_VERSION} initialized on home.`);
        if (ns.fileExists("darknet-keys.js", "home")) {
            try {
                const fileData = ns.read("darknet-keys.js");
                if (fileData) globalPasswordVault = JSON.parse(fileData);
            }
            catch (e) {
                logDiag(`Error loading vault: ${e}`);
            }
        }
    } else {
        // Sync vault from home
        try {
            if (ns.fileExists("darknet-keys.js", "home")) {
                if (ns.scp("darknet-keys.js", currentHost, "home")) {
                    const fileData = ns.read("darknet-keys.js");
                    if (fileData) {
                        try {
                            const remoteVault = JSON.parse(fileData);
                            globalPasswordVault = Object.assign({}, remoteVault, globalPasswordVault);
                            // Auto-session if we have the key for the current host
                            if (globalPasswordVault[currentHost]) {
                                ns.dnet.connectToSession(currentHost, globalPasswordVault[currentHost]);
                            }
                        } catch (e) { logDiag(`Error parsing vault: ${e}`); }
                    }
                }
            }
        } catch (e) { logDiag(`Vault sync failed: ${e}`); }
    }
}

/** @param {NS} ns */
function getStasisLinks(ns, currentHost, logDiag) {
    let stasisFileText = "";
    if (currentHost == "home") {
        if (ns.fileExists(stasisFile, "home")) {
            try {
                stasisFileText = ns.read(stasisFile);
            }
            catch (e) {
                logDiag(`Cannot read stasisLink file: ${stasisFile}`);
            }
        }
    }
    else {
        if (ns.fileExists(stasisFile, "home")) {
            if (ns.scp(stasisFile, currentHost, "home")) {
                try {
                    stasisFileText = ns.read(stasisFile);
                }
                catch (e) {
                    logDiag(`Cannot read stasisLink file: ${stasisFile}`);
                }
            }
            else {
                logDiag(`Cannot copy stasisLink file from home`)
            }
        }
    }
    if (stasisFileText) {
        return stasisFileText.split(",")
            .map(item => item.trim())       // Remove spaces around numbers
            .filter(item => item !== "")    // Drop the trailing empty element
            .map(Number);                   // Convert strings ("1") to numbers (1)
    }
    else {
        return [];
    }
}

/** @param {NS} ns */
function setStasisLinks(ns, currentHost, logDiag) {
    if (currentHost != "home") {
        try {
            ns.write(stasisFile, stasisLinks, "w");
            ns.scp(stasisFile, "home", currentHost);
        }
        catch (e) {
            logDiag(`Error writing stasisLink file to home ${e}`)
        }
    }
}

/** @param {NS} ns */
function establishStasisLink(ns, currentHost, logDiag, logSuccess) {
    if (currentHost != "home" && currentHost != "darkweb") {
        let currentServerDetails = ns.dnet.getServerDetails(currentHost);
        // If current server depth is 9, 17 or 23 and there is no link already at that depth
        if ([8, 16, 22].includes(currentServerDetails.depth) && !stasisLinks.includes(currentServerDetails.depth)) {
            if (stasisLinks.length < ns.dnet.getStasisLinkLimit()) {
                // create a stasis link on this server
                const freeRam = ns.getServerMaxRam(currentHost) - ns.getServerUsedRam(currentHost);
                // Only compile and execute the worker if the node can support the 12GB runtime cost
                if (freeRam >= 12) {
                    ns.write("stasis-worker.js", '/** @param {NS} ns */ export async function main(ns) { ns.dnet.setStasisLink(); }', "w");
                    ns.exec("stasis-worker.js", currentHost);
                    stasisLinks.push(currentServerDetails.depth);
                    setStasisLinks(ns, currentHost, logDiag);
                    logSuccess(`Dynamically deployed stasis worker on ${currentHost} - depth: ${currentServerDetails.depth}`);
                    // ns.tprint(`Dynamically deployed stasis worker on ${currentHost} - depth: ${currentServerDetails.depth}`)
                } else {
                    // logDiag(`Insufficient RAM on ${currentHost} to execute background stasis anchor.`);
                }
            }
        }
    }
}

/** @param {NS} ns */
function lootCacheFiles(ns, currentHost, logDiag, logSuccess) {
    // Loot local caches
    const localCaches = ns.ls(currentHost, ".cache");
    for (const cacheFile of localCaches) {
        try {
            const result = ns.dnet.openCache(cacheFile);
            logSuccess(`Looted ${cacheFile}: ${JSON.stringify(result)}`);
        } catch (e) {
            logDiag(`[CACHE-ERR] Failed to decrypt cache ${cacheFile} on ${currentHost}: ${e}`);
        }
    }

    // 📥 RESTORED: Gather raw data text files and exfiltrate them back to home
    if (currentHost !== "home" && currentHost !== "darkweb") {
        try {
            const allFiles = ns.ls(currentHost);
            const dataFiles = allFiles.filter(f => f.endsWith(".txt") || f.includes(".data"));

            for (const file of dataFiles) {
                if (file === "darknet-diagnostics.txt" || file === "darknet-success.txt" || file === "darknet-words.txt") {
                    continue;
                }

                const fileTrackingKey = `${currentHost}:${file}`;

                if (!dataFilesCopied.has(fileTrackingKey)) {
                    try {
                        const success = ns.scp(file, "home", currentHost);

                        if (success) {
                            dataFilesCopied.add(fileTrackingKey);
                            logSuccess(`Exfiltrated data asset: ${file} -> home`);

                            const portAlert = JSON.stringify({ host: currentHost, filename: file });
                            ns.tryWritePort(21, portAlert);
                        } else {
                            logDiag(`[EXFIL-WARN] ns.scp returned false for ${file} from ${currentHost}`);
                        }
                    } catch (fileError) {
                        logDiag(`[EXFIL-ERR] Failed transfer protocol for ${file} on ${currentHost}: ${fileError}`);
                    }
                }
            }
        } catch (scanError) {
            logDiag(`[SCAN-ERR] Directory map listing failed on ${currentHost}: ${scanError}`);
        }

        // 3. Your original commented anchors preserved exactly
        const localFiles = ns.ls(currentHost, ".exe");
        if (localFiles.length > 0) {
            // what can we do???
            // ns.dnet.unleashStormSeed();
        }
    }
}

/**
 * Consolidated Swarm Management Logic (Replaces dnet-bootstrap.js)
 * @param {NS} ns
 * @param {string} targetHost
 * @param {string} currentHost
 * @param {function} logDiag
 * @param {function} logSuccess
 */
async function manageSwarmDeployment(ns, targetHost, currentHost, logDiag, logSuccess) {
    const allWormVariants = ["dnet-worm.js", "dnet-worm-dfs.js", "dnet-worm-tm.js"];
    const maxRam = ns.getServerMaxRam(targetHost);
    const maxWormsPossible = Math.min(3, Math.floor(maxRam / WORM_COST));

    if (maxWormsPossible === 0) return;

    const processes = ns.ps(targetHost);
    let variantsToDeploy = [];

    // 1. Version Guard: Kill older versions of ANY variant
    for (const variant of allWormVariants) {
        const existing = processes.find(p => p.filename === variant);
        if (existing) {
            const remoteVersion = (existing.args[0] || "v0.0.0").replace('v', '');
            const localVersion = WORM_VERSION.replace('v', '');
            const rParts = remoteVersion.split('.').map(Number);
            const lParts = localVersion.split('.').map(Number);
            let isOlder = false;
            for (let j = 0; j < 3; j++) {
                if (lParts[j] > rParts[j]) { isOlder = true; break; }
                if (lParts[j] < rParts[j]) break;
            }
            if (isOlder) ns.kill(existing.pid);
        }
    }

    // 2. Swarm Assessment: Count active current worms and identify missing desired ones
    const activeProcesses = ns.ps(targetHost);
    let upToDateWormsCount = 0;
    for (const variant of allWormVariants) {
        if (activeProcesses.some(p => p.filename === variant)) {
            upToDateWormsCount++;
        }
    }

    const desiredVariants = allWormVariants.slice(0, maxWormsPossible);
    for (const wormFile of desiredVariants) {
        if (!activeProcesses.some(p => p.filename === wormFile)) {
            variantsToDeploy.push(wormFile);
        }
    }

    // Adjust variantsToDeploy if an "out-of-tier" but up-to-date worm is already filling a slot
    const slotsAvailable = maxWormsPossible - upToDateWormsCount;
    if (slotsAvailable <= 0) return;
    if (variantsToDeploy.length > slotsAvailable) {
        variantsToDeploy = variantsToDeploy.slice(0, slotsAvailable);
    }

    if (variantsToDeploy.length === 0) return;

    // 3. RAM Calculation (accounting for already running up-to-date worms)
    const requiredFreeRam = variantsToDeploy.length * WORM_COST;
    let details = ns.dnet.getServerDetails(targetHost);
    let freeRam = maxRam - ns.getServerUsedRam(targetHost);

    // 4. Fast Path or Reallocation
    if (freeRam >= requiredFreeRam) {
        if (ns.scp(variantsToDeploy, targetHost, "home")) {
            for (const wormFile of variantsToDeploy) {
                ns.exec(wormFile, targetHost, { threads: 1, preventDuplicates: true }, WORM_VERSION);
            }
            logSuccess(`Swarm deployed to ${targetHost} (${upToDateWormsCount + variantsToDeploy.length}/${maxWormsPossible} variants active)`);
        }
    } else if (details.ramBlocked > 0) {
        // Aggressive Reallocation Loop (Max 5 attempts / 500ms)
        for (let attempt = 0; attempt < 5; attempt++) {
            await ns.dnet.memoryReallocation(targetHost);
            let freeRamCheck = ns.getServerMaxRam(targetHost) - ns.getServerUsedRam(targetHost);
            if (freeRamCheck >= requiredFreeRam) {
                if (ns.scp(variantsToDeploy, targetHost, "home")) {
                    for (const wormFile of variantsToDeploy) {
                        ns.exec(wormFile, targetHost, { threads: 1, preventDuplicates: true }, WORM_VERSION);
                    }
                    logSuccess(`Swarm deployed to ${targetHost} after reallocation`);
                }
                return;
            }
            await ns.sleep(100);
        }
    }
}

/** @param {NS} ns */
function getRankedNearbyServers(ns) {
    const nearbyServers = ns.dnet.probe();
    return nearbyServers.map(h => {
        try {
            const d = ns.dnet.getServerDetails(h);
            const isLab = d.modelId === "(The Labyrinth)" || h.includes("l4byr1nth");
            return { hostname: h, depth: d.depth || 0, isHighValue: isLab || (d.depth > 15), modelId: d.modelId };
        } catch (e) { return { hostname: h, depth: 0, isHighValue: false, modelId: "Unknown" }; }
    }).sort((a, b) => {
        if (a.isHighValue && !b.isHighValue) return -1;
        if (!a.isHighValue && b.isHighValue) return 1;
        return b.depth - a.depth;
    });
}
