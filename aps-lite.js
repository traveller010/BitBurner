/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    const homeServ = "home";
    const servPrefix = "pserv-";

    const maxRam = ns.cloud.getRamLimit();
    const maxServers = ns.cloud.getServerLimit();

    // SMART CONFIGURATION: Find the smallest server you currently own 
    // to jump straight to your current infrastructure tier on startup.
    let pRam = maxRam;
    let ownedServers = ns.cloud.getServerNames();
    
    if (ownedServers.length < maxServers) {
        pRam = 8; // Start at baseline if we haven't hit the server cap yet
    } else {
        // If we own a full set, find the weakest link to start upgrading from
        for (let name of ownedServers) {
            let ram = ns.getServerMaxRam(name);
            if (ram < pRam) pRam = ram;
        }
        // Step up to the next target tier
        pRam = Math.min(pRam * 2, maxRam);
    }

    /** Helper function to dynamically check accurate upgrade or purchase costs */
    function getTargetCost(serverName, targetRam) {
        if (ns.serverExists(serverName)) {
            return ns.cloud.getServerUpgradeCost(serverName, targetRam);
        }
        return ns.cloud.getServerCost(targetRam);
    }

    /** Snappy cash verification system */
    async function waitForFunding(serverName, targetRam) {
        let cost = getTargetCost(serverName, targetRam);
        while (ns.getServerMoneyAvailable(homeServ) < cost) {
            await ns.sleep(2000); // Check cash reserves every 2 seconds for high responsiveness
            cost = getTargetCost(serverName, targetRam); // Recalculate in case of market shifts
        }
    }

    async function processServer(serverName, targetRam) {
        if (ns.serverExists(serverName)) {
            let currentRam = ns.getServerMaxRam(serverName);
            if (currentRam < targetRam) {
                await waitForFunding(serverName, targetRam);
                
                // OPTIMIZATION: Seamless, inline native v3 upgrade. 
                // No deleting, no file loss, no thread wiping!
                if (ns.cloud.upgradeServer(serverName, targetRam)) {
                    ns.print(`📈 UPGRADED: ${serverName} scaled to ${ns.format.ram(targetRam)}`);
                }
            }
        } else {
            // Server doesn't exist yet, buy a brand new block
            await waitForFunding(serverName, targetRam);
            if (ns.cloud.purchaseServer(serverName, targetRam)) {
                ns.print(`💰 PURCHASED: ${serverName} online at ${ns.format.ram(targetRam)}`);
            }
        }
    }

    // MAIN INFRASTRUCTURE LOOP
    while (true) {
        ns.print(`🔄 Sweeping network infrastructure for ${ns.format.ram(pRam)} upgrades...`);
        
        for (let i = 0; i < maxServers; i++) {
            let serverName = servPrefix + i;
            await processServer(serverName, pRam);
        }

        if (pRam === maxRam) {
            ns.tprint("🏆 MAX INFRASTRUCTURE MILESTONE: All servers scaled to absolute limit!");
            break;
        }

        // Increment to next binary RAM bracket
        pRam = Math.min(pRam * 2, maxRam);
    }
}

