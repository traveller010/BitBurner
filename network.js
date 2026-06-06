/** * Scans the entire global network and returns an array of target hostnames.
 * Automatically excludes player servers, hacknet nodes, and home.
 * @param {NS} ns 
 * @returns {string[]} Array of discovered server names
 */
export function getNetworkTargets(ns) {
    let servers = ["home"];
    let targets = [];

    for (let i = 0; i < servers.length; i++) {
        let neighbours = ns.scan(servers[i]);
        for (let neighbour of neighbours) {
            if (!servers.includes(neighbour)) {
                servers.push(neighbour);
                
                // Keep your original filters
                if (!neighbour.startsWith("hacknet") && !neighbour.startsWith("pserv")) {
                    targets.push(neighbour);
                }
            }
        }
    }
    return targets;
}