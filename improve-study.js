/** @param {NS} ns */
export async function main(ns) {
    
    let cost = ns.hacknet.hashCost('Improve Studying')
    while (true) {
        if (ns.hacknet.numHashes() > cost) {
            cost = ns.hacknet.spendHashes('Improve Studying');
        }
        if (cost > ns.hacknet.hashCapacity()) {
            ns.exit();
        }
        await ns.sleep(50)
    }
}

