import { getNetworkNodes, canPenetrate, hasRam, getRootAccess } from "./utils.js";

/** @param {NS} ns **/
export async function main(ns) {
    var target = ns.args[0];
    if (!target) {
        ns.tprint("❌ ERROR: No target argument received from Captain script.");
        return;
    }

    var cracks = {
        "BruteSSH.exe": ns.brutessh,
        "FTPCrack.exe": ns.ftpcrack,
        "relaySMTP.exe": ns.relaysmtp,
        "HTTPWorm.exe": ns.httpworm,
        "SQLInject.exe": ns.sqlinject
    };

    var virus = "gimme-money.js";
    var virusRam = ns.getScriptRam(virus);

    async function copyAndRunVirus(server) {
        await ns.scp(virus, server, "home");
        
        // Dynamic Process Inspection: Check if it's already running our current target assignment
        let activeProcesses = ns.ps(server);
        let alreadyMatched = activeProcesses.some(p => p.filename === virus && p.args[0] === target);

        if (alreadyMatched) {
            // Keep running! Do not reset execution progress.
            return; 
        }

        // Only wipe and update if the target changed or if it's a fresh server configuration
        ns.killall(server);
        var maxThreads = Math.floor(ns.getServerMaxRam(server) / virusRam);
        if (maxThreads > 0) {
            ns.exec(virus, server, maxThreads, target);
        }
    }

    function getTargetServers() {
        var networkNodes = getNetworkNodes(ns);
        var hackableNodes = networkNodes.filter(node => {
            if (node === "home" || node.startsWith("hacknet") || node.startsWith("pserv")) {
                return false;
            }
            return canPenetrate(ns, node, cracks);
        });

        // Ensure Root Access Permissions
        for (const node of hackableNodes) {
            if (!ns.hasRootAccess(node)) {
                getRootAccess(ns, node, cracks);
            }
        }

        // Filter valid computation nodes
        var targets = hackableNodes.filter(node => hasRam(ns, node, virusRam, true));

        // Dynamically track and attach purchased infrastructure
        var i = 0;
        var servPrefix = "pserv-";
        while(ns.serverExists(servPrefix + i)) {
            targets.push(servPrefix + i);
            ++i;
        }

        return targets;
    }

    var waitTime = 5000; // 5s scan loops

    while (true) {
        var hostingNodes = getTargetServers();
        
        // Deploy to servers safely using process verification
        for (var serv of hostingNodes) {
            await copyAndRunVirus(serv);
        }
        
        await ns.sleep(waitTime);
    }
}