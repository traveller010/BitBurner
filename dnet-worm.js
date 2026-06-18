const WORM_VERSION = "v1.4.1";
const WORM_COST = 13.80;
const BOOTSTRAP_COST = 6.00;

// Global tracking to prevent log spam
const reportedUnknowns = new Set();
const reportedStalls = new Set();
const deadTopology = new Set();
const localCooldowns = new Map();

// Global Password Vault
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
        return `${hh}:${mm}:${ss}:${kk}`;
    }

    function logSuccess(msg) {
        ns.tryWritePort(15, `[${getTimestamp()}] [${currentHost}] SUCCESS: ${msg}`);
    }

    function logDiag(msg) {
        ns.tryWritePort(14, `[${getTimestamp()}] [${currentHost}] DIAG: ${msg}`);
    }

    // =========================================================================
    // 🛰️ VAULT & STATE INITIALIZATION
    // =========================================================================
    if (currentHost === "home") {
        logSuccess(`Worm ${WORM_VERSION} initialized on home.`);
        if (ns.fileExists("darknet-keys.txt", "home")) {
            try {
                const fileData = ns.read("darknet-keys.txt");
                if (fileData) globalPasswordVault = JSON.parse(fileData);
            } catch (e) { logDiag(`Error loading vault: ${e}`); }
        }
    } else {
        // Sync vault from home
        try {
            if (ns.fileExists("darknet-keys.txt", "home")) {
                if (ns.scp("darknet-keys.txt", currentHost, "home")) {
                    const fileData = ns.read("darknet-keys.txt");
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

    // Free RAM if blocked
    if (currentHost !== "home" && currentHost !== "darkweb") {
        let details = ns.dnet.getServerDetails(currentHost);
        let retries = 0;
        while (details.ramBlocked > 0 && retries < 20) {
            await ns.dnet.memoryReallocation();
            details = ns.dnet.getServerDetails(currentHost);
            retries++;
            if (details.ramBlocked > 0) await ns.sleep(200);
        }
    }

    // Loot local caches
    const localCaches = ns.ls(currentHost, ".cache");
    for (const cacheFile of localCaches) {
        try {
            const result = await ns.dnet.openCache(cacheFile);
            logSuccess(`Looted ${cacheFile}: ${JSON.stringify(result)}`);
        } catch (e) { logDiag(`Failed to open cache ${cacheFile}: ${e}`); }
    }

    // =========================================================================
    // 🔄 MAIN PROPAGATION LOOP
    // =========================================================================
    while (true) {
        // Sync vault updates from Port 17 (Incoming from other worms)
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
        if (vaultUpdated && currentHost === "home") {
            ns.write("darknet-keys.txt", JSON.stringify(globalPasswordVault), "w");
        }

        const nearbyServers = ns.dnet.probe();
        const targets = nearbyServers.map(h => {
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

        for (const target of targets) {
            const hostname = target.hostname;
            if (deadTopology.has(hostname)) continue;

            // GATE 1: AUTHENTICATION
            const auth = await serverSolver(ns, hostname, logDiag, logSuccess);
            if (!auth || !auth.success) continue;

            // Update vault and port
            if (auth.password && globalPasswordVault[hostname] !== auth.password) {
                globalPasswordVault[hostname] = auth.password;
                ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: auth.password }));
            }

            const isLab = target.modelId === "(The Labyrinth)";
            if (isLab) continue; // Labyrinth handled within solver

            // GATE 2: DEPLOYMENT / UPGRADE
            const processes = ns.ps(hostname);
            const existingWorm = processes.find(p => p.filename === scriptName);

            if (existingWorm) {
                const remoteVersion = existingWorm.args[0] || "v0.0.0";
                if (remoteVersion !== WORM_VERSION) {
                    logDiag(`Hot-upgrading ${hostname} from ${remoteVersion} to ${WORM_VERSION}`);
                    ns.kill(existingWorm.pid);
                } else {
                    continue; // Already up to date
                }
            }

            // Hardware Audit
            const maxRam = ns.getServerMaxRam(hostname);
            const usedRam = ns.getServerUsedRam(hostname);
            const freeRam = maxRam - usedRam;
            const bootstrapper = "dnet-bootstrap.js";

            ns.scp([scriptName, bootstrapper], hostname, currentHost);

            if (maxRam < WORM_COST) {
                logDiag(`RAM too low (${maxRam}GB) on ${hostname}. Inducing migration.`);
                for (let j = 0; j < 5; j++) {
                    await ns.dnet.induceServerMigration(hostname);
                    await ns.sleep(40);
                }
                continue;
            }

            if (freeRam < WORM_COST) {
                logDiag(`RAM blocked on ${hostname}. Deploying bootstrapper.`);
                ns.exec(bootstrapper, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION, hostname);
                continue;
            }

            // Standard Exec
            try {
                ns.exec(scriptName, hostname, { threads: 1, preventDuplicates: true }, WORM_VERSION);
            } catch (e) { logDiag(`Failed to exec on ${hostname}: ${e}`); }
        }

        // Commented out to reduce RAM below 16GB
        /*
        if (currentHost !== "home" && currentHost !== "darkweb") {
            try { await ns.dnet.phishingAttack(); } catch (e) {}
            let whale = ns.peek(16);
            if (whale && whale !== "NULL DATA" && whale !== "NULL PORT DATA") {
                try { await ns.dnet.promoteStock(whale); } catch (e) {}
            }
        }
        */

        await ns.sleep(5000);
    }
}

/** @param {NS} ns */
async function serverSolver(ns, hostname, logDiag, logSuccess) {
    if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) return false;

    const details = ns.dnet.getServerDetails(hostname);
    if (!details.isConnectedToCurrentServer || !details.isOnline) return false;

    if (details.hasSession && details.modelId !== "(The Labyrinth)") {
        return { success: true, alreadyActive: true };
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
        const result = await crackingMatrix(ns, hostname, details, logDiag, logSuccess);
        if (!result || !result.success) {
            let hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb && hb.code === ns.enums.DarknetResponseCode.DirectConnectionRequired) {
                deadTopology.add(hostname);
            }
            // Log stalls for debugging
            let stallKey = `${hostname}-${details.modelId}`;
            if (!reportedStalls.has(stallKey)) {
                logDiag(`STALL: ${hostname} (${details.modelId}) Hint: ${details.passwordHint} Data: ${JSON.stringify(details.data)}`);
                reportedStalls.add(stallKey);
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
async function crackingMatrix(ns, hostname, details, logDiag, logSuccess) {
    const model = details.modelId;
    const currentHost = ns.getHostname();

    // Helper for Heartbleed checks
    const getLogEntry = async (guess) => {
        for (let i = 0; i < 15; i++) {
            await ns.sleep(40);
            const hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb && hb.logs) {
                const logs = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                const entry = logs.find(l => {
                    const s = typeof l === 'string' ? l : JSON.stringify(l);
                    return s.includes(guess);
                });
                if (entry) return entry;
            }
        }
        return null;
    };

    switch (model) {
        case "ZeroLogon":
            return { success: (await ns.dnet.authenticate(hostname, "")).success, password: "" };

        case "FreshInstall_1.0": {
            if (details.passwordFormat === "numeric") {
                const len = details.passwordLength || 4;
                const commons = ["123456789".slice(0, len), "0".repeat(len), "1".repeat(len), "9".repeat(len)];
                for (const g of commons) {
                    if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                }
                for (let i = 0; i < Math.pow(10, len); i++) {
                    const g = i.toString().padStart(len, '0');
                    if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                    if (i % 50 === 0) await ns.sleep(10);
                }
            } else {
                const hint = details.passwordHint || "";
                const words = hint.split(/\s+/);
                const last = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, "");
                if (last && (await ns.dnet.authenticate(hostname, last)).success) return { success: true, password: last };
                for (const g of ["password", "admin", "root", "default"]) {
                    if ((await ns.dnet.authenticate(hostname, g.slice(0, details.passwordLength))).success) return { success: true, password: g.slice(0, details.passwordLength) };
                }
            }
            return { success: false };
        }

        case "AccountsManager_4.2": {
            const len = details.passwordLength || 4;
            let low = 0, high = Math.pow(10, len) - 1;
            const matches = details.passwordHint.match(/\d+/g);
            if (matches && matches.length >= 2) {
                low = parseInt(matches[0]); high = parseInt(matches[1]);
            }
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const g = mid.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry.toLowerCase() : JSON.stringify(entry).toLowerCase();
                    if (s.includes("higher")) low = mid + 1;
                    else if (s.includes("lower")) high = mid - 1;
                    else break;
                } else break;
            }
            return { success: false };
        }

        case "RateMyPix.Auth": {
            const len = details.passwordLength || 5;
            const format = details.passwordFormat || "numeric";
            let pool = "0123456789";
            if (format === "alphanumeric") pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            else if (format === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

            let current = Array(len).fill(pool[0]);

            const getScore = async (g) => {
                const res = await ns.dnet.authenticate(hostname, g);
                if (res.success) return 999;

                for (let retry = 0; retry < 10; retry++) {
                    await ns.sleep(30);
                    const hb = await ns.dnet.heartbleed(hostname, { peek: true });
                    if (hb && hb.logs) {
                        const logs = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                        const entry = logs.find(l => {
                            const s = typeof l === 'string' ? l : JSON.stringify(l);
                            return s.includes(g);
                        });
                        if (entry) {
                            const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                            const cleanLogStr = s.replace(/\\/g, '');
                            const mData = cleanLogStr.match(/"data"\s*:\s*"([^"]+)"/) || cleanLogStr.match(/data:\s*([^\s]+)/);
                            if (mData) {
                                const feedback = mData[1];
                                if (feedback.startsWith("0/")) return 0;
                                return (feedback.match(/🌶️/g) || []).length;
                            }
                        }
                    }
                }
                return -1;
            };

            let baseScore = await getScore(current.join(''));
            if (baseScore === 999) return { success: true, password: current.join('') };

            for (let i = 0; i < len; i++) {
                const origChar = current[i];
                for (let j = 1; j < pool.length; j++) {
                    current[i] = pool[j];
                    const score = await getScore(current.join(''));
                    if (score === 999) return { success: true, password: current.join('') };
                    if (score > baseScore) {
                        baseScore = score;
                        break; // Locked this position
                    } else if (score < baseScore) {
                        current[i] = origChar;
                        break;
                    }
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, current.join(''))).success, password: current.join('') };
        }

        case "Factori-Os": {
            const len = details.passwordLength || 2;
            const max = Math.pow(10, len) - 1;
            const primePool = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541];

            const checkDivisibility = async (n) => {
                const g = n.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, g)).success) return "WIN";
                await ns.sleep(30);
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    return s.includes("IS divisible") || s.includes('"data":true') || s.includes('data: true');
                }
                return false;
            };

            let knownProduct = 1;
            for (const p of primePool) {
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
                    if ((await ns.dnet.authenticate(hostname, finalStr)).success) return { success: true, password: finalStr };
                }
            }
            // Fallback brute
            for (let i = 0; i <= max; i++) {
                if (i % knownProduct === 0) {
                    const g = i.toString().padStart(len, '0');
                    if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                }
            }
            return { success: false };
        }

        case "EuroZone Free": {
            const countries = ["albania", "andorra", "austria", "belgium", "bulgaria", "croatia", "cyprus", "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "norway", "poland", "portugal", "romania", "russia", "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "ukraine", "united kingdom"];
            const len = details.passwordLength;
            const candidates = countries.filter(c => c.length === len);
            for (const c of candidates) {
                const variants = [c, c.toUpperCase(), c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
                for (const v of variants) {
                    if ((await ns.dnet.authenticate(hostname, v)).success) return { success: true, password: v };
                }
            }
            return { success: false };
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
            if (ns.fileExists("darknet-words.txt", "home")) {
                if (ns.scp("darknet-words.txt", currentHost, "home")) {
                    const words = ns.read("darknet-words.txt").split("\n");
                    for (const w of words) if (w.trim().length === details.passwordLength) dict.push(w.trim());
                }
            }
            const unique = Array.from(new Set(dict));
            for (const g of unique) {
                if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
            }
            return { success: false };
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
            if (hint.includes("between")) {
                let limits = hint.match(/'([^']+)'/g);
                if (limits && limits.length >= 2) {
                    let low = parseRoman(limits[0].replace(/'/g, '')), high = parseRoman(limits[1].replace(/'/g, ''));
                    const len = details.passwordLength || 3;
                    while (low <= high) {
                        let mid = Math.floor((low + high) / 2), g = mid.toString().padStart(len, '0');
                        if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
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
                    if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
                }
            }
            return { success: false };
        }

        case "DeskMemo_3.1":
        case "CloudBlare(tm)": {
            let matches = (details.data || details.passwordHint || "").match(/\d+/g);
            if (matches) {
                for (const g of matches) if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
            }
            if (model === "CloudBlare(tm)" && details.data) {
                let digits = details.data.replace(/\D/g, "");
                if (digits && (await ns.dnet.authenticate(hostname, digits)).success) return { success: true, password: digits };
            }
            return { success: false };
        }

        case "KingOfTheHill": {
            const len = details.passwordLength || 2, max = Math.pow(10, len) - 1;
            const getAlt = async (n) => {
                const g = n.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, g)).success) return { win: true, g };
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    const m = s.match(/altitude:\s*(\d+(?:\.\d+)?)/i) || s.match(/data:\s*(\d+(?:\.\d+)?)/i);
                    if (m) return { win: false, alt: parseFloat(m[1]) };
                }
                return { win: false, alt: -1 };
            };
            let bestG = 0, bestAlt = -1;
            for (let i = 0; i <= max; i += Math.max(1, Math.floor(max / 20))) {
                let res = await getAlt(i);
                if (res.win) return { success: true, password: res.g };
                if (res.alt > bestAlt) { bestAlt = res.alt; bestG = i; }
            }
            // Hill climbing
            let curr = bestG, step = Math.max(1, Math.floor(max / 40));
            while (step >= 1) {
                let up = curr + step, down = curr - step, found = false;
                if (up <= max) {
                    let res = await getAlt(up);
                    if (res.win) return { success: true, password: res.g };
                    if (res.alt > bestAlt) { bestAlt = res.alt; curr = up; found = true; }
                }
                if (!found && down >= 0) {
                    let res = await getAlt(down);
                    if (res.win) return { success: true, password: res.g };
                    if (res.alt > bestAlt) { bestAlt = res.alt; curr = down; found = true; }
                }
                if (!found) step = Math.floor(step / 2);
            }
            for (let i = Math.max(0, curr - 5); i <= Math.min(max, curr + 5); i++) {
                let res = await getAlt(i);
                if (res.win) return { success: true, password: res.g };
            }
            return { success: false };
        }

        case "Laika4": {
            for (const dog of ["laika", "fido", "spot", "rover", "max", "buddy"]) {
                if ((await ns.dnet.authenticate(hostname, dog)).success) return { success: true, password: dog };
                if ((await ns.dnet.authenticate(hostname, dog.toUpperCase())).success) return { success: true, password: dog.toUpperCase() };
            }
            return { success: false };
        }

        case "NIL": {
            const len = details.passwordLength || 6, format = details.passwordFormat || "numeric";
            let pool = "0123456789".split("");
            if (format === "alphanumeric") pool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            else if (format === "alphabetic") pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            let res = Array(len).fill(null);
            for (const char of pool) {
                const g = char.repeat(len);
                if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                    const m = s.match(/"data"\s*:\s*"([^"]+)"/) || s.match(/data:\s*([^\s,]+(?:,[^\s,]+)*)/);
                    if (m) {
                        let feedback = m[1].split(",");
                        for (let i = 0; i < len; i++) if (feedback[i] === "yes") res[i] = char;
                    }
                }
                if (res.every(x => x !== null)) break;
            }
            const final = res.map(x => x || pool[0]).join("");
            return { success: (await ns.dnet.authenticate(hostname, final)).success, password: final };
        }

        case "Pr0verFl0": {
            const len = details.passwordLength || 7;
            await ns.dnet.authenticate(hostname, "A".repeat(len));
            const entry = await getLogEntry("A".repeat(len));
            if (entry) {
                const s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                const m = s.match(/expected '([^■']+)/i) || s.match(/passwordExpected:\s*([^■\s]+)/i);
                if (m) {
                    const prefix = m[1], pool = Array.from(new Set(s.replace(/[^a-zA-Z0-9]/g, '').split('')));
                    if (len - prefix.length === 3) {
                        for (let c1 of pool) for (let c2 of pool) for (let c3 of pool) {
                            let g = prefix + c1 + c2 + c3;
                            if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                        }
                    }
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, "A".repeat(len + 8))).success, password: "A".repeat(len + 8) };
        }

        case "OpenWebAccessPoint": {
            const len = details.passwordLength || 4;
            for (const seed of ["admin", "password", "guest", "1234", "0000", "9999"]) {
                const g = seed.slice(0, len);
                if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                const entry = await getLogEntry(g);
                if (entry) {
                    const s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                    const m = s.match(/"data"\s*:\s*"([^"]+)"/);
                    if (m) {
                        const data = m[1], sig = `${hostname}:`, idx = data.indexOf(sig);
                        if (idx !== -1) {
                            const p = data.substr(idx + sig.length, len);
                            if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
                        }
                        for (let i = 0; i <= data.length - len; i++) {
                            const sub = data.substr(i, len);
                            if ((await ns.dnet.authenticate(hostname, sub)).success) return { success: true, password: sub };
                        }
                    }
                }
            }
            return { success: false };
        }

        case "OctantVoxel": {
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
                if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
            }
            return { success: false };
        }

        case "DeepGreen": {
            const len = details.passwordLength || 3, format = details.passwordFormat || "numeric";
            let pool = "0123456789";
            if (format === "alphanumeric") pool += "abcdefghijklmnopqrstuvwxyz";
            const clues = [];
            const isValid = (cand) => {
                for (const c of clues) {
                    let exact = 0, wrong = 0, cArr = cand.split(""), gArr = c.g.split("");
                    for (let j = 0; j < len; j++) if (cArr[j] === gArr[j]) { exact++; cArr[j] = null; gArr[j] = null; }
                    for (let j = 0; j < len; j++) if (gArr[j]) { let idx = cArr.indexOf(gArr[j]); if (idx !== -1) { wrong++; cArr[idx] = null; } }
                    if (exact !== c.e || wrong !== c.w) return false;
                }
                return true;
            };
            let curr = pool[0].repeat(len);
            for (let r = 0; r < 50; r++) {
                if ((await ns.dnet.authenticate(hostname, curr)).success) return { success: true, password: curr };
                const entry = await getLogEntry(curr);
                if (entry) {
                    const s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                    const m = s.match(/"data"\s*:\s*"(\d+),(\d+)"/) || s.match(/data:\s*(\d+),(\d+)/);
                    if (m) {
                        clues.push({ g: curr, e: parseInt(m[1]), w: parseInt(m[2]) });
                        if (len <= 4) {
                            let found = false;
                            for (let i = 0; i < Math.pow(pool.length, len); i++) {
                                let cand = ""; let tmp = i;
                                for (let k = 0; k < len; k++) { cand = pool[tmp % pool.length] + cand; tmp = Math.floor(tmp / pool.length); }
                                if (isValid(cand)) { curr = cand; found = true; break; }
                            }
                            if (!found) break;
                        } else break;
                    } else break;
                } else break;
            }
            return { success: false };
        }

        case "PHP 5.4": {
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
                for (let p of perm(digits)) if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
            }
            return { success: false };
        }

        case "OrdoXenos": {
            let data = details.data || "";
            if (data.includes(";")) {
                let [cipher, masks] = data.split(";"), mPool = masks.split(" ").map(b => parseInt(b, 2));
                let res = ""; for (let i = 0; i < cipher.length; i++) res += String.fromCharCode(cipher.charCodeAt(i) ^ mPool[i]);
                if ((await ns.dnet.authenticate(hostname, res)).success) return { success: true, password: res };
            }
            return { success: false };
        }

        case "PrimeTime 2": {
            let m = (details.passwordHint || "").match(/\d+/);
            if (m) {
                let n = parseInt(m[0]), d = 2;
                while (d * d <= n) { if (n % d === 0) n /= d; else d++; }
                if ((await ns.dnet.authenticate(hostname, n.toString())).success) return { success: true, password: n.toString() };
            }
            return { success: false };
        }

        case "110100100": {
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
                if ((await ns.dnet.authenticate(hostname, res)).success) return { success: true, password: res };
            }
            return { success: false };
        }

        case "BigMo%od": {
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
            let mods = [], rems = [];
            for (let p of primes) {
                if ((await ns.dnet.authenticate(hostname, p.toString())).success) return { success: true, password: p.toString() };
                let entry = await getLogEntry(p.toString());
                if (entry) {
                    let s = (typeof entry === 'string' ? entry : JSON.stringify(entry)).replace(/\\/g, '');
                    let m = s.match(/"data"\s*:\s*"(\d+)"/) || s.match(/data:\s*(\d+)/) || s.match(/=\s*(\d+)/);
                    if (m) { mods.push(BigInt(p)); rems.push(BigInt(m[1])); }
                }
            }
            if (mods.length > 0) {
                let N = mods.reduce((a, b) => a * b, 1n), res = 0n;
                for (let i = 0; i < mods.length; i++) {
                    let Ni = N / mods[i], inv = 0n;
                    for (let j = 1n; j < mods[i]; j++) if ((Ni * j) % mods[i] === 1n) { inv = j; break; }
                    res += rems[i] * Ni * inv;
                }
                const p = (res % N).toString();
                if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
            }
            return { success: false };
        }

        case "2G_cellular": {
            const len = details.passwordLength || 6, pool = "0123456789abcdefghijklmnopqrstuvwxyz";
            let g = Array(len).fill(pool[0]);
            for (let i = 0; i < len; i++) {
                for (let j = 0; j < pool.length; j++) {
                    g[i] = pool[j];
                    if ((await ns.dnet.authenticate(hostname, g.join(''))).success) return { success: true, password: g.join('') };
                    let entry = await getLogEntry(g.join(''));
                    if (entry) {
                        let s = typeof entry === 'string' ? entry : JSON.stringify(entry);
                        let m = s.match(/character \((\d+)\)/i);
                        if (m && parseInt(m[1]) > i) break;
                    }
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, g.join(''))).success, password: g.join('') };
        }

        case "MathML": {
            if (details.data) {
                try {
                    let cleanExpr = String(details.data).split(',')[0]
                        .replace(/\u04b3/g, '*') // ҳ
                        .replace(/\u2795/g, '+') // ➕
                        .replace(/\u2796/g, '-') // ➖
                        .replace(/\u00f7/g, '/'); // ÷

                    if (/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
                        const evalRes = Function(`return (${cleanExpr})`)();
                        let targetLen = details.passwordLength || 2;
                        let resStr = evalRes.toString();
                        if (resStr.length > targetLen) resStr = resStr.slice(0, targetLen);
                        if ((await ns.dnet.authenticate(hostname, resStr)).success) return { success: true, password: resStr };
                    }
                } catch (e) { logDiag(`MathML error: ${e}`); }
            }
            return { success: false };
        }

        case "(The Labyrinth)":
            return await solveLabyrinth(ns, hostname, logDiag, logSuccess);

        default:
            if (!reportedUnknowns.has(model)) {
                logDiag(`Unknown model: ${model} on ${hostname}. Hint: ${details.passwordHint}`);
                reportedUnknowns.add(model);
            }
            return { success: false };
    }
}

