/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("RAM cost of dnet-worm.js: " + ns.getScriptRam("dnet-worm.js") + " GB");
}
