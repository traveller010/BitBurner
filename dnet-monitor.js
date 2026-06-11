/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearPort(19);
    
    ns.tprint("🛰️ [SYSTEM] Labyrinth Concurrency Monitor active. Awaiting network synchronization...");

    while (true) {
        let packet = ns.readPort(19);
        if (packet && packet !== "NULL DATA" && packet !== "NULL PORT DATA") {
            // Print the ground-truth telemetry timestamped directly to terminal
            ns.tprint(`[${new Date().toLocaleTimeString()}] ${packet}`);
        }
        await ns.sleep(100);
    }
}