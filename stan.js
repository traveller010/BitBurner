/** @param {NS} ns */
export async function main(ns) {
    // var fragments = ns.stanek.activeFragments();
    // for (let frag of fragments) {
    //     if (frag.limit > 1) continue
    //     ns.tprint(frag);
    //     ns.tprint("---------------------------------------------------------------")
    // }

    while (true) {
        await ns.sleep(1);
        await ns.stanek.chargeFragment(0, 0);
        await ns.stanek.chargeFragment(0, 1);
        // await ns.stanek.chargeFragment(0, 2);
        await ns.stanek.chargeFragment(0, 3);
        // await ns.stanek.chargeFragment(0, 4);
        // await ns.stanek.chargeFragment(0, 5);
        // await ns.stanek.chargeFragment(0, 6);
        // await ns.stanek.chargeFragment(1, 0);
        // await ns.stanek.chargeFragment(1, 1);
        // await ns.stanek.chargeFragment(1, 2);
        await ns.stanek.chargeFragment(1, 3);
        await ns.stanek.chargeFragment(1, 4);
        await ns.stanek.chargeFragment(1, 5);
        // await ns.stanek.chargeFragment(1, 6);
        await ns.stanek.chargeFragment(2, 0);
        // await ns.stanek.chargeFragment(2, 1);
        // await ns.stanek.chargeFragment(2, 2);
        // await ns.stanek.chargeFragment(2, 3);
        // await ns.stanek.chargeFragment(2, 4);
        // await ns.stanek.chargeFragment(2, 5);
        // await ns.stanek.chargeFragment(2, 6);
        // await ns.stanek.chargeFragment(3, 0);
        // await ns.stanek.chargeFragment(3, 1);
        // await ns.stanek.chargeFragment(3, 2);
        // await ns.stanek.chargeFragment(3, 3);
        // await ns.stanek.chargeFragment(3, 4);
        // await ns.stanek.chargeFragment(3, 5);
        // await ns.stanek.chargeFragment(3, 6);
        await ns.stanek.chargeFragment(4, 0);
        // await ns.stanek.chargeFragment(4, 1);
        // await ns.stanek.chargeFragment(4, 2);
        // await ns.stanek.chargeFragment(4, 3);
        await ns.stanek.chargeFragment(4, 4);
        // await ns.stanek.chargeFragment(4, 5);
        // await ns.stanek.chargeFragment(4, 6);
        // await ns.stanek.chargeFragment(5, 0);
        await ns.stanek.chargeFragment(5, 1);
        // await ns.stanek.chargeFragment(5, 2);
        // await ns.stanek.chargeFragment(5, 3);
        // await ns.stanek.chargeFragment(5, 4);
        // await ns.stanek.chargeFragment(5, 5);
        // await ns.stanek.chargeFragment(5, 6);
        // await ns.stanek.chargeFragment(6, 0);
        // await ns.stanek.chargeFragment(6, 1);
        // await ns.stanek.chargeFragment(6, 2);
        await ns.stanek.chargeFragment(6, 3);
        // await ns.stanek.chargeFragment(6, 4);
        // await ns.stanek.chargeFragment(6, 5);
        // await ns.stanek.chargeFragment(6, 6);
        // await ns.stanek.chargeFragment(7, 0);
        // await ns.stanek.chargeFragment(7, 1);
        // await ns.stanek.chargeFragment(7, 2);
        // await ns.stanek.chargeFragment(7, 3);
        // await ns.stanek.chargeFragment(7, 4);
        // await ns.stanek.chargeFragment(7, 5);
        // await ns.stanek.chargeFragment(7, 6);
    }
}

