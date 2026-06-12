const WORM_VERSION = "v1.4.0";
const WORM_COST = 13.80; // Optimized RAM target
let globalPasswordVault = {};
const localCooldowns = new Map();
const deadTopology = new Set();

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const currentHost = ns.getHostname();
    const scriptName = ns.getScriptName();
    const loggerScript = "dnet-logger.js";
    const workerScript = "dnet-worker.js";
    const bootstrapScript = "dnet-bootstrap.js";

    if (currentHost === "home") {
        ns.tprint(`\ud83d\udc0d [WORM] ${WORM_VERSION} initialized on home.`);
        if (ns.fileExists(loggerScript) && !ns.scriptRunning(loggerScript, "home")) {
            ns.exec(loggerScript, "home");
            await ns.sleep(500);
        }
        if (ns.fileExists("darknet-keys.txt")) {
            try {
                const data = ns.read("darknet-keys.txt");
                if (data) globalPasswordVault = JSON.parse(data);
            } catch (e) { ns.tprint(`[VAULT-LOAD-ERROR] ${e}`); }
        }
    }

    while (true) {
        // --- Password Vault Synchronization ---
        if (currentHost === "home") {
            let portUpdate = ns.readPort(17);
            let vaultUpdated = false;
            while (portUpdate && portUpdate !== "NULL PORT DATA" && portUpdate !== "NULL DATA") {
                try {
                    const update = JSON.parse(portUpdate);
                    if (update.host && update.pass && globalPasswordVault[update.host] !== update.pass) {
                        globalPasswordVault[update.host] = update.pass;
                        vaultUpdated = true;
                    }
                } catch {}
                portUpdate = ns.readPort(17);
            }
            if (vaultUpdated) ns.write("darknet-keys.txt", JSON.stringify(globalPasswordVault), "w");
        } else {
            try {
                if (ns.fileExists("darknet-keys.txt", "home")) {
                    ns.scp("darknet-keys.txt", currentHost, "home");
                    const data = ns.read("darknet-keys.txt");
                    if (data) {
                        const remoteVault = JSON.parse(data);
                        globalPasswordVault = Object.assign({}, remoteVault, globalPasswordVault);
                    }
                }
            } catch {}
            // Maintain worker locally
            if (ns.fileExists(workerScript, "home")) {
                ns.scp(workerScript, currentHost, "home");
                if (!ns.scriptRunning(workerScript, currentHost)) ns.exec(workerScript, currentHost);
            }
        }

        // --- Network Reconnaissance ---
        let nearbyServers = [];
        try {
            nearbyServers = ns.dnet.probe();
            if (currentHost === "home" && nearbyServers.length > 0 && !reportedSpecs.has("first-probe")) {
                ns.tprint(`\ud83d\udc0d [WORM] Discovered ${nearbyServers.length} neighbors: ${nearbyServers.join(", ")}`);
                reportedSpecs.add("first-probe");
            }
        } catch (e) {
            if (currentHost === "home") ns.tprint(`[PROBE-ERROR] ${e}`);
        }

        const prioritizedTargets = nearbyServers.map(hostname => {
            try {
                const details = ns.dnet.getServerDetails(hostname);
                return {
                    hostname,
                    depth: details.depth || 0,
                    modelId: details.modelId,
                    isHighValue: (details.modelId === "(The Labyrinth)" || details.depth > 15)
                };
            } catch { return { hostname, depth: 0, modelId: "Unknown", isHighValue: false }; }
        }).sort((a, b) => (b.isHighValue - a.isHighValue) || (b.depth - a.depth));

        // --- Expansion Cycle ---
        for (const target of prioritizedTargets) {
            const hostname = target.hostname;
            if (!hostname || hostname === currentHost) continue;

            const authResult = await serverSolver(ns, hostname);
            if (!authResult || !authResult.success) continue;

            // Check for existing infection
            if (ns.scriptRunning(scriptName, hostname)) {
                // If it's the Labyrinth, we always re-enter if we don't have the pass
                if (target.modelId !== "(The Labyrinth)") continue;
            }

            ns.scp([scriptName, bootstrapScript, workerScript], hostname, currentHost);

            const maxRam = ns.getServerMaxRam(hostname);
            if (maxRam < WORM_COST && target.modelId !== "(The Labyrinth)") {
                // Induce migration for undersized hardware
                await ns.dnet.induceServerMigration(hostname);
                continue;
            }

            if (authResult.password) {
                globalPasswordVault[hostname] = authResult.password;
                ns.tryWritePort(17, JSON.stringify({ host: hostname, pass: authResult.password }));
            }

            ns.tryWritePort(15, `[AUTH-SUCCESS] [${currentHost}] Colonized: ${hostname} (${target.modelId})`);

            if (target.modelId !== "(The Labyrinth)") {
                let pid = ns.exec(scriptName, hostname, 1, WORM_VERSION);
                if (pid === 0) {
                    // RAM Blocked fallback
                    ns.tryWritePort(14, `[DEPLOY-FAIL] ${hostname} blocked. Using bootstrap...`);
                    ns.exec(bootstrapScript, hostname, 1, WORM_VERSION, hostname);
                }
                // Try to start worker if RAM permits
                if (maxRam >= WORM_COST + 1.2) ns.exec(workerScript, hostname);
            }
        }

        await ns.sleep(2000);
    }
}

