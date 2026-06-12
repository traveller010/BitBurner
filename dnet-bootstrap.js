/** @param {NS} ns */
export async function main(ns) {
    const currentHost = ns.args[1];
    const masterWorm = "dnet-worm.js";
    const workerScript = "dnet-worker.js";
    const version = ns.args[0] || "v1.4.0";

    try {
        // Repeated reallocation is needed on darknet servers
        for (let i = 0; i < 5; i++) {
            await ns.dnet.memoryReallocation();
            await ns.sleep(200);
        }

        let pid = ns.exec(masterWorm, currentHost, 1, version);
        if (pid == 0) {
            ns.tryWritePort(14, `[BOOT-FAIL] ${currentHost} - RAM still blocked.`);
        } else {
            ns.tryWritePort(15, `[BOOT-SUCCESS] ${currentHost} worm started.`);
            if (ns.getServerMaxRam(currentHost) >= 15) ns.exec(workerScript, currentHost);
        }
    } catch (e) {
        ns.tryWritePort(14, `[BOOT-EX] ${currentHost} ${e}`);
    }
}
