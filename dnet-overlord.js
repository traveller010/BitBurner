/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const PORT_DIAG = 14;
    const WORM_VERSION = "v1.4.0";

    ns.tprint("👑 [OVERLORD] DarkNet Stewardship Active.");

    const loggerScript = "dnet-logger.js";
    if (ns.fileExists(loggerScript) && !ns.scriptRunning(loggerScript, "home")) {
        ns.tprint("👑 [OVERLORD] Starting logger...");
        ns.exec(loggerScript, "home");
        await ns.sleep(1000);
    }

    const masterWorm = "dnet-worm.js";
    if (ns.fileExists(masterWorm) && !ns.scriptRunning(masterWorm, "home")) {
        ns.tprint("👑 [OVERLORD] Launching master worm...");
        ns.exec(masterWorm, "home", 1, WORM_VERSION);
    }

    while (true) {
        // --- Automated Stasis Link Stewardship ---
        try {
            let vault = {};
            if (ns.fileExists("darknet-keys.txt")) {
                const data = ns.read("darknet-keys.txt");
                if (data) vault = JSON.parse(data);
            }

            const candidates = [];
            for (const host of Object.keys(vault)) {
                try {
                    const d = ns.dnet.getServerDetails(host);
                    if (d && d.isOnline) {
                        candidates.push({
                            host,
                            depth: d.depth || 0,
                            isLabyrinth: d.modelId === "(The Labyrinth)" || host === "ub3r_l4byr1nth"
                        });
                    }
                } catch {}
            }

            // Sort: Labyrinth first, then deepest
            candidates.sort((a, b) => (b.isLabyrinth - a.isLabyrinth) || (b.depth - a.depth));

            const top3 = candidates.slice(0, 3);
            for (const target of top3) {
                if (ns.dnet.setStasisLink) ns.dnet.setStasisLink(target.host);
            }
        } catch (e) { ns.tryWritePort(PORT_DIAG, `[OVERLORD-ERR] ${e}`); }

        await ns.sleep(10000);
    }
}
