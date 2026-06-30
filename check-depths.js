/** @param {NS} ns **/
export async function main(ns) {
    ns.clearLog();
    
    // 📡 Fixed v3 UI hooks
    ns.ui.openTail();
    ns.ui.resizeTail(500, 400);

    ns.print("🔍 DARK NET DEPTH INDEX VERIFICATION SCAN");
    ns.print("==================================================");
    
    // 1. Audit the baseline entry-point node
    try {
        const darkwebDetails = ns.dnet.getServerDetails("darkweb");
        ns.print(`🏠 [ROOT] darkweb depth index : ${darkwebDetails.depth}`);
    } catch(e) {
        ns.print(`❌ [ERROR] Failed to read darkweb metrics: ${e}`);
    }

    ns.print("--------------------------------------------------");
    ns.print("📡 [PROBE] Scanning adjacent network layers...");
    ns.print("--------------------------------------------------");

    // 2. Map surrounding servers to observe the numerical step progression
    try {
        const discoveredHosts = ns.dnet.probe();
        
        if (discoveredHosts.length === 0) {
            ns.print("⚠️ No adjacent nodes detected from this position.");
        }

        for (const host of discoveredHosts) {
            try {
                const details = ns.dnet.getServerDetails(host);
                const layerStr = `Depth ${details.depth}`.padEnd(10);
                const modelStr = `(Model: ${details.modelId || "Standard"})`;
                
                ns.print(`├── ${host.padEnd(22)} : ${layerStr} ${modelStr}`);
            } catch (innerErr) {
                ns.print(`├── ${host.padEnd(22)} : [Metrics Read Failure]`);
            }
        }
    } catch(e) {
        ns.print(`❌ [ERROR] Network probe sequence aborted: ${e}`);
    }
    
    ns.print("==================================================");
    ns.print("Scan Complete. Compare indices to lock your targets.");
}