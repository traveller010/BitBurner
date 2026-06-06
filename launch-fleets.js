import { getPotentialTargets, getStrategy } from "./find-targets.js";
import {
    getNetworkNodes,
    canPenetrate,
    getRootAccess,
    hasRam,
    getThresholds
} from "./utils.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    const priority = ns.args[0];
    var player = ns.getPlayer();
    var homeServ = ns.getHostname();
    var attackDelay = 50; // time (ms) between attacks

    // OPTIMIZATION: Dynamically resolve individual specialized low-RAM virus files
    const getVirusFromAction = (action) => `${action}-pirate.js`;
    var virusRam = ns.getScriptRam("hack-pirate.js"); // 1.75 GB benchmark

    var actions = {
        w: 'weaken',
        h: 'hack',
        g: 'grow'
    };

    var cracks = {
        "BruteSSH.exe": ns.brutessh,
        "FTPCrack.exe": ns.ftpcrack,
        "relaySMTP.exe": ns.relaysmtp,
        "HTTPWorm.exe": ns.httpworm,
        "SQLInject.exe": ns.sqlinject
    };

    // Returns potentially controllable servers mapped to RAM available
    async function getShips() {
        var nodes = getNetworkNodes(ns);
        var servers = nodes.filter(node => {
            if (node === homeServ || node.startsWith("hacknet")) {
                return false;
            }
            return canPenetrate(ns, node, cracks) && hasRam(ns, node, virusRam);
        });

        // Prepare the servers to have root access and scripts
        for (var serv of servers) {
            if (!ns.hasRootAccess(serv)) {
                getRootAccess(ns, serv, cracks);
            }
            // Copies all 3 specialized files simultaneously
            ns.scp(["hack-pirate.js", "grow-pirate.js", "weaken-pirate.js"], serv, "home");
        }

        // Add purchased server
        var i = 0;
        var servPrefix = "pserv-";
        while(ns.serverExists(servPrefix + i)) {
            servers.push(servPrefix + i);
            ++i;
        }

        return servers.reduce((acc, node) => {
            var maxRam = ns.getServerMaxRam(node);
            var curRam = ns.getServerUsedRam(node);
            acc[node] = maxRam - curRam;
            return acc;
        }, {});
    }

    function getDelayForActionSeq(seq, node) {
        var server = ns.getServer(node);
        var wTime = ns.formulas.hacking.weakenTime(server, player);
        var gTime = ns.formulas.hacking.growTime(server, player);
        var hTime = ns.formulas.hacking.hackTime(server, player);
        var timing = {
            w: wTime,
            g: gTime,
            h: hTime
        };
        const baseTimes = seq.map((_, i) => i + (attackDelay * i));
        const actionStart = seq.map((action, i) => {
            const execTime = timing[action];
            return baseTimes[i] - execTime;
        });
        const execStart = Math.min(...actionStart);
        const delays = seq.map((action, i) => {
            return Math.abs(execStart - actionStart[i]);
        });
        return delays;
    }

    function getMaxThreads(node) {
        var { moneyThresh, secThresh } = getThresholds(ns, node);
        var curMoney = ns.getServerMoneyAvailable(node);
        
        var growThreads = 0;
        if (curMoney < 1) {
            growThreads = 1;
        } else {
            var growMul = moneyThresh / curMoney;
            if (growMul >= 1) {
                growThreads = Math.round(ns.growthAnalyze(node, growMul));
            }
        }
        
        const weakenEffect = ns.weakenAnalyze(1);
        const secToDecrease = Math.abs(ns.getServerSecurityLevel(node) - secThresh);
        const weakenThreads = weakenEffect > 0 ? Math.round(secToDecrease / weakenEffect) : 0;
        
        var hackEffect = ns.hackAnalyze(node);
        var hackTaken = hackEffect * curMoney;
        var hackThreads = hackEffect > 0 ? Math.round(moneyThresh / hackTaken) : 0;

        if (hackThreads === Infinity || isNaN(hackThreads)) hackThreads = 0;
        if (weakenThreads === Infinity || isNaN(weakenThreads)) weakenThreads = 0;
        if (growThreads === Infinity || isNaN(growThreads)) growThreads = 1;

        return {
            grow: growThreads,
            weaken: weakenThreads,
            hack: hackThreads,
            total: growThreads + weakenThreads + hackThreads
        };
    }

    function getRequirements(node) {
        var strategy = getStrategy(ns, node);
        var delays = getDelayForActionSeq(strategy.seq, node);
        var maxThreads = getMaxThreads(node);
        return {
            delays,
            maxThreads,
            strategy
        };
    }

    function getTotalThreads(servers) {
        return Object.values(servers).reduce((sum, nodeRam) => {
            var threads = Math.floor(nodeRam / virusRam);
            sum += threads;
            return sum;
        }, 0);
    }

    function getAllocation(reqs, ships) {
        var totalThreads = getTotalThreads(ships);
        var { maxThreads, strategy } = reqs;
        var numWeaken = 0;
        var numGrow = 0;
        var numHack = 0;
        if (maxThreads.total < totalThreads) {
            numWeaken = maxThreads.weaken;
            numGrow = maxThreads.grow;
            numHack = maxThreads.hack;
        } else {
            var { seq, allocation } = strategy;
            for (var i = 0; i < seq.length; i++) {
                var action = seq[i];
                var portion = allocation[i];
                if (action === 'w') {
                    numWeaken = Math.floor(totalThreads * portion);
                } else if (action === 'g') {
                    numGrow = Math.floor(totalThreads * portion);
                } else {
                    numHack = Math.floor(totalThreads * portion);
                }
            }
        }
        return { numWeaken, numGrow, numHack };
    }

    function readyFleets(reqs, contract, ships) {
        var { strategy, delays } = reqs;
        var { seq } = strategy;
        var sortedShips = Object.keys(ships).sort((a, b) => ships[b] - ships[a]);
        var assigned = {};
        var fleets = [];
        for (var i = 0; i < seq.length; i++) {
            var delay = delays[i];
            var sym = seq[i]; 
            var action = actions[sym];
            var maxThreads = contract[sym];
            var fleet = {
                action,
                ships: []
            }
            var usedThreads = 0;
            for (var serv of sortedShips) {
                if (usedThreads >= maxThreads) break;
                if (assigned[serv]) continue; 

                var ram = ships[serv];
                var maxExecThreads = Math.floor(ram / virusRam);
                if (maxExecThreads <= 0) continue;

                var newUsedThreads = usedThreads + maxExecThreads;
                var threads = maxExecThreads;
                if (newUsedThreads > maxThreads) {
                    threads = maxThreads - usedThreads; 
                }
                usedThreads += threads;
                assigned[serv] = {
                    used: threads,
                    left: maxExecThreads - threads
                };

                fleet.ships.push({
                    serv,
                    threads,
                    delay
                });
            }
            fleets.push(fleet);
        }
        return { fleets, assigned };
    }

    function createFleets(reqs, ships) {
        var { numWeaken, numGrow, numHack } = getAllocation(reqs, ships);
        var contract = {
            w: numWeaken,
            g: numGrow,
            h: numHack
        };
        return readyFleets(reqs, contract, ships);
    }

    function logShipAction(ship, action, target) {
        let variant = "INFO";
        let icon = "💵";
        if (action === "weaken") {
            variant = "ERROR";
            icon = "☠️";
        } else if (action === "grow") {
            variant = "SUCCESS";
            icon = "🌱";
        }
        ns.print(`${variant}\t ${icon} ${action} @ ${ship.serv} (${ship.threads}) -> ${target}`);
    }

    var tick = 1000;

    while (true) {
        var ships = await getShips();
        var availShips = Object.keys(ships).length;
        if (availShips === 0) {
            await ns.sleep(tick);
            continue;
        }
        var targets = getPotentialTargets(ns, priority);
        for (var target of targets) {
            var targetNode = target.node;
            var reqs = getRequirements(targetNode);
            var { fleets, assigned } = createFleets(reqs, ships);
            
            // SET SAIL!
            for (var fleet of fleets) {
                var action = fleet.action;
                var virus = getVirusFromAction(action); // Selects low-RAM script dynamically
                
                for (var ship of fleet.ships) {
                    if (ship.threads < 1) continue;
                    
                    // SAFE EXECUTION PROTOCOL: Protects against infinite loop crash
                    var pid = Date.now() + Math.floor(Math.random() * 100000); 
                    let freeRamCheck = ns.getServerMaxRam(ship.serv) - ns.getServerUsedRam(ship.serv);
                    
                    if (freeRamCheck >= (virusRam * ship.threads)) {
                        ns.exec(virus, ship.serv, ship.threads, targetNode, ship.delay, pid);
                        logShipAction(ship, action, targetNode);
                    }
                }
            }
            
            for (var ship of Object.keys(assigned)) {
                var usage = assigned[ship];
                if (usage.left <= 1) { 
                    delete ships[ship];
                } else {
                    ships[ship] = usage.left;
                }
            }
            if (Object.keys(ships).length <= 0) break;
        }
        await ns.sleep(tick);
    }
}

