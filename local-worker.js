
    /** @param {NS} ns */
    export async function main(ns) {
        const [action, target, pid] = ns.args;
        if (action === "h") await ns.hack(target);
        else if (action === "g") await ns.grow(target);
        else if (action === "w") await ns.weaken(target);
    }