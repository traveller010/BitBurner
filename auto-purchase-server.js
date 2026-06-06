/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    const homeServ = "home";
    const servPrefix = "pserv-";

    const maxRam = ns.cloud.getRamLimit();
    const maxServers = ns.cloud.getServerLimit();

    // SMART INITIALIZATION: Detect existing setups to bypass baseline loops
    let pRam = maxRam;
    let ownedServers = ns.cloud.getServerNames();
    
    if (ownedServers.length < maxServers) {
        pRam = 8; 
    } else {
        for (let name of ownedServers) {
            let ram = ns.getServerMaxRam(name);
            if (ram < pRam) pRam = ram;
        }
        pRam = Math.min(pRam * 2, maxRam);
    }

    function getTargetCost(serverName, targetRam) {
        if (ns.serverExists(serverName)) {
            return ns.cloud.getServerUpgradeCost(serverName, targetRam);
        }
        return ns.cloud.getServerCost(targetRam);
    }

    async function waitForFunding(serverName, targetRam) {
        let cost = getTargetCost(serverName, targetRam);
        while (ns.getServerMoneyAvailable(homeServ) < cost) {
            await ns.sleep(2000); // Poll financial accounts every 2s
            cost = getTargetCost(serverName, targetRam);
        }
    }

    async function processServer(serverName, targetRam) {
        if (ns.serverExists(serverName)) {
            let currentRam = ns.getServerMaxRam(serverName);
            if (currentRam < targetRam) {
                await waitForFunding(serverName, targetRam);
                
                // Native v3 Inline Upgrade: Wipes out the killall reset loops permanently
                if (ns.cloud.upgradeServer(serverName, targetRam)) {
                    ns.print(`📈 UPGRADED: ${serverName} expanded to ${ns.format.ram(targetRam)}`);
                }
            }
        } else {
            await waitForFunding(serverName, targetRam);
            if (ns.cloud.purchaseServer(serverName, targetRam)) {
                ns.print(`💰 PURCHASED: ${serverName} registered at ${ns.format.ram(targetRam)}`);
            }
        }
    }

    // INFRASTRUCTURE STEPPING LOOP
    while (true) {
        ns.print(`🔄 Checking fleet matrix for ${ns.format.ram(pRam)} infrastructure updates...`);
        
        for (let i = 0; i < maxServers; i++) {
            let serverName = servPrefix + i;
            await processServer(serverName, pRam);
        }

        if (pRam === maxRam) {
            ns.print("🏆 Fleet infrastructure scales maximized successfully.");
            break;
        }

        pRam = Math.min(pRam * 2, maxRam);
    }
}

