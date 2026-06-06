/** @param {NS} ns */
export async function main(ns) {
    let servers = ["megacorp", "ecorp", "nwo", "kuai-gong", "4sigma", "b-and-a",
    "clarkinc", "omnitek", "blade"];

    let seg1 = "Server"
    let seg2 = "Max money"
    let seg3 = "Min Security"
    
    let l1 = seg1.length
    let l2 = seg2.length
    let l3 = seg3.length

    ns.tprint(seg1+"\t("+l1+")\t"+seg2+"\t("+l2+")\t"+seg3)

    for (let server of servers) {
        let maxMoney = ns.format.number(ns.getServerMaxMoney(server));
        let maxM_L = maxMoney.length
        var tab = ""
        if (maxM_L <=7) {
            tab = "\t"
        }
        let minSecurity = ns.format.number(ns.getServerMinSecurityLevel(server),2);
        ns.tprint(server+"\t("+server.length+")\t"+maxMoney+tab+"\t("+maxMoney.length+")\t"+minSecurity+"\t("+minSecurity.length+")");
    }
}

