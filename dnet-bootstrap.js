const WORM_VERSION = "v1.6.17";

/** @param {NS} ns **/
export async function main(ns) {
    // Arguments passed by parent worm loop:
    // args[0] = WORM_VERSION, args[1] = target hostname, args[2] = parent scriptName, args[3] = password
    const targetHost = ns.args[1];
    const password = ns.args[3]; 

    if (!targetHost || password === undefined || password === null) return;

    try {
        // 1. 🔑 Authenticate this script's unique PID on the target machine it is running on
        if (targetHost !== "darkweb") {
            ns.dnet.connectToSession(targetHost, password);
        }

        // 2. ⚡ Execute a fixed burst of memory reallocation cycles
        // Since it terminates after a fixed count, it never deadlocks 16GB servers
        const burstCycles = 20; 
        for (let i = 0; i < burstCycles; i++) {
            await ns.dnet.memoryReallocation(targetHost);
            
            // Brief pause to let the Netscript execution engine register the freed memory
            await ns.sleep(50); 
        }

        // Script naturally ends here, completely freeing up its local RAM footprint
    } catch (e) {
        // Silent catch to keep error modals from pausing your game automation loop
    }
}