/** @param {NS} ns **/
export async function main(ns) {
    const wnd = eval("window");
    const doc = wnd["document"];
    const logFile = "infil-log.txt";

    ns.clearLog();
    ns.write(logFile, "=== SOURCE CODE CODE-INSPECTION INITIALIZED ===\n", "w");
    ns.tprint("🔬 [DAEMON] Returning to methodical tracking. Open Infiltration and click Start!");

    while (true) {
        const mainContainer = doc.querySelector('.MuiContainer-root');
        if (!mainContainer) {
            await ns.sleep(250);
            continue;
        }

        const text = mainContainer.innerText || "";

        // 1. Safe UI clicker to get us past the welcome gate
        if (text.includes("Spacebar is the default action/confirm button")) {
            const buttons = mainContainer.querySelectorAll('button');
            for (let b = 0; b < buttons.length; b++) {
                if (buttons[b].innerText && buttons[b].innerText.includes("Start")) {
                    buttons[b].click();
                    ns.write(logFile, "[1] Welcome screen clicked.\n", "a");
                    await ns.sleep(500);
                    break;
                }
            }
        }

        // 2. Trigger the deep scan ONLY when an active minigame is visible on screen
        const isMinigameActive = text.includes("Close the brackets") || text.includes("Type it backward");
        
        if (isMinigameActive) {
            ns.write(logFile, "[2] Active minigame screen detected. Beginning memory extraction...\n", "a");

            // Locate the live text element to use as our tree anchor
            const elements = mainContainer.querySelectorAll('p, span, h1, h2, h3, h4, h5, div');
            let leafNode = null;
            for (let i = elements.length - 1; i >= 0; i--) {
                if (elements[i].innerText && (elements[i].innerText.includes("brackets") || elements[i].innerText.includes("backward"))) {
                    leafNode = elements[i];
                    break;
                }
            }

            if (leafNode) {
                let domKeys = Object.keys(leafNode);
                let reactKey = "";
                for (let j = 0; j < domKeys.length; j++) {
                    if (domKeys[j].indexOf("__reactFiber") === 0) {
                        reactKey = domKeys[j];
                        break;
                    }
                }

                if (reactKey !== "") {
                    let curr = leafNode[reactKey];
                    let depth = 0;

                    // Climb up 20 layers and log EVERY instance of 'onKey' or stage objects we find during the game
                    while (curr && depth < 20) {
                        // Check memoizedProps for state logic
                        if (curr.memoizedProps && curr.memoizedProps.state) {
                            const stateObj = curr.memoizedProps.state;
                            
                            if (stateObj.stage) {
                                let logBuffer = "\n🔍 [MATCH FOUND AT LAYER -" + depth + "]\n";
                                logBuffer += "├── Stage Object Keys: " + Object.getOwnPropertyNames(stateObj.stage).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(stateObj.stage))).join(", ") + "\n";
                                
                                // If onKey exists, decompile its source code completely
                                if (stateObj.stage.onKey) {
                                    logBuffer += "├── [RAW FUNCTION SOURCE CODE FOR onKey]:\n";
                                    logBuffer += stateObj.stage.onKey.toString() + "\n";
                                }
                                
                                ns.write(logFile, logBuffer, "a");
                                ns.tprint("🎯 [SUCCESS] Source code extracted to infil-log.txt!");
                                return; // Mission accomplished, exit script
                            }
                        }
                        curr = curr.return;
                        depth++;
                    }
                }
            }
        }
        await ns.sleep(100);
    }
}