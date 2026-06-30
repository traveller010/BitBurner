/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // 1. GANG INITIALIZATION & ARGUMENT CHECK
    if (ns.args.length > 0) {
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
    const trainingTasks = ["Train Combat", "Train Hacking", "Train Charisma"];
    const memberStates = {};

    // 🎯 INTERACTIVE UX MODAL
    // Execution halts here until you select "Yes" or "No" on the game UI overlay
    const shouldAscend = await ns.prompt("Ascend eligible gang members before starting the training cycle?");
    ns.print(`❓ [CHOICE] Run ascension phase: ${shouldAscend}`);

    // 2. CAPTURE INITIAL STATE & UPGRADE MEMBERS
    let members = ns.gang.getMemberNames();

    for (let member of members) {
        let info = ns.gang.getMemberInformation(member);

        // Lock their current active task into memory so we can restore it later
        memberStates[member] = { originalTask: info.task };
        ns.print(`💾 [RECORD] Registered ${member}'s active job: ${info.task}`);

        // Only perform upgrades if they aren't tied up in critical security operations
        if (!info.task.includes("Territory Warfare")) {

            // STEP A: CONDITIONAL SMART ASCENSION 
            // Evaluates strictly if you clicked "Yes" on the startup modal prompt
            if (shouldAscend) {
                let ascResult = ns.gang.getAscensionResult(member);
                if (ascResult && (ascResult.str > 1.15 || ascResult.agi > 1.15 ||
                    ascResult.def > 1.15 || ascResult.cha > 1.15 || ascResult.dex > 1.15 ||
                    ascResult.hack > 1.15)) {
                    ns.gang.ascendMember(member);
                    ns.print(`📈 [ASCEND] Upgraded syndicate rank for ${member}`);
                }
            } else {
                ns.print(`⏭️ [SKIP] Ascension bypassed for ${member} by user request.`);
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
    }

    // 3. SEQUENTIAL 6-MINUTE TRAINING BLOCK & RESTORATION
    for (let currentTask of trainingTasks) {
        ns.print(`🔄 [SYNDICATE TASK] Rotating all eligible members to: ${currentTask}`);

        for (let member of members) {
            if (!memberStates[member].originalTask.includes("Territory Warfare")) {
                ns.gang.setMemberTask(member, currentTask);
            }
        }

        // Sleep for 2 minutes per training discipline
        await ns.sleep(120000);
    }

    // RESTORATION PHASE
    ns.print("🏁 [FINISHING] Training cycle complete. Restoring baseline jobs...");
    for (let member of members) {
        ns.gang.setMemberTask(member, memberStates[member].originalTask);
        ns.print(`↩️ [RESTORE] ${member} returned to: ${memberStates[member].originalTask}`);
    }

    ns.tprint("🟢 [SUCCESS] Finite 6-minute ascension and training pipeline completed. Script exiting.");
}