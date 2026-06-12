/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const currentHost = ns.getHostname();

    while (true) {
        // Memory Reallocation
        try {
            let details = ns.dnet.getServerDetails(currentHost);
            let safety = 0;
            while (details.ramBlocked > 0 && safety < 10) {
                await ns.dnet.memoryReallocation();
                details = ns.dnet.getServerDetails(currentHost);
                safety++;
                await ns.sleep(100);
            }
        } catch {}

        // Cache Looting
        const cacheFiles = ns.ls(currentHost, '.cache');
        for (const cacheFile of cacheFiles) {
            try {
                const result = await ns.dnet.openCache(cacheFile);
                ns.tryWritePort(15, `[LOOT] [${currentHost}] Opened ${cacheFile}! Contents: ${JSON.stringify(result)}`);
            } catch {}
        }

        // Phishing
        try { await ns.dnet.phishingAttack(); } catch {}

        // Stock Promotion
        let whaleTarget = ns.peek(16);
        if (whaleTarget && whaleTarget !== "NULL DATA" && whaleTarget !== "NULL PORT DATA") {
            try { await ns.dnet.promoteStock(whaleTarget); } catch {}
        }

        await ns.sleep(5000);
    }
}
