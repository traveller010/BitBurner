/** @param {NS} ns **/
export async function main(ns) {

    let files = ns.ls("home", "maze-")
    if (files.length == 0) {
        ns.alert("No maze files available. Exiting script.");
        ns.exit();
    }
    let targetFile = await ns.prompt("Choose maze file to track", {type: "select", choices:files})
    // const targetFile = ns.args[0] || "maze-et3rn4l_l4byr1nth.json";
    if (targetFile == "") ns.exit();
    ns.disableLog("ALL");
    
    // 📡 Initialize and size the standalone window frame
    ns.ui.openTail();
    ns.ui.resizeTail(600, 800);

    // Generate a completely unique string token to locate this script's DOM node
    const token = `__LAB_RADAR_FEED_${Math.floor(Math.random() * 100000)}__`;
    ns.print(token);
    
    const doc = eval("document");
    let hook = null;

    // 🎯 THE RADAR BIND LOOP: Retry every 50ms for up to 2 seconds to handle window mounting lag
    for (let i = 0; i < 40; i++) {
        const matches = Array.from(doc.querySelectorAll("*")).filter(el => 
            el.textContent && el.textContent.includes(token)
        );
        
        if (matches.length > 0) {
            // The last element in the document order is always the deepest leaf node
            hook = matches[matches.length - 1];
            break;
        }
        await ns.sleep(50);
    }
    
    if (!hook) {
        ns.tprint("❌ [ERROR] Failed to bind pixel graphics engine to the window frame.");
        return;
    }

    // Climb up to the log lines wrap container to clear out the text lines cleanly
    const container = hook.parentElement.parentElement;
    container.style.overflow = "hidden";
    container.style.height = "100%";
    container.innerHTML = `
        <div style="font-family: 'Courier New', monospace; color: #00ff00; padding: 12px; background: #000; height: 100%; box-sizing: border-box;">
            <div id="radar-meta" style="margin-bottom: 8px; font-size: 12px; line-height: 1.4; font-weight: bold; text-shadow: 0 0 4px #00ff00;">
                📡 LABYRINTH LIVE TACTICAL RADAR SWEEP<br>
                ├── target_node : ${targetFile.replace("maze-","").replace(".json","")}<br>
                ├── rooms_mapped : <span id="meta-rooms" style="color:#fff;">0</span><br>
                └── active_frontiers: <span id="meta-frontiers" style="color:#00ff00; text-shadow: 0 0 6px #00ff00;">0</span>
            </div>
            <canvas id="mazeCanvas" width="520" height="440" style="background: #030703; border: 1px solid #004400; display: block; box-shadow: inset 0 0 20px #001100;"></canvas>
        </div>
    `;

    const canvas = doc.getElementById("mazeCanvas");
    const ctx = canvas.getContext("2d");
    const metaRooms = doc.getElementById("meta-rooms");
    const metaFrontiers = doc.getElementById("meta-frontiers");

    // =================================================================
    // REAL-TIME RADAR RENDERING LOOP
    // =================================================================
    while (true) {
        if (!ns.fileExists(targetFile, "home")) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#00ff00";
            ctx.font = "13px monospace";
            ctx.fillText("📡 Awaiting map database synchronization link...", 20, 40);
            await ns.sleep(1000);
            continue;
        }

        try {
            const rawData = ns.read(targetFile);
            if (!rawData || rawData === "{}") { await ns.sleep(500); continue; }
            
            const mazeData = JSON.parse(rawData);
            const keys = Object.keys(mazeData);

            let maxX = 0, maxY = 0;
            for (const key of keys) {
                const [x, y] = key.split(',').map(Number);
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }

            const gridWidth = maxX + 2;
            const gridHeight = maxY + 2;
            
            let grid = [];
            for (let y = 0; y <= gridHeight; y++) {
                grid.push(new Array(gridWidth).fill(1));
            }

            const dirOffsets = {
                n: { wx: 0, wy: -1, nx: 0, ny: -2 },
                s: { wx: 0, wy: 1,  nx: 0, ny: 2 },
                e: { wx: 1, wy: 0,  nx: 2, ny: 0 },
                w: { wx: -1, wy: 0, nx: -2, ny: 0 }
            };

            let frontierCount = 0;

            for (const key of keys) {
                const [x, y] = key.split(',').map(Number);
                const room = mazeData[key];
                grid[y][x] = 0; 

                for (const dir in dirOffsets) {
                    if (room[dir] === true) {
                        const offset = dirOffsets[dir];
                        const wallX = x + offset.wx;
                        const wallY = y + offset.wy;
                        const neighborKey = `${x + offset.nx},${y + offset.ny}`;

                        if (mazeData[neighborKey] !== undefined) {
                            grid[wallY][wallX] = 0; 
                        } else {
                            grid[wallY][wallX] = 2; 
                            frontierCount++;
                        }
                    }
                }
            }

            if (metaRooms) metaRooms.textContent = keys.length;
            if (metaFrontiers) metaFrontiers.textContent = frontierCount;

            ctx.fillStyle = "#030703";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const blockSize = Math.min(
                Math.floor((canvas.width - 36) / gridWidth),
                Math.floor((canvas.height - 36) / gridHeight)
            ) || 6;

            const offsetX = Math.floor((canvas.width - (gridWidth * blockSize)) / 2);
            const offsetY = Math.floor((canvas.height - (gridHeight * blockSize)) / 2);

            // 1. Draw Matrix Map Layers
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    const bx = offsetX + (x * blockSize);
                    const by = offsetY + (y * blockSize);

                    if (grid[y][x] === 1) {
                        ctx.fillStyle = "#0f1a0f";
                        ctx.fillRect(bx, by, blockSize - 1, blockSize - 1);
                    } else if (grid[y][x] === 0) {
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(bx, by, blockSize, blockSize);
                    } else if (grid[y][x] === 2) {
                        ctx.fillStyle = "#005500";
                        ctx.fillRect(bx, by, blockSize, blockSize);
                        
                        ctx.fillStyle = "#00ff00";
                        const pad = Math.max(1, blockSize / 4);
                        ctx.fillRect(bx + pad, by + pad, blockSize - (pad * 2), blockSize - (pad * 2));
                    }
                }
            }

            // =================================================================
            // 🔢 AXIS LABEL LAYER: Render Row & Column Coordinates
            // =================================================================
            ctx.fillStyle = "#00aa00"; // Dimmed green font to prevent interface clutter
            ctx.font = "9px 'Courier New', monospace";
            
            // Calculate an adaptive skip index step to prevent overcrowding on large maps
            const colStep = gridWidth > 40 ? 5 : (gridWidth > 20 ? 2 : 1);
            const rowStep = gridHeight > 40 ? 5 : (gridHeight > 20 ? 2 : 1);

            // Draw Columns numbers along the TOP of the grid
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            for (let x = 0; x < gridWidth; x++) {
                if (x % colStep !== 0) continue;
                const bx = offsetX + (x * blockSize) + (blockSize / 2);
                const by = offsetY - 4; // 4px safe margin above the first row block
                ctx.fillText(x, bx, by);
            }

            // Draw Row numbers down the RIGHT side of the grid
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            for (let y = 0; y < gridHeight; y++) {
                if (y % rowStep !== 0) continue;
                const bx = offsetX + (gridWidth * blockSize) + 6; // 6px safe margin to the right of the map
                const by = offsetY + (y * blockSize) + (blockSize / 2);
                ctx.fillText(y, bx, by);
            }

        } catch (e) {
            // Standard try-catch block to ride out file read race collisions smoothly
        }

        await ns.sleep(1000);
    }
}