/** @param {NS} ns */
export async function main(ns) {
    let fileName = "server-rank.txt";
    var server_array = ["home"]; // Array of server names

    ns.write(fileName, "", "w");

    /** Example custom Server object
    @type [{"hostname":string,
    "ip":string,
    "sshPortOpen":boolean,
    "ftpPortOpen":boolean,
    "smtpPortOpen":boolean,
    "httpPortOpen":boolean,
    "sqlPortOpen":boolean,
    "hasAdminRights":boolean,
    "cpuCores":number,
    "isConnectedTo":boolean,
    "ramUsed":number,
    "maxRam":number,
    "organizationName":string,
    "purchasedByPlayer":boolean,
    "backdoorInstalled":boolean,
    "baseDifficulty":number,
    "hackDifficulty":number,
    "minDifficulty":number,
    "moneyAvailable":number,
    "moneyMax":number,
    "numOpenPortsRequired":number,
    "openPortCount":number,
    "requiredHackingSkill":number,
    "serverGrowth":number,
    "neighbours":[string]}] servers
    */
    var servers = [] // Array of custom Server objects
    var keys = [] // Array of all server attributes

    for (var item of server_array) {
        if (item == "") {
            continue;
        }
        let thisServer = ns.getServer(item);

        let info = {};

        for (let key in thisServer) {
            let value = thisServer[key];
            info[key] = value;
            keys.push(key)
        }
        keys = Array.from(new Set(keys))

        let neighbours = ns.scan(item)
        info['neighbours'] = neighbours
        servers.push(info)

        for (let neighbour of neighbours) {
            if (!server_array.includes(neighbour)) {
                server_array.push(neighbour)
            }
        }
    }

    // Print array to termianl
    // ns.tprint(servers)

    // Save to csv
    var data = ""
    // Store the keys as header row
    for (let key of keys) {
        data += key + ","
    }

    data += "\n"  // Add new line

    for (let server of servers) {
        var info = ""
        for (let key of keys) {
            info += server[key] + ","
        }
        info += "\n"  // Add new line
        data += info
    }

    ns.write("rank-servers-by.txt", data, "w")
}

