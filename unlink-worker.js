/** @param {NS} ns */
export async function main(ns) {
    const result = await ns.dnet.setStasisLink(false);
    ns.tprint(JSON.stringify(result))
}