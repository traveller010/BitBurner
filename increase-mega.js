/** @param {NS} ns */
export async function main(ns) {
    
    let cost = ns.hacknet.hashCost('Increase Maximum Money')
    while (true) {
        if (ns.hacknet.numHashes() > cost) {
            cost = ns.hacknet.spendHashes('Increase Maximum Money', 'megacorp',1);
        }
        if (cost > ns.hacknet.hashCapacity()) {
            ns.exit();
        }
        await ns.sleep(50)
    }
}

