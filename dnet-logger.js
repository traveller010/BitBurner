/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // =========================================================================
    // ⚙️ CENTRALIZED STREAM CONFIGURATION
    // =========================================================================
    const PORT_SUCCESS = 15;
    const PORT_DIAG = 14;
    
    const FILE_SUCCESS = "darknet-success.txt";
    const FILE_DIAG = "darknet-diagnostics.txt";
    // =========================================================================

    // 🧹 INITIALIZATION PURGE: Truncate logs using the 'w' overwrite mode
    ns.write(FILE_SUCCESS, "", "w");
    ns.write(FILE_DIAG, "", "w");

    ns.tprint(`📊 [LOGGER] Dual-stream monitoring active.`);
    ns.tprint(`   ├── Stream A (Wins & Loot)      ──► Port ${PORT_SUCCESS} ──► ${FILE_SUCCESS}`);
    ns.tprint(`   └── Stream B (Specs & Failures) ──► Port ${PORT_DIAG} ──► ${FILE_DIAG}`);

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

        await ns.sleep(200);
    }
}