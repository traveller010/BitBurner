const WORM_VERSION = "v1.6.2";
const WORM_COST = 13.80; // Adjusted to 15.70 to account for the worm's scp/exec footprint

/** @param {NS} ns */
export async function main(ns) {
    const requestedVersion = ns.args[0] || WORM_VERSION;
    const targetHost = ns.args[1] || ns.getHostname();
    const masterWorm = ns.args[2] || "dnet-worm.js";

    function logDiag(msg) { ns.tryWritePort(14, `[BOOTSTRAP] [${targetHost}] ${msg}`); }

    try {
        // 1. 🔄 SWARM UPGRADE: Version Guard scans all three variants for unified updates
        const allWormVariants = ["dnet-worm.js", "dnet-worm-dfs.js", "dnet-worm-tm.js"];
        const processes = ns.ps(targetHost);
        let killedAny = false;

        for (const wormFile of allWormVariants) {
            const existing = processes.find(p => p.filename === wormFile);
            if (existing) {
                const remoteVersion = (existing.args[0] || "v0.0.0").replace('v', '');
                const localVersion = requestedVersion.replace('v', '');
                
                const rParts = remoteVersion.split('.').map(Number);
                const lParts = localVersion.split('.').map(Number);
                
                let isNeeded = false;
                for(let i = 0; i < 3; i++) {
                    if (lParts[i] > rParts[i]) { isNeeded = true; break; }
                    if (lParts[i] < rParts[i]) break;
                }

                if (isNeeded) {
                    ns.kill(existing.pid);
                    killedAny = true;
                }
            }
        }
        // Brief pause if assets were terminated to ensure the engine registers the freed RAM
        if (killedAny) await ns.sleep(20);

        // =================================================================
        // 2 & 3. DYNAMIC CEILING RESOURCE MANAGEMENT & PURE REALLOCATION LOOP
        // =================================================================
        let deployed = false; // Tracks if the target hardware tier's RAM quota has been met
        let loopCount = 0;
        const maxRam = ns.getServerMaxRam(targetHost);

        // DYNAMIC CEILING: Mathematically determine the exact worm capacity of this node
        const maxWormsPossible = Math.min(3, Math.floor(maxRam / WORM_COST));
        const requiredFreeRam = maxWormsPossible * WORM_COST;

        while (true) {
            let details = ns.dnet.getServerDetails(targetHost);
            let freeRam = maxRam - ns.getServerUsedRam(targetHost);

            // Persistent Memory Reallocation Latch: Aggressively clear space if blocked
            if (details.ramBlocked > 0) {
                await ns.dnet.memoryReallocation(targetHost);
                // Refresh metrics following the reallocation call
                details = ns.dnet.getServerDetails(targetHost);
                freeRam = maxRam - ns.getServerUsedRam(targetHost);
            }

            // 🔄 SWARM UPGRADE: Target Allocation Check & Pure Port-Signaling Latch (Port 18)
            if (!deployed && freeRam >= requiredFreeRam) {
                let targetSwarm = [];
                if (maxWormsPossible === 1) {
                    targetSwarm = [masterWorm];
                } else if (maxWormsPossible === 2) {
                    targetSwarm = ["dnet-worm.js", "dnet-worm-dfs.js"];
                } else if (maxWormsPossible === 3) {
                    targetSwarm = ["dnet-worm.js", "dnet-worm-dfs.js", "dnet-worm-tm.js"];
                }

                const packet = {
                    sender: ns.getHostname(), // The parent server executing the bootstrapper
                    target: targetHost,       // The destination server being cleared
                    worms: targetSwarm
                };
                
                // Transmit the verified session payload to Port 18 (Bootstrap Completion)
                if (ns.tryWritePort(18, JSON.stringify(packet))) {
                    ns.tryWritePort(15, `[BOOTSTRAP] Signaled parent on Port 18 to deploy ${targetSwarm.length} worm(s) to ${targetHost}`);
                    deployed = true;
                }
            }

            // Lifecycle Progression Steps
            loopCount++;

            // 🔄 ADAPTIVE EXIT STRATEGY
            if (deployed) {
                // High-RAM Daemon Latch: Stay alive to scrub memory blocks completely clean if it's a 3-worm node
                if (maxWormsPossible === 3 && details.ramBlocked > 0) {
                    // Do nothing; bypass termination and let the loop spin to run memoryReallocation again
                } else {
                    // Low/Mid-RAM Bottleneck Exit: Target quota hit, exit immediately to free parent resources
                    logDiag(`Target allocation met (${maxWormsPossible} worm(s) space cleared). Execution loop complete.`);
                    break;
                }
            }

            // Infinite Stagnation Protection Failsafe
            if (!deployed && loopCount > 100) {
                // logDiag(`CRITICAL: Memory clearing stagnation detected on host. Aborting pipeline.`);
                break;
            }

            await ns.sleep(100);
        }

    } catch (e) { 
        logDiag(`Exception: ${e}`); 
    }
}