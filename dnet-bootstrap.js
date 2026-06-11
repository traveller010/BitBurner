/** @param {NS} ns */
export async function main(ns) {
    const currentHost = ns.args[1];
    const masterWorm = "dnet-worm.js";
    // Read the incoming version argument forwarded by the parent server pass
    const currentVersion = ns.args[0] || "v1.0.0";

    try {
        await ns.dnet.memoryReallocation();
        await ns.sleep(100);

        // Launch the master worm thread sealed with its tracking signature
        let pid = ns.exec(masterWorm, currentHost, { threads: 1, preventDuplicates: true }, currentVersion);
        if (pid == 0) {
            ns.tryWritePort(14, `[BOOTSTRAP FAIL] - ${currentHost} - pid = 0`);
        }
        else {
            ns.tryWritePort(15, `[BOOTSTRAP SUCCESS] - started worm on ${currentHost}`);
        }
    } catch (e) {
        ns.tryWritePort(14, `[BOOTSTRAP-EXCEPTION] - ${e}`);
    }
}