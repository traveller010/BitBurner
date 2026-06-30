/** @param {NS} ns */
export async function main(ns) {
    const files = ns.ls("home").filter(f => f.endsWith(".js") || f.endsWith(".txt"));
    let masterDump = [];

    for (const file of files) {
        // Skip the logger files to keep the code clean
        if (file.includes("darknet-")) continue; 
        
        const content = ns.read(file);
        masterDump.push(`\n// ==========================================\n// FILE: ${file}\n// ==========================================\n${content}`);
    }

    ns.write("all_my_code_dump.txt", masterDump.join("\n"), "w");
    ns.tprint("📁 [SYSTEM] All scripts compiled into all_my_code_dump.txt!");
}