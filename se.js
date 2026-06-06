/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // 1. INTEGRATED HIBERNATION ENGINE
    // Keeps the script alive but dormant so captain.js doesn't spam run loops
    let hasAccess = ns.stock.hasTixApiAccess() && ns.stock.has4SDataTixApi();
    if (!hasAccess) {
        ns.print("💤 [DORMANT] Market access requirements missing. Entering low-power hibernation...");
    }
    
    while (!ns.stock.hasTixApiAccess() || !ns.stock.has4SDataTixApi()) {
        await ns.sleep(60000); // Check api unlocks once per minute with 0% CPU lag
    }

    const reservePercent = 0.2;  // Keep 20% liquid cash reserves
    const commissionFee = 100000; // Flat market transaction cost
    let canShort = false;

    // 2. Check Source File 8 for Shorting Capabilities
    for (let sf of ns.singularity.getOwnedSourceFiles()) {
        if (sf.n === 8 && sf.lvl >= 1) {
            canShort = true;
        }
    }

    // 3. Prevent Concurrency Conflicts
    let runningScripts = ns.ps("home");
    let instanceCount = runningScripts.filter(p => p.filename === ns.getScriptName()).length;
    if (instanceCount > 1) {
        ns.tprint(`[ERROR] ${ns.getScriptName()} is already running! Terminating.`);
        return;
    }

    // 4. Register Fail-Safe Liquidation Trigger
    ns.atExit(sellAll);

    ns.tprint("📈 [SUCCESS] Portfolio Engine initialized with Volatility Synergy broadcasting.");

    // Main Trading Loop
    while (true) {
        let symbols = ns.stock.getSymbols();

        // Step A: Handle Liquidations First (Clean house before buying)
        for (let sym of symbols) {
            let [longShares, , shortShares, ] = ns.stock.getPosition(sym);
            let forecast = ns.stock.getForecast(sym);

            if (longShares > 0 && forecast < 0.5) {
                ns.stock.sellStock(sym, longShares);
                ns.print(`[LIQUIDATE] Closed Long on ${sym} (Bearish flip).`);
            }
            if (shortShares > 0 && forecast > 0.5) {
                ns.stock.sellShort(sym, shortShares);
                ns.print(`[LIQUIDATE] Closed Short on ${sym} (Bullish flip).`);
            }
        }

        // Step B: Gather Market Intel & Identify the "Whale" Position
        let largestStockSym = null;
        let highestPositionValue = 0;

        let marketData = symbols.map(sym => {
            let [longShares, , shortShares, ] = ns.stock.getPosition(sym);
            let currentPositionValue = 0;

            if (longShares > 0) {
                currentPositionValue = longShares * ns.stock.getBidPrice(sym);
            } else if (shortShares > 0 && canShort) {
                currentPositionValue = shortShares * ns.stock.getAskPrice(sym);
            }

            if (currentPositionValue > highestPositionValue) {
                highestPositionValue = currentPositionValue;
                largestStockSym = sym;
            }

            return {
                symbol: sym,
                forecast: ns.stock.getForecast(sym),
                maxShares: ns.stock.getMaxShares(sym),
                longShares: longShares,
                shortShares: shortShares,
                askPrice: ns.stock.getAskPrice(sym),
                bidPrice: ns.stock.getBidPrice(sym)
            };
        });

        // Step C: Broadcast the Largest Target to Port 16 for the Botnet
        ns.clearPort(16);
        if (largestStockSym) {
            ns.writePort(16, largestStockSym);
            ns.print(`[BROADCAST] Target '${largestStockSym}' pushed to botnet ($${ns.format.number(highestPositionValue)} holding value).`);
        }

        // Step D: Sort Market by Attractiveness (Distance from 0.5 neutral line)
        marketData.sort((a, b) => Math.abs(b.forecast - 0.5) - Math.abs(a.forecast - 0.5));

        // Step E: Loop and Dynamically Allocate Budget
        for (let stock of marketData) {
            let currentCash = ns.getPlayer().money;
            let investableCash = currentCash - (currentCash * reservePercent);
            
            if (investableCash < 10_000_000) break; 

            let budgetWeight = 0;
            let forecast = stock.forecast;

            if (forecast >= 0.8 || forecast <= 0.2) {
                budgetWeight = 1.0;  
            } else if (forecast >= 0.7 || forecast <= 0.3) {
                budgetWeight = 0.6;  
            } else if (forecast >= 0.55 || forecast <= 0.45) {
                budgetWeight = 0.25; 
            }

            let allocatedBudget = investableCash * budgetWeight;

            // LONG EXECUTION
            if (forecast >= 0.55) {
                let remainingShares = stock.maxShares - stock.longShares;
                if (remainingShares > 0) {
                    let affordableShares = Math.floor((allocatedBudget - commissionFee) / stock.askPrice);
                    let sharesToBuy = Math.min(remainingShares, affordableShares);

                    if (sharesToBuy > 0) {
                        ns.stock.buyStock(stock.symbol, sharesToBuy);
                        ns.print(`[ALLOCATE LONG] Bulk purchased ${ns.format.number(sharesToBuy)} shares of ${stock.symbol}`);
                    }
                }
            }

            // SHORT EXECUTION
            if (canShort && forecast <= 0.45) {
                let remainingShorts = stock.maxShares - stock.shortShares;
                if (remainingShorts > 0) {
                    let affordableShorts = Math.floor((allocatedBudget - commissionFee) / stock.bidPrice);
                    let shortsToBuy = Math.min(remainingShorts, affordableShorts);

                    if (shortsToBuy > 0) {
                        ns.stock.buyShort(stock.symbol, shortsToBuy);
                        ns.print(`[ALLOCATE SHORT] Bulk shorted ${ns.format.number(shortsToBuy)} shares of ${stock.symbol}`);
                    }
                }
            }
        }

        await ns.sleep(5000); 
    }

    function sellAll() {
        let symbols = ns.stock.getSymbols();
        for (let sym of symbols) {
            let [longShares, , shortShares, ] = ns.stock.getPosition(sym);
            if (longShares > 0) ns.stock.sellStock(sym, longShares);
            if (shortShares > 0 && canShort) ns.stock.sellShort(sym, shortShares);
        }
        ns.tprint("[STOCK] Emergency Exit Triggered: All asset holdings liquidated.");
    }
}
