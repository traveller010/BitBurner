/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const currentHost = ns.getHostname();
    const workerScript = "local-worker.js";
    const workerRam = 1.75;

    // 🎯 NEW: THE AT-EXIT CLEANUP HOOK
    // Automatically intercepts script termination to clear out child threads instantly
    ns.atExit(() => {
        ns.tprint(`🛑 [CLEANUP] Master script killed. Terminating all local workers...`);
        ns.scriptKill(workerScript, currentHost);
    });

    // SELF-COMPILATION ENGINE: Writes the private micro-worker locally
    const workerCode = `
    /** @param {NS} ns */
    export async function main(ns) {
        const [action, target, pid] = ns.args;
        if (action === "h") await ns.hack(target);
        else if (action === "g") await ns.grow(target);
        else if (action === "w") await ns.weaken(target);
    }`;
    ns.write(workerScript, workerCode, "w");

    let response = await ns.prompt("Target servers with maxMoney > $500,000,000 ?");

    ns.tprint(response)

    while (true) {
        // Pull fresh, real-time server state snapshots on every single tick
        let servers = discoverServers(ns);

        let availableTargets = servers.filter((target) => {
            if (response) {
                ns.tprint("Targeting servers with max Money > $500,000,000")
            return target.backdoorInstalled && target.moneyMax > 500000000;
            }
            return target.backdoorInstalled;
        });

        let totalMoneyMax = availableTargets.reduce((sum, target) => sum + target.moneyMax, 0);

        // 🛡️ 20% RAM RESERVATION GUARDIAN
        let totalMaxRam = ns.getServerMaxRam(currentHost);
        let maxAllowedRam = totalMaxRam * 0.80; 
        let currentUsedRam = ns.getServerUsedRam(currentHost);
        
        let usableFreeRam = Math.max(0, maxAllowedRam - currentUsedRam);
        let poolThreads = Math.floor(usableFreeRam / workerRam);

        if (poolThreads > 0 && totalMoneyMax > 0) {
            let rankedTargets = availableTargets.sort((a, b) => b.moneyMax - a.moneyMax);

            for (let target of rankedTargets) {
                let weight = target.moneyMax / totalMoneyMax;
                let targetThreads = Math.floor(poolThreads * weight);

                if (targetThreads < 1) continue;

                let curSec = ns.getServerSecurityLevel(target.hostname);
                let minSec = ns.getServerMinSecurityLevel(target.hostname);
                let curMoney = ns.getServerMoneyAvailable(target.hostname);
                let moneyThresh = target.moneyMax * 0.75;

                let action = "h";
                if (curSec > minSec + 5) {
                    action = "w";
                } else if (curMoney < moneyThresh) {
                    action = "g";
                }

                let pseudoPid = Math.floor(Math.random() * 1000000);
                ns.exec(workerScript, currentHost, targetThreads, action, target.hostname, pseudoPid);
            }
        }

        await ns.sleep(6000);
    }
}

/** @param {NS} ns */
function discoverServers(ns) {
    var allServers = ["home"];
    var NSServers = [];

    for (let target of allServers) {
        let neighbours = ns.scan(target);
        for (let neighbour of neighbours) {
            if (!allServers.includes(neighbour)) {
                let NSServer = ns.getServer(neighbour);
                if (!NSServer.purchasedByPlayer) {
                    allServers.push(neighbour);
                    NSServers.push(NSServer);
                }
            }
        }
    }
    return NSServers;
}