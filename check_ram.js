/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("RAM requirement for dnet-worm.js: " + ns.getScriptRam("dnet-worm.js") + "GB");
}
