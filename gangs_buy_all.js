/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // 1. GANG INITIALIZATION & ARGUMENT CHECK
    if (ns.args.length > 0) {
        // OPTIMIZATION: Fixed the assignment bug to use strict comparison
        if (ns.args[0] === "join") {
            let gangToJoin = ns.args[1] || "Slum Snakes";
            let success = ns.gang.createGang(gangToJoin);
            ns.tprint(success ? `🟢 [SUCCESS] Formed gang syndicate with ${gangToJoin}` : `❌ [FAILED] Unable to form gang.`);
            ns.tprint(`💔 Current Heart Break Level: ${ns.format.number(ns.heart.break(), 2)}`);
        }
        return;
    }

    // Guard Clause: If we aren't in a gang yet, rest the script safely
    if (!ns.gang.inGang()) {
        ns.print("💤 [STANDBY] Not currently a member of a crime syndicate. Exiting loop.");
        return;
    }

    const equipment = ns.gang.getEquipmentNames();
    // Core tasks for cycle rotation
    const trainingTasks = ["Train Combat", "Train Hacking", "Train Charisma"];
    let trainingCycleIndex = 0;

    // MAIN CONTINUOUS SYNDICATE MANAGEMENT LOOP
    while (true) {
        let members = ns.gang.getMemberNames();

        for (let member of members) {
            // STEP A: SMART ASCENSION 
            // Only ascend if the multiplier bump provides a meaningful return (> 1.15x improvement)
            let ascResult = ns.gang.getAscensionResult(member);
            if (ascResult && (ascResult.str > 1.15 || ascResult.agi > 1.15 || ascResult.def > 1.15)) {
                ns.gang.ascendMember(member);
                ns.print(`📈 [ASCEND] Upgraded syndicate rank for ${member}`);
            }

            // STEP B: AUTOMATED GEAR BUYOUTS
            for (let item of equipment) {
                let cost = ns.gang.getEquipmentCost(item);
                if (ns.getPlayer().money > cost) {
                    if (ns.gang.purchaseEquipment(member, item)) {
                        ns.print(`💰 [PURCHASE] Outfitted ${member} with ${item}`);
                    }
                }
            }
        }

        // STEP C: NON-BLOCKING GLOBAL TRAINING CYCLE ROTATION
        // Instead of freezing for 36 minutes, change everyone's task simultaneously 
        // and sleep once per loop cycle to let the syndicate work in parallel.
        let currentGlobalTask = trainingTasks[trainingCycleIndex];
        ns.print(`🔄 [SYNDICATE TASK] Rotating all members to: ${currentGlobalTask}`);
        
        for (let member of members) {
            let info = ns.gang.getMemberInformation(member);
            // Only force training if they aren't assigned to vital security operations
            if (!info.task.includes("Territory Warfare")) {
                ns.gang.setMemberTask(member, currentGlobalTask);
            }
        }

        // Cycle to the next training discipline for the next pass
        trainingCycleIndex = (trainingCycleIndex + 1) % trainingTasks.length;

        // Sleep for 2 minutes per global pass to let gains accumulate naturally
        await ns.sleep(120000);
    }
}

