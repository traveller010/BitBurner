const WORM_VERSION = "v1.4.1";
const WORM_COST = 13.80;

/** @param {NS} ns */
export async function main(ns) {
    const targetHost = ns.args[1] || ns.getHostname();
    const masterWorm = "dnet-worm.js";
    const version = ns.args[0] || WORM_VERSION;

    function logDiag(msg) {
        ns.tryWritePort(14, `[BOOTSTRAP] [${targetHost}] ${msg}`);
    }

    try {
        logDiag("Starting memory reallocation...");
        let details = ns.dnet.getServerDetails(targetHost);
        let retries = 0;
        while (details.ramBlocked > 0 && retries < 50) {
            await ns.dnet.memoryReallocation();
            details = ns.dnet.getServerDetails(targetHost);
            retries++;
            if (details.ramBlocked > 0) await ns.sleep(100);
        }

        const freeRam = ns.getServerMaxRam(targetHost) - ns.getServerUsedRam(targetHost);
        if (freeRam >= WORM_COST) {
            logDiag(`RAM cleared (${freeRam}GB). Launching ${masterWorm}...`);
            let pid = ns.exec(masterWorm, targetHost, { threads: 1, preventDuplicates: true }, version);
            if (pid === 0) {
                logDiag("Failed to exec worm (pid 0).");
            } else {
                ns.tryWritePort(15, `[BOOTSTRAP SUCCESS] started worm on ${targetHost}`);
                // Coordination port 18
                ns.tryWritePort(18, targetHost);
            }
        } else {
            logDiag(`Insufficient RAM: ${freeRam}GB free, need ${WORM_COST}GB.`);
        }
    } catch (e) {
        logDiag(`Exception: ${e}`);
    }
}
