/** @param {NS} ns */
export async function main(ns) {
    var i = 0
    let tickers = ns.stock.getSymbols()
    for (let sym of tickers) {
        ns.tprint(sym + " - " + ns.stock.getForecast(sym))
        ns.tprint("--------------")
        if (i > 3) {
            return
        }
        i++
    }
}

