/** @param {NS} ns */
export async function main(ns) {
    ns.tprint(ns.args)
    while (true) {
        if (ns.hacknet.numHashes() >
            4) {
            // ns.hacknet.hashCapacity() / 2)
            // ns.hacknet.hashCapacity() - 4) {
            ns.hacknet.spendHashes("Sell for Money")
        }
        await ns.sleep(50)
    }
}

