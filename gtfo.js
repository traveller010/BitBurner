/** @param {NS} ns **/
export async function main(ns) {

	const homeServ = "home";
	const trader = "se.js";

	if (ns.scriptRunning(trader, homeServ)) {
		ns.scriptKill(trader, homeServ);
	}

	ns.tprint("Getting ready to GTFO? Before you go, Please ensure that:");
	ns.tprint("\t- You use up your money wherever possible");
	ns.tprint("\t- Close all positions in the stock market");
	ns.tprint("\t- Check augments from all factions");
	ns.tprint("\t- Back up all your scripts");
	ns.tprint("");

	// Close all home scripts
	ns.killall();
}

