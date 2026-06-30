/** @param {NS} ns */
export async function main(ns) {
    const linkedServers = ns.dnet.getStasisLinkedServers();
    ns.tprint(`[CLEANUP] Found ${linkedServers.length} active stasis links. Beginning teardown...`);

    // const payload = `/** @param {NS} ns */ export async function main(ns) { const result = await ns.dnet.setStasisLink(false); ns.tprint(JSON.stringify(result))}`;
    // ns.write("unlink-worker.js", payload, "w");

    for (const host of linkedServers) {
        ns.tprint(`Linked server: ${host}`);
        try {
            // Forcefully terminate running scripts on the target to free up deployment RAM
            const killResult = ns.killall(host);
            ns.tprint(`killall success: ${killResult}`);
            await ns.sleep(50); // Short pause to allow the game engine to reclaim the memory pool

            const copySuccess = ns.scp("unlink-worker.js", host, "home");
            ns.tprint(`Copy Success: ${copySuccess}`)
            const pid = ns.exec("unlink-worker.js", host, 1);
            
            if (pid > 0) {
                while (ns.ps(host).some(p => p.pid === pid)) {
                    await ns.sleep(50);
                }
                ns.tprint(`[SUCCESS] Forcefully unlinked ${host}`);
            } else {
                ns.tprint(`[WARNING] Failed to execute worker on ${host} even after clearing RAM footprint.`);
            }
        } catch (e) {
            ns.tprint(`[ERROR] Could not clear link on ${host}: ${e}`);
        }
    }
    ns.tprint(`[CLEANUP] Teardown script complete. Global stasis pool reset to ${ns.dnet.getStasisLinkedServers().length}.`);
}