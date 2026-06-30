/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // =========================================================================
    // ⚙️ CENTRALIZED STREAM CONFIGURATION
    // =========================================================================
    const PORT_SUCCESS = 15;
    const PORT_DIAG = 14;
    const PORT_WORDS = 21;
    
    const FILE_SUCCESS = "darknet-success.txt";
    const FILE_DIAG = "darknet-diagnostics.txt";
    const FILE_WORDS = "darknet-words.txt";
    // =========================================================================

    // 🧹 INITIALIZATION PURGE: Wipe text logs AND clear stale port data streams
    ns.write(FILE_SUCCESS, "", "w");
    ns.write(FILE_DIAG, "", "w");

    // 🆕 Flush all darknet-related communication pipelines (10-16, 21) on central boot
    const portsToClear = [10, 11, 12, 13, 14, 15, 16, 21];
    for (const port of portsToClear) {
        ns.clearPort(port);
    }

    ns.tprint(`📊 [LOGGER] Dual-stream monitoring active. Communication plumbing flushed clean.`);
    ns.tprint(`   ├── Stream A (Wins & Loot)      ──► Port ${PORT_SUCCESS} ──► ${FILE_SUCCESS}`);
    ns.tprint(`   └── Stream B (Specs & Failures) ──► Port ${PORT_DIAG} ──► ${FILE_DIAG}`);
    ns.tprint(`   └── Stream C (Word Aggregator)  ──► Port ${PORT_WORDS} ──► ${FILE_WORDS}`);

    while (true) {
        // Stream A: Read successes and loot drops
        let successData = ns.readPort(PORT_SUCCESS);
        if (successData !== "NULL DATA" && successData !== "NULL PORT DATA" && successData) {
            ns.write(FILE_SUCCESS, successData + "\n", "a");
        }

        // Stream B: Read diagnostics, password hints, and authorization failures
        let diagData = ns.readPort(PORT_DIAG);
        if (diagData !== "NULL DATA" && diagData !== "NULL PORT DATA" && diagData) {
            ns.write(FILE_DIAG, diagData + "\n", "a");
        }

        // Stream C: Process exfiltrated data asset files from remote worms
        let wordAlert = ns.readPort(PORT_WORDS);
        if (wordAlert !== "NULL DATA" && wordAlert !== "NULL PORT DATA" && wordAlert) {
            try {
                const payload = JSON.parse(wordAlert);
                
                if (ns.fileExists(payload.filename, "home")) {
                    let discoveredWords = new Set();
                    
                    if (ns.fileExists(FILE_WORDS, "home")) {
                        ns.read(FILE_WORDS).split("\n").forEach(w => { 
                            if (w.trim()) discoveredWords.add(w.trim()); 
                        });
                    }

                    const content = ns.read(payload.filename);
                    const matches = content.match(/[a-zA-Z0-9_]+/g) || [];
                    for (const word of matches) {
                        if (word.length >= 3 && word.length <= 14) {
                            discoveredWords.add(word.trim());
                        }
                    }

                    ns.write(FILE_WORDS, Array.from(discoveredWords).join("\n"), "w");
                    ns.rm(payload.filename, "home");
                } else {
                    ns.write(FILE_DIAG, `[LOGGER-WARN] Port alert received for missing file: ${payload.filename}\n`, "a");
                }
            } catch (e) {
                ns.write(FILE_DIAG, `[LOGGER-HARVEST-ERR] Failed processing exfiltrated asset: ${e}\n`, "a");
            }
        }

        await ns.sleep(200);
    }
}