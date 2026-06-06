var homeServer = "home";

/** * Centralized memory scanner (BFS layout)
 * @param {NS} ns 
 * @returns {string[]} All discovered public server hostnames
 */
export function getNetworkNodes(ns) {
    let servers = ["home"];
    for (let i = 0; i < servers.length; i++) {
        let neighbours = ns.scan(servers[i]);
        for (let neighbour of neighbours) {
            if (!servers.includes(neighbour) && !neighbour.startsWith("hacknet")) {
                servers.push(neighbour);
            }
        }
    }
    return servers;
}

/** @param {NS} ns **/
export function penetrate(ns, server, cracks) {
    for (var file of Object.keys(cracks)) {
        if (ns.fileExists(file, homeServer)) {
            var runScript = cracks[file];
            runScript(server);
        }
    }
}

/** @param {NS} ns **/
function getNumCracks(ns, cracks) {
    return Object.keys(cracks).filter(file => ns.fileExists(file, homeServer)).length;
}

/** @param {NS} ns **/
export function canPenetrate(ns, server, cracks) {
    var numCracks = getNumCracks(ns, cracks);
    var reqPorts = ns.getServerNumPortsRequired(server);
    return numCracks >= reqPorts;
}

/** @param {NS} ns **/
export function hasRam(ns, server, scriptRam, useMax = false) {
    var maxRam = ns.getServerMaxRam(server);
    var usedRam = ns.getServerUsedRam(server);
    var ramAvail = useMax ? maxRam : maxRam - usedRam;
    return ramAvail > scriptRam;
}

/** @param {NS} ns **/
export function canHack(ns, server) {
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server);
}

/** @param {NS} ns **/
export function getRootAccess(ns, server, cracks) {
    var requiredPorts = ns.getServerNumPortsRequired(server);
    if (requiredPorts > 0) {
        penetrate(ns, server, cracks);
    }
    ns.nuke(server);
}

/** * Calculates standard operational security and cash thresholds for fleet attacks
 * @param {NS} ns 
 * @param {string} node
 * @returns {{moneyThresh: number, secThresh: number}}
 */
export function getThresholds(ns, node) {
    var moneyThresh = ns.getServerMaxMoney(node) * 0.75;
    var secThresh = ns.getServerMinSecurityLevel(node) + 5;
    return { moneyThresh, secThresh };
}