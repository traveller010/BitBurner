/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearPort(19);
    ns.clearPort(20);
    ns.clearPort(25);
    ns.clearPort(26);
    ns.clearPort(27);
    ns.clearPort(28);

    // 🔄 SWARM UPGRADE: Master dictionary holding separate topologies for each labyrinth version
    // Structure: { "th3-l4byr1nth": { "1,11": walls }, "cru3l-l4byr1nth": { ... } }
    const globalTopologies = {};

    ns.tprint("🛰️ [SYSTEM] Labyrinth Multi-Maze Monitor active. Awaiting network synchronization...");

    while (true) {
        // Track which specific labyrinths received updates on this execution tick
        const updatedLabs = new Set();
        const inboundPorts = [19, 25, 27];

        for (const port of inboundPorts) {
            let rawPacket = ns.readPort(port);

            while (rawPacket !== "NULL PORT DATA" && rawPacket !== "NULL DATA" && rawPacket) {
                try {
                    const packet = JSON.parse(rawPacket);

                    if (packet.labyrinth && packet.room && packet.walls) {
                        const labName = packet.labyrinth;
                        let [px, py] = packet.room.split(',').map(Number);

                        // Automatically initialize a fresh sub-database for newly discovered labyrinth tiers
                        if (!globalTopologies[labName]) {
                            globalTopologies[labName] = {};
                        }

                        const currentTopology = globalTopologies[labName];
                        let baselineKeys = Object.keys(currentTopology);

                        // VALIDATION GUARD: Verify spacing alignment against this specific labyrinth's history
                        if (baselineKeys.length > 0) {
                            let sampleKey = baselineKeys[0];
                            let [sx, sy] = sampleKey.split(',').map(Number);

                            let cacheStepSize = 2; // Default fallback
                            if (baselineKeys.length > 1) {
                                for (let k of baselineKeys) {
                                    let [kx, ky] = k.split(',').map(Number);
                                    if (kx !== sx && Math.abs(kx - sx) > 0) { cacheStepSize = Math.abs(kx - sx); break; }
                                    if (ky !== sy && Math.abs(ky - sy) > 0) { cacheStepSize = Math.abs(ky - sy); break; }
                                }
                            }

                            let xDelta = Math.abs(px - sx);
                            let yDelta = Math.abs(py - sy);

                            if ((px !== sx && xDelta % cacheStepSize !== 0) ||
                                (py !== sy && yDelta % cacheStepSize !== 0)) {

                                ns.tprint(`⚠️ [WARNING] Labyrinth spacing anomaly detected on ${labName}! Expected step-size ${cacheStepSize}. Wiping cache.`);
                                
                                // Clear out only the contaminated maze's memory entries
                                globalTopologies[labName] = {}; 
                                
                                ns.clearPort(20);
                                ns.clearPort(26);
                                ns.clearPort(28);

                                // Wipe the matching disk file to clear out contamination
                                ns.write(`maze-${labName}.json`, "{}", "w");
                                rawPacket = ns.readPort(port);
                                continue;
                            }
                        }

                        // Register the room layout under its matching labyrinth bucket
                        if (!currentTopology[packet.room]) {
                            currentTopology[packet.room] = packet.walls;
                            updatedLabs.add(labName);
                        }
                    }
                } catch (e) {
                    // Ignore corrupted parse drops
                }
                rawPacket = ns.readPort(port);
            }
        }

        // 2. REFLECTION & PERSISTENCE LAYER
        if (updatedLabs.size > 0) {
            // Echo back to all active network nodes so the concurrent threads stay synchronized
            const outboundPorts = [20, 26, 28];
            for (const outPort of outboundPorts) {
                ns.clearPort(outPort);
                // Broadcast all gathered maps across the link
                ns.tryWritePort(outPort, JSON.stringify(globalTopologies));
            }

            // 💾 DYNAMIC FILE PERSISTENCE: Save each labyrinth to its own separate file
            for (const labName of updatedLabs) {
                const fileName = `maze-${labName}.json`;
                ns.write(fileName, JSON.stringify(globalTopologies[labName]), "w");
            }
        }

        await ns.sleep(20);
    }
}