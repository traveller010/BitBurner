import { getNetworkNodes, canHack, canPenetrate } from "./utils.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // Configuration Fields
    const autoDeployScript = "auto-deploy.js";
    const autoPurchaseServerScript = "auto-purchase-server.js";
    const apsLiteScript = "aps-lite.js";
    const launchFleetsScript = "launch-fleets.js";
    const homeServ = "home";
    const tick = 10000; // 10-second evaluation loop
    let curTarget = "n00dles";

    // Independent Background Systems to maintain from Day One
    const coreEngines = [
        "exploit-and-backdoor.js",
        "se.js",
        "dnet-logger.js",
        "dnet-worm.js",
        "contract-solver.js",
        // "ap-hacknet-node.js"
        "hn.js",

        ];

    var cracks = {
        "BruteSSH.exe": ns.brutessh,
        "FTPCrack.exe": ns.ftpcrack,
        "relaySMTP.exe": ns.relaysmtp,
        "HTTPWorm.exe": ns.httpworm,
        "SQLInject.exe": ns.sqlinject
    };

    /** Wakes up your stock portfolio bot and market manipulation engine */
    function initializeCoreEngines() {
        for (const script of coreEngines) {
            if (ns.fileExists(script, homeServ)) {
                if (!ns.scriptRunning(script, homeServ)) {
                    ns.run(script, 1);
                    ns.tprint(`🚀 [SYSTEM] Initialized background module: ${script}`);
                }
            } else {
                ns.tprint(`❌ [WARNING] Core background file missing: ${script}`);
            }
        }
    }

    /** Helper to safely terminate early-game infrastructure */
    function shutdownEarlyGame() {
        if (ns.scriptRunning(autoDeployScript, homeServ)) ns.scriptKill(autoDeployScript, homeServ);
        if (ns.scriptRunning(autoPurchaseServerScript, homeServ)) ns.scriptKill(autoPurchaseServerScript, homeServ);
    }

    /** Transitions the network directly into high-yield late-game fleet mode */
    function launchFleetsAndExit() {
        ns.tprint(`WARN 🎓 Formulas.exe detected! Swapping architecture to Launch Fleets...`);
        shutdownEarlyGame();

        // Boot advanced synchronized fleet managers
        ns.exec(launchFleetsScript, homeServ);
        ns.exec(apsLiteScript, homeServ);

        ns.tprint("✅ [SUCCESS] Master pipeline active. Starter engine closing cleanly.");
        ns.exit();
    }

    /** Local targeting engine: replaces strategist.js port requests entirely */
    function getBestEarlyGameTarget() {
        let nodes = getNetworkNodes(ns);
        let bestTarget = "n00dles";
        let maxCashFound = 0;

        for (let node of nodes) {
            if (node === "home" || node.startsWith("pserv")) continue;

            // Verify we can actually break into and hack this server right now
            if (canPenetrate(ns, node, cracks) && canHack(ns, node)) {
                let maxMoney = ns.getServerMaxMoney(node);
                if (maxMoney > maxCashFound) {
                    maxCashFound = maxMoney;
                    bestTarget = node;
                }
            }
        }
        return bestTarget;
    }

    async function updateTargetIfApplicable() {
        let newTarget = getBestEarlyGameTarget();

        if (newTarget !== curTarget) {
            ns.print(`WARN Swapping early game targets: ${curTarget} -> ${newTarget}`);
            shutdownEarlyGame();
            ns.exec(autoDeployScript, homeServ, 1, newTarget);
            ns.exec(autoPurchaseServerScript, homeServ, 1, newTarget);
            curTarget = newTarget;
        }
    }

    // Phase 1: Boot up background operations
    initializeCoreEngines();

    // Phase 2: Execution & Monitoring Loop
    while (true) {
        if (ns.fileExists("Formulas.exe", homeServ)) {
            launchFleetsAndExit();
        } else {
            // Keep basic infrastructure active if it drops offline unexpectedly
            if (!ns.scriptRunning(autoDeployScript, homeServ) && !ns.scriptRunning(launchFleetsScript, homeServ)) {
                ns.exec(autoDeployScript, homeServ, 1, curTarget);
            }
            if (!ns.scriptRunning(autoPurchaseServerScript, homeServ) && !ns.scriptRunning(apsLiteScript, homeServ)) {
                ns.exec(autoPurchaseServerScript, homeServ, 1, curTarget);
            }

            await updateTargetIfApplicable();
        }
        await ns.sleep(tick);
    }
}