/** @param {NS} ns */
export async function main(ns) {
    let locations = ns.infiltration.getPossibleLocations()
    var data = []
    for (let loc of locations) {
        let info = ns.infiltration.getInfiltration(loc.name)
        info.ratio = info.reward.SoARep / info.maxClearanceLevel
        data.push(info)
    }

    data.sort((a, b) => a.ratio - b.ratio)

    for (let item of data) {
        ns.tprint(item)
        ns.tprint(item.reward.SoARep / item.maxClearanceLevel)
        ns.tprint("------------------------\n\n")
    }
}