/** @param {NS} ns */
async function serverSolver(ns, hostname) {
    if (localCooldowns.has(hostname) && Date.now() < localCooldowns.get(hostname)) return false;
    if (deadTopology.has(hostname)) return false;

    const details = ns.dnet.getServerDetails(hostname);
    if (!details.isConnectedToCurrentServer || !details.isOnline) return false;
    if (details.hasSession) return { success: true, modelId: details.modelId };

    if (globalPasswordVault[hostname]) {
        try {
            await ns.dnet.connectToSession(hostname, globalPasswordVault[hostname]);
            if (ns.dnet.getServerDetails(hostname).hasSession) return { success: true, modelId: details.modelId };
            delete globalPasswordVault[hostname];
        } catch { delete globalPasswordVault[hostname]; }
    }

    if (!acquireNetworkLock(ns, hostname, details.modelId)) return false;
    try {
        const res = await executeCrackingMatrix(ns, hostname, details);
        if (!res || !res.success) {
            let hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb && hb.code === ns.enums.DarknetResponseCode.DirectConnectionRequired) {
                deadTopology.add(hostname);
            }
            return false;
        }
        return res;
    } catch (e) { return false; } finally { releaseNetworkLock(ns, hostname); }
}

/** @param {NS} ns */
async function executeCrackingMatrix(ns, hostname, details) {
    const parseRoman = (str) => {
        if (!str || str.toLowerCase() === "nulla") return 0;
        const rMap = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
        let val = 0;
        for (let i = 0; i < str.length; i++) {
            let curr = rMap[str[i].toUpperCase()], next = rMap[str[i + 1]?.toUpperCase()];
            if (next > curr) { val += (next - curr); i++; } else { val += curr; }
        }
        return val;
    };

    const getLogEntry = async (guess) => {
        const gs = String(guess);
        for (let retry = 0; retry < 15; retry++) {
            let hb = await ns.dnet.heartbleed(hostname, { peek: true });
            if (hb && hb.logs) {
                let logs = Array.isArray(hb.logs) ? hb.logs : [hb.logs];
                for (let entry of logs) {
                    let logStr = typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
                    if (logStr.includes(`"${gs}"`) || logStr.includes(`: ${gs}`)) return logStr;
                }
            }
            await ns.sleep(50);
        }
        return null;
    };

    switch (details.modelId) {
        case "ZeroLogon":
            return { success: (await ns.dnet.authenticate(hostname, "")).success, password: "" };

        case "FreshInstall_1.0": {
            let len = details.passwordLength || 4;
            if (details.passwordFormat === "numeric") {
                for (let i = 0; i < Math.pow(10, len); i++) {
                    let guess = i.toString().padStart(len, '0');
                    if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                    if (i % 25 === 0 && ns.dnet.getServerDetails(hostname).hasSession) return { success: true };
                }
            } else {
                const words = details.passwordHint.trim().split(" ");
                const last = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, "");
                if (last && (await ns.dnet.authenticate(hostname, last)).success) return { success: true, password: last };
                for (const pwd of ["password", "admin", "root", "1234", "default", "settings"]) {
                    let adj = pwd.slice(0, details.passwordLength);
                    if ((await ns.dnet.authenticate(hostname, adj)).success) return { success: true, password: adj };
                }
            }
            return { success: false };
        }

        case "AccountsManager_4.2": {
            let len = details.passwordLength || 4;
            let low = 0, high = Math.pow(10, len) - 1;
            let match = details.passwordHint.match(/\d+/g);
            if (match && match.length >= 2) {
                low = parseInt(match[match.length - 2]); high = parseInt(match[match.length - 1]);
            }
            while (low <= high) {
                let mid = Math.floor((low + high) / 2), gs = mid.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
                let log = await getLogEntry(gs);
                if (log && log.toLowerCase().includes("higher")) low = mid + 1;
                else if (log && log.toLowerCase().includes("lower")) high = mid - 1;
                else break;
            }
            return { success: false };
        }

        case "BellaCuore": {
            let hints = details.passwordHint?.match(/'([^']+)'/g);
            if (hints && hints.length >= 2) {
                let low = parseRoman(hints[0].replace(/'/g, '')), high = parseRoman(hints[1].replace(/'/g, ''));
                let len = details.passwordLength || 3;
                while (low <= high) {
                    let mid = Math.floor((low + high) / 2), gs = mid.toString().padStart(len, '0');
                    if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
                    let log = await getLogEntry(gs);
                    if (log && log.toUpperCase().includes("PARUM")) low = mid + 1;
                    else if (log && /NIMIS|LONGUS|MAGNUS|ALTA/.test(log.toUpperCase())) high = mid - 1;
                    else break;
                }
            } else {
                let roman = details.data || details.passwordHint?.match(/'([IVXLCDM]+)'/)?.[1];
                if (roman) {
                    let pw = parseRoman(roman).toString();
                    if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
                }
            }
            return { success: false };
        }

        case "DeskMemo_3.1": {
            const match = details.passwordHint.match(/\d+/);
            return match ? { success: (await ns.dnet.authenticate(hostname, match[0])).success, password: match[0] } : { success: false };
        }

        case "CloudBlare(tm)": {
            let digits = (details.data || "").split("").filter(c => !isNaN(c) && c !== " ").join("");
            if (digits && (await ns.dnet.authenticate(hostname, digits)).success) return { success: true, password: digits };
            const match = details.passwordHint.match(/\d+/);
            return match ? { success: (await ns.dnet.authenticate(hostname, match[0])).success, password: match[0] } : { success: false };
        }

        case "RateMyPix.Auth": {
            let len = details.passwordLength || 5;
            let currentPin = Array(len).fill('0');
            const pool = details.passwordFormat === "numeric" ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':,./<>?";
            const getChili = (log) => {
                let m = log.match(/"data"\s*:\s*"([^"]+)\/\d+"/) || log.match(/data:\s*([^"{\s]+)\/\d+/);
                if (!m) return null;
                let val = m[1].trim();
                return /^\d+$/.test(val) ? parseInt(val, 10) : Array.from(val).length;
            };
            await ns.dnet.authenticate(hostname, currentPin.join(''));
            let lastScore = getChili(await getLogEntry(currentPin.join('')) || "") || 0;
            for (let pos = 0; pos < len; pos++) {
                let originalChar = currentPin[pos], locked = false;
                for (let char of pool) {
                    if (char === originalChar && pos > 0) continue;
                    currentPin[pos] = char; let guess = currentPin.join('');
                    if ((await ns.dnet.authenticate(hostname, guess)).success) return { success: true, password: guess };
                    let log = await getLogEntry(guess);
                    if (log) {
                        let score = getChili(log);
                        if (score !== null) {
                            if (score > lastScore) { lastScore = score; locked = true; break; }
                            else if (score < lastScore) { currentPin[pos] = originalChar; locked = true; break; }
                        }
                    }
                }
                if (!locked) currentPin[pos] = originalChar;
            }
            return { success: (await ns.dnet.authenticate(hostname, currentPin.join(''))).success, password: currentPin.join('') };
        }

        case "Factori-Os": {
            let len = details.passwordLength || 2;
            if (details.passwordFormat !== "numeric") return { success: false };
            let max = Math.pow(10, len) - 1, startGuess = "0".repeat(len);
            await ns.dnet.authenticate(hostname, startGuess);
            let divisors = [], nonDivisors = [], log = await getLogEntry(startGuess);
            if (log) {
                divisors = [...log.matchAll(/IS divisible by '(\d+)'/gi)].map(m => parseInt(m[1]));
                nonDivisors = [...log.matchAll(/is not divisible by '(\d+)'/gi)].map(m => parseInt(m[1]));
            }
            let step = divisors.length > 0 ? divisors.reduce((a, b) => (a * b) / ((x, y) => { while (y) { x %= y; [x, y] = [y, x]; } return x; })(a, b), 1) : 1;
            for (let i = step; i <= max; i += step) {
                if (nonDivisors.some(d => i % d === 0)) continue;
                let gs = i.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
            }
            return { success: false };
        }

        case "KingOfTheHill": {
            let len = details.passwordLength || 2, max = Math.pow(10, len) - 1;
            const getAltitude = async (val) => {
                let gs = val.toString().padStart(len, '0');
                if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, pass: gs };
                let log = await getLogEntry(gs);
                let alt = log?.match(/altitude:\s*(\d+(?:\.\d+)?)/i)?.[1] || log?.match(/data:\s*(\d+(?:\.\d+)?)/i)?.[1];
                return { success: false, altitude: parseFloat(alt || "0") };
            };
            let step = 5, left = 0, right = max, bestVal = -1, bestAlt = -1;
            while (left <= right) {
                let resL = await getAltitude(left); if (resL.success) return { success: true, password: resL.pass };
                if (resL.altitude > bestAlt) { bestAlt = resL.altitude; bestVal = left; }
                if (left !== right) {
                    let resR = await getAltitude(right); if (resR.success) return { success: true, password: resR.pass };
                    if (resR.altitude > bestAlt) { bestAlt = resR.altitude; bestVal = right; }
                }
                if (bestAlt > 0) break;
                left += step; right -= step;
            }
            if (bestVal !== -1) {
                for (let i = Math.max(0, bestVal - 5); i <= Math.min(max, bestVal + 5); i++) {
                    let res = await getAltitude(i); if (res.success) return { success: true, password: res.pass };
                }
            }
            return { success: false };
        }

        case "Laika4": {
            for (const pup of ["laika", "laika4", "fido", "spot", "rover", "max"]) {
                if ((await ns.dnet.authenticate(hostname, pup)).success) return { success: true, password: pup };
                if ((await ns.dnet.authenticate(hostname, pup.toUpperCase())).success) return { success: true, password: pup.toUpperCase() };
            }
            return { success: false };
        }

        case "NIL": {
            let len = details.passwordLength || 6;
            const pool = details.passwordFormat === "numeric" ? "0123456789".split("") : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            let discovered = Array(len).fill(null);
            for (let char of pool) {
                if (discovered.every(v => v !== null)) break;
                let guess = char.repeat(len);
                await ns.dnet.authenticate(hostname, guess);
                let log = await getLogEntry(guess);
                let feedback = log?.replace(/\\/g, "").match(/"data"\s*:\s*"([^"]+)"/)?.[1];
                if (feedback) {
                    let arr = feedback.split(',');
                    for (let i = 0; i < len; i++) if (arr[i] === "yes") discovered[i] = char;
                }
            }
            let final = discovered.map(v => v || pool[0]).join('');
            return { success: (await ns.dnet.authenticate(hostname, final)).success, password: final };
        }

        case "(The Labyrinth)": {
            const opp = { "north": "south", "south": "north", "east": "west", "west": "east" };
            const visited = new Map();
            let trail = [], lastDir = null, saveFile = `maze-${hostname}.txt`;
            if (ns.fileExists(saveFile, "home")) {
                ns.scp(saveFile, hostname, "home");
                try {
                    let p = JSON.parse(ns.read(saveFile) || "{}");
                    trail = p.trailStack || [];
                    for (let [c, d] of Object.entries(p.visitedNodes || {})) visited.set(c, d);
                } catch {}
            }
            const sync = () => {
                ns.write(saveFile, JSON.stringify({ trailStack: trail, visitedNodes: Object.fromEntries(visited) }), "w");
                ns.scp(saveFile, "home", hostname);
            };
            for (let step = 0; step < 400; step++) {
                let hb = await ns.dnet.heartbleed(hostname, { peek: true });
                let logStr = JSON.stringify(hb?.logs || []);
                let rawData = logStr.match(/"data"\s*:\s*"([^"]+)"/)?.[1];
                let report = JSON.parse(logStr.match(/\{"coords":\[\d+,\d+\],.*?\}/)?.[0] || "null");
                if (!rawData || !report) { await ns.sleep(50); continue; }
                if (rawData.includes("!!") || !rawData.includes("\\u2588")) {
                    let pass = rawData.trim();
                    if ((await ns.dnet.authenticate(hostname, pass)).success) {
                        ns.write(saveFile, "", "w"); ns.scp(saveFile, "home", hostname);
                        return { success: true, password: pass };
                    }
                }
                let cur = `${report.coords[0]},${report.coords[1]}`;
                if (rawData.includes("valid move") || rawData.includes("wall")) {
                    if (trail.length > 0 && trail[trail.length - 1].dir === lastDir) trail.pop();
                    let node = visited.get(cur);
                    if (node) {
                        node.availableDirs = node.availableDirs.filter(d => d !== lastDir);
                        node.allOpenDirs = node.allOpenDirs.filter(d => d !== lastDir);
                        sync();
                    }
                    lastDir = null;
                }
                if (!visited.has(cur)) {
                    let all = [], av = [];
                    ["north", "south", "east", "west"].forEach(d => {
                        if (report[d]) {
                            all.push(d); let [tx, ty] = [report.coords[0], report.coords[1]];
                            if (d === "north") ty--; else if (d === "south") ty++; else if (d === "east") tx++; else tx--;
                            if (!visited.has(`${tx},${ty}`)) av.push(d);
                        }
                    });
                    visited.set(cur, { availableDirs: av, allOpenDirs: all }); sync();
                }
                let node = visited.get(cur);
                if (node.availableDirs.length > 0) {
                    lastDir = node.availableDirs.shift(); trail.push({ coord: cur, dir: lastDir }); sync();
                    await ns.dnet.authenticate(hostname, lastDir);
                } else if (trail.length > 0) {
                    let back = trail.pop(); await ns.dnet.authenticate(hostname, opp[back.dir]);
                } else break;
                await ns.sleep(60);
            }
            return { success: false };
        }

        case "Pr0verFl0": {
            let len = details.passwordLength || 7, guess = "A".repeat(len);
            await ns.dnet.authenticate(hostname, guess);
            let log = (await getLogEntry(guess))?.replace(/\\/g, '');
            if (log) {
                let prefix = log.match(/expected '([^\\u25a0']+)/i)?.[1] || "";
                let pool = Array.from(new Set(log.replace(/[^a-zA-Z0-9]/g, '').split('')));
                if (prefix && len - prefix.length === 3) {
                    for (let c1 of pool) for (let c2 of pool) for (let c3 of pool) {
                        let g = prefix + c1 + c2 + c3;
                        if ((await ns.dnet.authenticate(hostname, g)).success) return { success: true, password: g };
                    }
                }
            }
            let fall = "A".repeat(len + 8);
            return { success: (await ns.dnet.authenticate(hostname, fall)).success, password: fall };
        }

        case "OpenWebAccessPoint": {
            let len = details.passwordLength || 4;
            for (let seed of ["admin", "password", "guest", "123456789", "0".repeat(len)]) {
                let gs = seed.slice(0, len);
                if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
                let log = await getLogEntry(gs);
                let raw = log?.match(/"data"\s*:\s*"([^"]+)"/)?.[1];
                if (raw) {
                    let match = raw.match(new RegExp(`${hostname}:([a-zA-Z0-9]{${len}})`));
                    if (match && (await ns.dnet.authenticate(hostname, match[1])).success) return { success: true, password: match[1] };
                    for (let i = 0; i <= raw.length - len; i++) {
                        let sub = raw.substr(i, len);
                        if ((await ns.dnet.authenticate(hostname, sub)).success) return { success: true, password: sub };
                    }
                }
            }
            return { success: false };
        }

        case "OctantVoxel": {
            let base = 0, num = "";
            if (details.data?.includes(',')) { [base, num] = details.data.split(',').map(s => s.trim()); }
            else { let m = details.passwordHint?.match(/base\s+(\d+)\s+number\s+([a-fA-F0-9.]+)/i); if (m) { base = m[1]; num = m[2]; } }
            if (base && num) {
                const bVal = parseFloat(base), parts = num.split('.'), int = parts[0], frac = parts[1] || "";
                let sum = 0;
                for (let i = 0; i < int.length; i++) sum += parseInt(int[int.length - 1 - i], 36) * Math.pow(bVal, i);
                for (let i = 0; i < frac.length; i++) sum += parseInt(frac[i], 36) * Math.pow(bVal, -(i + 1));
                let pw = Math.round(sum).toString();
                if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
            }
            return { success: false };
        }

        case "DeepGreen": {
            let len = details.passwordLength || 3;
            const pool = details.passwordFormat === "numeric" ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const clues = [];
            const check = (cand) => clues.every(clue => {
                let e = 0, w = 0, cArr = cand.split(""), gArr = clue.gs.split("");
                for (let j = 0; j < len; j++) if (cArr[j] === gArr[j]) { e++; cArr[j] = null; gArr[j] = null; }
                for (let j = 0; j < len; j++) if (gArr[j] !== null && cArr.includes(gArr[j])) { w++; cArr[cArr.indexOf(gArr[j])] = null; }
                return e === clue.e && w === clue.w;
            });
            const find = async (pre) => {
                if (pre.length === len) return check(pre) ? pre : null;
                for (let i = 0; i < pool.length; i++) { let res = await find(pre + pool[i]); if (res) return res; }
                return null;
            };
            let gs = pool[0].repeat(len);
            for (let r = 0; r < 120; r++) {
                if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
                let log = await getLogEntry(gs);
                let d = log?.replace(/\\/g, "").match(/"data"\s*:\s*"(\d+),(\d+)"/);
                if (d) clues.push({ gs, e: parseInt(d[1]), w: parseInt(d[2]) });
                gs = await find(""); if (!gs) break;
            }
            return { success: false };
        }

        case "PHP 5.4": {
            let digits = (details.data || details.passwordHint || "").replace(/[^0-9]/g, "");
            if (digits) {
                const perm = (s) => {
                    if (s.length <= 1) return [s];
                    let out = [];
                    for (let i = 0; i < s.length; i++) for (let sub of perm(s.slice(0, i) + s.slice(i + 1))) out.push(s[i] + sub);
                    return Array.from(new Set(out));
                };
                for (let p of perm(digits)) if ((await ns.dnet.authenticate(hostname, p)).success) return { success: true, password: p };
            }
            return { success: false };
        }

        case "OrdoXenos": {
            let d = details.data || "";
            if (d.includes(";")) {
                let p = d.split(";"), ct = p[0], mp = p[1].split(" ").map(b => parseInt(b, 2));
                let dec = ""; for (let i = 0; i < ct.length; i++) dec += String.fromCharCode(ct.charCodeAt(i) ^ mp[i]);
                if ((await ns.dnet.authenticate(hostname, dec)).success) return { success: true, password: dec };
            }
            let hint = details.passwordHint.match(/"([^"]+)"/);
            if (hint) {
                let enc = hint[1];
                for (let k = 1; k < 256; k++) {
                    let dec = ""; for (let i = 0; i < enc.length; i++) dec += String.fromCharCode(enc.charCodeAt(i) ^ k);
                    if ((await ns.dnet.authenticate(hostname, dec)).success) return { success: true, password: dec };
                }
            }
            return { success: false };
        }

        case "PrimeTime 2": {
            let m = details.passwordHint.match(/\d+/);
            if (m) {
                let n = parseInt(m[0]), div = 2;
                while (div * div <= n) { if (n % div === 0) n /= div; else div++; }
                let pw = n.toString();
                if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
            }
            return { success: false };
        }

        case "110100100": {
            let src = details.data || (await getLogEntry(" "))?.match(/"data"\s*:\s*"([^"]+)"/)?.[1];
            if (src && src.includes(" ")) {
                let dec = src.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
                if ((await ns.dnet.authenticate(hostname, dec)).success) return { success: true, password: dec };
            }
            return { success: false };
        }

        case "EuroZone Free": {
            const eu = ["albania", "andorra", "austria", "belarus", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "moldova", "monaco", "montenegro", "netherlands", "norway", "poland", "portugal", "romania", "russia", "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "ukraine", "united kingdom", "vatican city"];
            let len = details.passwordLength || 5;
            for (let c of eu.filter(x => x.length === len)) {
                let g1 = c.charAt(0).toUpperCase() + c.slice(1), g2 = c.toUpperCase();
                if ((await ns.dnet.authenticate(hostname, c)).success) return { success: true, password: c };
                if ((await ns.dnet.authenticate(hostname, g1)).success) return { success: true, password: g1 };
                if ((await ns.dnet.authenticate(hostname, g2)).success) return { success: true, password: g2 };
            }
            return { success: false };
        }

        case "BigMo%od": {
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
            let mods = [], rems = [];
            for (let p of primes) {
                let ps = p.toString();
                await ns.dnet.authenticate(hostname, ps);
                let log = await getLogEntry(ps);
                let rem = log?.match(/"data"\s*:\s*"(\d+)"/)?.[1] || log?.match(/data:\s*(\d+)/)?.[1];
                if (rem !== undefined) { mods.push(BigInt(p)); rems.push(BigInt(rem)); }
            }
            if (mods.length > 0) {
                let N = mods.reduce((a, b) => a * b, 1n), res = 0n;
                for (let i = 0; i < mods.length; i++) {
                    let ni = mods[i], ri = rems[i], Ni = N / ni, inv = 0n;
                    for (let j = 1n; j < ni; j++) if ((Ni * j) % ni === 1n) { inv = j; break; }
                    res += ri * Ni * inv;
                }
                let pw = (res % N).toString();
                if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
            }
            return { success: false };
        }

        case "2G_cellular": {
            let len = details.passwordLength || 6;
            const pool = details.passwordFormat === "numeric" ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let cur = Array(len).fill(pool[0]);
            for (let p = 0; p < len; p++) {
                for (let c of pool) {
                    cur[p] = c; let gs = cur.join('');
                    if ((await ns.dnet.authenticate(hostname, gs)).success) return { success: true, password: gs };
                    let log = await getLogEntry(gs);
                    let mismatch = log?.match(/character \((\d+)\)/i)?.[1];
                    if (mismatch !== undefined && parseInt(mismatch) > p) break;
                }
            }
            return { success: (await ns.dnet.authenticate(hostname, cur.join(''))).success, password: cur.join('') };
        }

        case "MathML": {
            if (details.data) {
                try {
                    let expr = String(details.data).split(',')[0].replace(/\u04b3/g, '*').replace(/\u2795/g, '+').replace(/\u2796/g, '-').replace(/\u00f7/g, '/');
                    if (/^[0-9+\-*/().\s]+$/.test(expr)) {
                        let res = Function(`return (${expr})`)();
                        let pw = Math.round(res).toString();
                        if ((await ns.dnet.authenticate(hostname, pw)).success) return { success: true, password: pw };
                    }
                } catch {}
            }
            return { success: false };
        }

        case "TopPass": {
            let len = details.passwordLength || 6;
            const dict = { 3: ["123", "abc", "cat"], 4: ["1234", "pass", "root"], 5: ["admin", "hello", "ninja"], 6: ["qwerty", "secret", "master"], 7: ["welcome", "network", "freedom"], 8: ["password", "internet", "absolute"] };
            let candidates = new Set(dict[len] || []);
            for (let c of candidates) {
                if ((await ns.dnet.authenticate(hostname, c)).success) return { success: true, password: c };
                let up = c.charAt(0).toUpperCase() + c.slice(1);
                if ((await ns.dnet.authenticate(hostname, up)).success) return { success: true, password: up };
            }
            return { success: false };
        }

        default: return { success: false };
    }
}

function acquireNetworkLock(ns, hostname, modelId) {
    let hash = 0; for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lp = 10 + Math.abs(hash % 4);
    let data = ns.readPort(lp);
    let locks = JSON.parse((data && data !== "NULL DATA") ? data : "[]"), now = Date.now(), isL = false, val = [];
    for (let l of locks) { if (l.host === hostname && now - l.acquiredAt < 300000) isL = true; if (now - l.acquiredAt < 300000) val.push(l); }
    if (isL) { ns.writePort(lp, JSON.stringify(val)); localCooldowns.set(hostname, now + 1000); return false; }
    val.push({ host: hostname, model: modelId, acquiredAt: now }); ns.writePort(lp, JSON.stringify(val)); return true;
}

function releaseNetworkLock(ns, hostname) {
    let hash = 0; for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const lp = 10 + Math.abs(hash % 4);
    let data = ns.readPort(lp);
    let locks = JSON.parse((data && data !== "NULL DATA") ? data : "[]").filter(l => l.host !== hostname);
    ns.writePort(lp, JSON.stringify(locks)); localCooldowns.set(hostname, Date.now() + 500);
}

export function autocomplete(data) { return ["--tail"]; }