/** @param {NS} ns */
async function solveLabyrinth(ns, hostname, logDiag, logSuccess) {
    const saveFile = `maze-${hostname}.txt`;
    const home = "home";
    const currentHost = ns.getHostname();
    let state = {
        grid: {},
        moveStack: [],
        visited: []
    };

    const syncLoad = () => {
        if (ns.fileExists(saveFile, home)) {
            if (currentHost !== home) ns.scp(saveFile, currentHost, home);
            try {
                const data = JSON.parse(ns.read(saveFile));
                state = Object.assign(state, data);
            } catch (e) {}
        }
    };

    const syncSave = () => {
        try {
            ns.write(saveFile, JSON.stringify(state), "w");
            if (currentHost !== home) ns.scp(saveFile, home, currentHost);
        } catch (e) {}
    };

    syncLoad();
    const opposites = { north: "south", south: "north", east: "west", west: "east" };

    // Connection starts at [1,1]. Re-trace stack.
    if (state.moveStack.length > 0) {
        logDiag(`Re-tracing ${state.moveStack.length} steps in Labyrinth...`);
        for (const move of state.moveStack) {
            await ns.dnet.authenticate(hostname, `go ${move}`);
            await ns.sleep(60);
        }
    }

    while (true) {
        let report = await ns.dnet.labreport(hostname);
        if (!report || !report.coords) break;

        const hb = await ns.dnet.heartbleed(hostname, { peek: true });
        if (hb && hb.logs) {
            const logStr = JSON.stringify(hb.logs);
            if (logStr.includes("!!")) {
                const m = logStr.match(/!!([^!]+)!!/);
                if (m) {
                    const pass = m[1];
                    if ((await ns.dnet.authenticate(hostname, pass)).success) {
                        logSuccess(`LABYRINTH CONQUERED: ${hostname}`);
                        // Direct loot from current context (authenticated session)
                        for (const c of ns.ls(hostname, '.cache')) {
                             try {
                                 await ns.dnet.openCache(c);
                                 logSuccess(`Looted cache ${c} from Labyrinth ${hostname}`);
                             } catch(e) { logDiag(`Failed to open Labyrinth cache ${c}: ${e}`); }
                        }
                        if (ns.fileExists(saveFile, home)) ns.rm(saveFile, home);
                        return { success: true, password: pass };
                    }
                }
            }
        }

        const curKey = `${report.coords[0]},${report.coords[1]}`;
        if (!state.grid[curKey]) {
            state.grid[curKey] = {
                n: report.north, s: report.south, e: report.east, w: report.west,
                explored: { north: false, south: false, east: false, west: false }
            };
        }

        let move = null;
        for (let dir of ["north", "south", "east", "west"]) {
            if (report[dir] && !state.grid[curKey].explored[dir]) {
                move = dir;
                break;
            }
        }

        if (move) {
            state.grid[curKey].explored[move] = true;
            logDiag(`Labyrinth at ${curKey}, moving ${move}`);
            await ns.dnet.authenticate(hostname, `go ${move}`);
            await ns.sleep(60);

            const nextReport = await ns.dnet.labreport(hostname);
            if (nextReport && nextReport.coords) {
                const nextKey = `${nextReport.coords[0]},${nextReport.coords[1]}`;
                state.moveStack.push(move);
                if (!state.grid[nextKey]) {
                    state.grid[nextKey] = {
                        n: nextReport.north, s: nextReport.south, e: nextReport.east, w: nextReport.west,
                        explored: { north: false, south: false, east: false, west: false }
                    };
                }
                state.grid[nextKey].explored[opposites[move]] = true;
                syncSave();
            }
        } else if (state.moveStack.length > 0) {
            const backMove = opposites[state.moveStack.pop()];
            logDiag(`Labyrinth at ${curKey}, backtracking ${backMove}`);
            await ns.dnet.authenticate(hostname, `go ${backMove}`);
            await ns.sleep(60);
            syncSave();
        } else {
            logDiag(`Labyrinth fully explored at ${curKey}. No exit found.`);
            break;
        }
    }
    return { success: false };
}

function acquireLock(ns, hostname, model) {
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

function releaseLock(ns, hostname) {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const port = 10 + Math.abs(hash % 4);

    let portData = ns.readPort(port);
    let locks = (portData === "NULL PORT DATA" || portData === "NULL DATA" || !portData) ? [] : JSON.parse(portData);

    locks = locks.filter(l => l.host !== hostname);
    ns.writePort(port, JSON.stringify(locks));
}
