/** @param {NS} ns */
export async function main(ns) {
    let locations = ns.infiltration.getPossibleLocations()
    var data = []
    for (let loc of locations) {
        let info = ns.infiltration.getInfiltration(loc.name)
        data.push(info)
    }

    data.sort((a, b) => a.location.infiltrationData.startingSecurityLevel - b.location.infiltrationData.startingSecurityLevel)

    for (let item of data) {
        ns.tprint(item)
        ns.tprint("------------------------\n\n")
    }
}

