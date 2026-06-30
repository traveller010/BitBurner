/** @param {NS} ns **/
export async function main(ns) {
    
}
// if (!ns.fileExists("anchor-lock.txt", currentHost)) {
//     const freeRam = ns.getServerMaxRam(currentHost) - ns.getServerUsedRam(currentHost);

//     // Only compile and execute the worker if the node can support the 12GB runtime cost
//     if (freeRam >= 12) {
//         ns.write("stasis-worker.js", 'export async function main(ns) { ns.dnet.setStasisLink(); }', "w");
//         ns.exec("stasis-worker.js", currentHost);
//         ns.write("anchor-lock.txt", "locked", "w"); // drop local flag marker
//         logSuccess(`Dynamically deployed stasis worker on ${currentHost}`);
//     } else {
//         logDiag(`Insufficient RAM on ${currentHost} to execute background stasis anchor.`);
//     }
// }

/** @param {ActiveFragment} ns **/
export async function test(ns) {
    ns
}