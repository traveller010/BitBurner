# BitBurner DarkNet Script Analysis and Documentation

## 1. Executive Summary

The current suite of DarkNet scripts (v1.6.18) represents a highly sophisticated, monolithic approach to network propagation and puzzle-solving in BitNode 15. The system is designed for autonomous expansion, credential synchronization, and multi-algorithm maze navigation.

However, several critical inefficiencies, inaccuracies, and potential bugs have been identified that hinder optimal performance, particularly on low-RAM servers and the DarkWeb gateway.

---

## 2. Efficiency and Functionality Analysis

### 2.1. RAM Inaccuracy (Critical)
*   **Bug:** The `WORM_COST` constant is set to `13.80` GB across all worm variants.
*   **Reality:** The actual static RAM footprint of the monolithic worm is approximately **23.6 GB**.
*   **Impact:**
    *   **32GB Servers:** The scripts attempt to deploy 2-3 variants on 32GB servers, which is mathematically impossible if each costs 23.6GB. This leads to failed `ns.exec` calls and wasted cycles.
    *   **16GB Servers (Gateway):** The worm cannot run on the `darkweb` gateway or any 16GB server. This creates a hard blocker for propagation unless a "lite" version is developed.
*   **Recommendation:** Update `WORM_COST` to reflect reality and implement a "Lite" mode that strips non-essential modules (Stock Promotion, Phishing) to fit under 16GB.

### 2.2. Monolithic Redundancy
*   **Inefficiency:** `dnet-worm.js`, `dnet-worm-dfs.js`, and `dnet-worm-tm.js` are ~95% identical.
*   **Impact:** Maintenance is difficult. A bug fix in the `crackingMatrix` must be manually applied to all three files.
*   **Recommendation:** While the monolithic structure was chosen for deployment efficiency (single-file transfer), consider using a build script to inject the specialized labyrinth solvers into a common template.

### 2.3. Port Management and Communication
*   **Functionality:** The system uses a port-based locking mechanism (Ports 10-13) and telemetry sync (Ports 14-28).
*   **Bug (Zombie Code):** Port 18 is referenced (`ns.readPort(18)`) but marked as "retired" in memory. This line serves no purpose.
*   **Bug (Race Condition):** The `acquireLock` function is vulnerable to race conditions. If two scripts call `ns.readPort` simultaneously, one may receive "NULL PORT DATA" while the other is processing the lock list. This can result in both scripts believing they have acquired the lock, leading to redundant authentication attempts.
*   **Observation:** The Labyrinth solvers use separate ports for BFS (19/20), DFS (25/26), and Trémaux (27/28). This allows parallel exploration but increases complexity in the monitor's aggregation logic.

### 2.4. Memory Reallocation Strategy
*   **Inefficiency:** `dnet-bootstrap.js` runs exactly 20 cycles of `memoryReallocation`.
*   **Gap:** Some "deep-layer" servers have high memory blockage that requires significantly more than 20 cycles to clear.
*   **Recommendation:** Implement a dynamic check in the bootstrap script to continue reallocation until `getBlockedRam()` is 0 or a higher threshold is met.

### 2.5. Labyrinth Efficiency
*   **BFS (dnet-worm.js):** Guarantees the shortest path but is memory-intensive for large grids.
*   **DFS (dnet-worm-dfs.js):** Dives deep; good for finding the goal quickly in narrow mazes but may take long paths.
*   **Trémaux (dnet-worm-tm.js):** Excellent for physical-style maze solving with "glide" mechanics, ensuring every corridor is visited twice at most.

### 2.6. Dead Code & Inefficiencies
*   **Unused Variables:** `reportedStalls` and `dataFilesCopied` (in some variants) are declared globally but never utilized for meaningful logic.
*   **Wait Intervals:** `ns.sleep(100)` in the main loop is relatively aggressive. Increasing this to `500` or `1000` on remote nodes would reduce CPU overhead without significantly impacting propagation speed.

---

## 3. Authentication Model Documentation

The `crackingMatrix` function handles various server models. Each model represents a unique puzzle.

| Model ID | Puzzle Description | Algorithmic Approach |
| :--- | :--- | :--- |
| **ZeroLogon** | No security. | Attempts authentication with an empty string `""`. |
| **FreshInstall_1.0** | Default or weak passwords. | Brute forces common patterns (123..., 000...), then tries words from the password hint, then a harvested dictionary. |
| **AccountsManager_4.2** | Numeric range. | Parses high/low bounds from hint. Performs a **Binary Search** using "higher/lower" feedback found in `ns.dnet.heartbleed` logs. |
| **RateMyPix.Auth** | Positional character guessing. | Iterates through characters. Uses the count of chili emojis (🌶️) in logs as a "fitness score" to lock in correct characters position-by-position. |
| **Factori-Os** | Prime Factorization. | Checks divisibility by primes using a prime generator and log feedback. Reconstructs the password from discovered factors. |
| **EuroZone Free** | European Country Names. | Filters a hardcoded list of countries by the required password length and tries variants (lowercase, uppercase, Title Case). |
| **TopPass** | Common Passwords. | Tries a predefined list of popular passwords for the specific length, supplemented by `darknet-words.txt`. |
| **BellaCuore** | Roman Numerals / Binary Search. | Either converts a Roman numeral from the hint to a string, or performs a binary search with "parum" (too little) / "nimis" (too much) Latin feedback. |
| **DeskMemo_3.1** | Plaintext Leak. | Uses Regex to extract all numeric sequences from the hint or metadata and tries them. |
| **CloudBlare(tm)** | Metadata Scraping. | Extracts digits from hint/data. Often the password is just the concatenated digits found in the server's metadata. |
| **KingOfTheHill** | Hill Climbing. | Samples altitudes at intervals, then performs a **Steepest Ascent** (gradient descent variant) to find the "peak" (correct password) based on altitude feedback. |
| **Laika4** | Pet Names. | Tries common dog names (laika, fido, etc.) in various cases. |
| **NIL** | Masking Feedback. | Tries each character in the pool as a mask. Logs return a "yes/yesn't" array. Reconstructs the password by mapping "yes" positions to the current character. |
| **Pr0verFl0** | Buffer Overflow. | Sends a long string of 'A's. Logs leak the "expected" string prefix. Brute forces the remaining 3 characters. |
| **OpenWebAccessPoint**| Data Leakage. | Scans `heartbleed` logs for signature-targeted strings (e.g., `hostname:password`) or uses a sliding window to try all substrings of a leaked data block. |
| **OctantVoxel** | Radix Conversion. | Parses a base and a number from metadata (e.g., base 16, number A2.F). Converts from the given base to base 10. |
| **DeepGreen** | Mastermind. | Similar to RateMyPix, but uses an "exact match" count from logs to determine if a character change improved the guess. |
| **PHP 5.4** | Permutation. | Extracts all digits from the hint and attempts every possible permutation of those digits. |
| **OrdoXenos** | XOR Cipher. | XORs a ciphertext string with a binary bitmask provided in the server data. |
| **PrimeTime 2** | Prime Factor. | Finds the **largest prime factor** of a number provided in the password hint. |
| **110100100** | Binary Translation. | Converts a space-delimited string of 8-bit binary sequences (e.g., `01000001`) into ASCII characters. |
| **BigMo%od** | Chinese Remainder Theorem. | Collects remainders for various prime moduli from logs. Solves the system of congruences to find the unique integer solution. |
| **2G_cellular** | Index Pinning. | Iterates through characters for each index. Logs confirm when a character at a specific "index (n)" is correct, allowing the script to move to (n+1). |
| **MathML** | Math Evaluation. | Evaluates a mathematical expression where operators are represented by emojis (e.g., ➕, ➖, ✖️, ➗). |
| **(The Labyrinth)** | Maze Solving. | Uses `ns.dnet.labreport` to map the grid and `ns.dnet.authenticate(hostname, "go [dir]")` to move. The puzzle involves navigating a grid with "sliding" mechanics (gliding until a wall is hit). Worms coordinate via shared topology data on ports (19-28) to map the maze and find password segments enclosed in `!!` marks in `heartbleed` logs. |

---

## 4. Function Documentation (Internal Worm Logic)

### `main(ns)`
*   The entry point. Initializes logs, synchronizes the password vault from `home`, and enters a continuous loop.
*   In each loop:
    1.  Loots `.cache` and exfiltrates `.txt`/`.data` files.
    2.  Probes nearby servers.
    3.  Attempts to solve/authenticate targets using `serverSolver`.
    4.  Manages deployment: Checks if a target needs memory reallocation (via `dnet-bootstrap.js`) or a version upgrade.
    5.  Runs background tasks (Stock promotion, Phishing) if not on `home`.

### `serverSolver(ns, hostname, ...)`
*   Orchestrates the cracking process for a single host.
*   First checks if the password is already in the `globalPasswordVault`.
*   Uses `acquireLock` to prevent multiple scripts from attacking the same target.
*   Calls `crackingMatrix` to perform the actual puzzle solving.

### `crackingMatrix(ns, hostname, ...)`
*   A large switch-case statement containing the logic for every known `modelId`.
*   Uses helper `getLogEntry` to wait for and parse `heartbleed` results.

### `solveLabyrinth(ns, hostname, ...)`
*   Specialized solver for maze-type servers.
*   Coordinates with other worms via ports to share topology data.
*   Monitors logs for password segments enclosed in `!!` marks.

### `lootCacheFiles(ns, ...)`
*   Scans for `.cache` files and uses `ns.dnet.openCache()`.
*   Scans for `.txt` and `.data` files and uses `ns.scp` to exfiltrate them to `home`.

### `wormIsOlder(ns, hostname, ...)`
*   Compares the `WORM_VERSION` of the local script with the version of scripts running on the target server to ensure the entire network is running the latest code.

---

## 5. Supporting Infrastructure Documentation

### 5.1. Network Management & Deployment

#### `dnet-bootstrap.js`
*   **Purpose:** A lightweight "grenade" script used to clear blocked RAM on a target server before the full worm suite is deployed.
*   **Logic:** Authenticates on the target, then runs a fixed burst of 20 `ns.dnet.memoryReallocation` cycles. It terminates itself to free up its own 4GB footprint.

#### `dnet-monitor.js`
*   **Purpose:** The central aggregator for Labyrinth topology data.
*   **Logic:** Listens on Ports 19, 25, and 27 for room discoveries from BFS, DFS, and Trémaux worms. It maintains a unified `globalTopologies` map, performs anomaly detection (spacing checks), and persists maps to `maze-[name].json` files. It broadcasts the full known map back to the worms on Ports 20, 26, and 28.

#### `dnet-logger.js`
*   **Purpose:** Centralized logging and word harvesting.
*   **Logic:** Aggregates successes (Port 15), diagnostics (Port 14), and exfiltrated files (Port 21). It automatically scrapes exfiltrated `.txt` and `.data` files for potential password candidates, adding them to `darknet-words.txt`.

#### `auto-starter.js`
*   **Purpose:** The master orchestration script for the "Public" (standard) network.
*   **Logic:** Boots all core background engines, manages the transition from early-game `auto-deploy.js` to late-game `launch-fleets.js` (Formulas-based hacking), and handles automated server purchasing.

#### `auto-deploy.js`
*   **Purpose:** Early-game "Captain" script for spreading basic hacking scripts (`gimme-money.js`) across the public network.
*   **Logic:** Periodically scans the network, gains root access, and maximizes thread count for the current best target.

#### `launch-fleets.js`
*   **Purpose:** Late-game Formulas-based hacking orchestrator.
*   **Logic:** Uses HGW (Hack/Grow/Weaken) batches. It calculates optimal timing and thread ratios using `Formulas.exe` to maximize profit while keeping security at minimum and money at maximum.

### 5.2. Utility Layer

#### `utils.js`
*   Contains shared logic for network scanning (`getNetworkNodes`), server penetration (`penetrate`), RAM checks (`hasRam`), and threshold calculation (`getThresholds`).

---

## 6. Specialized Automation Systems

### 6.1. Economic & Infrastructure Engines

#### `hn.js` (Hacknet Manager)
*   **Logic:** Continuously evaluates the cost-to-benefit ratio of upgrading Hacknet nodes. It prioritizes levels, then RAM, then cores based on the production increase per dollar spent.

#### `aps-lite.js` (Server Purchaser)
*   **Logic:** Late-game automated server buyer. It waits until the player has enough money to buy the maximum possible RAM (up to 2^20 GB) for all 25 server slots, replacing smaller servers as funds allow.

#### `print-stock-forecast.js`
*   **Logic:** Requires TIX API and 4S Data. It prints a formatted table of all stocks, including their current price, volatility, and most importantly, the probability of the price increasing (forecast).

### 6.2. Miscellaneous Solvers

#### `contract-solver.js`
*   **Logic:** Automatically identifies and solves Coding Contracts found on servers. It contains dedicated algorithms for various math and logic puzzles (e.g., "Find All Valid Math Expressions", "Spiralize Matrix", "Merge Overlapping Intervals").

#### `infiltration.js`
*   **Logic:** Automates the infiltration minigame. It uses simulated inputs to clear security layers of various corporations to gain faction reputation or money.

#### `gangs_buy_all.js`
*   **Logic:** Automated management for Gangs. It handles purchasing equipment for all gang members, prioritizing combat or hacking gear depending on the gang's focus.

### 6.3. Miscellaneous Hacking & Utility

#### `exploit-and-backdoor.js`
*   **Logic:** Orchestrates the automatic opening of ports (SSH, FTP, etc.), nuking servers, and then using Singularity functions to pathfind and install backdoors on every accessible public server.

#### `se.js` (Stock Exchange Engine)
*   **Logic:** A sophisticated stock trader. It requires 4S Data and TIX API. It identifies the "Whale" (largest holding) and broadcasts it to Port 16, allowing the DarkNet worms to promote that specific stock via propaganda to increase volatility and profits. It also manages long and short positions based on forecast thresholds.

#### `find-targets.js`
*   **Logic:** A scoring engine that ranks public servers based on their maximum money and minimum security. It is used by `launch-fleets.js` to determine which servers are currently most profitable to target.

#### `contract-solver.js`
*   **Logic:** Automatically scans for and solves Coding Contracts across the entire network. Supports a wide array of contract types with specialized algorithms.

#### `dev-tools.js` / `dev-tools-v2.js`
*   **Purpose:** Development utilities for debugging the DarkNet. Includes functions to print the entire network topology, dump all known passwords, and track server migration events.

#### `render-maze.js`
*   **Logic:** A high-level visualization tool that creates a standalone UI window (using the Netscript UI API) to render a live "Radar" view of a Labyrinth's topology. It reads the `maze-[name].json` files generated by `dnet-monitor.js` and draws a pixel-perfect map with room coordinates and frontier indicators.

#### `kill-network-scripts.js`
*   **Logic:** A "Nuclear Option" utility that recursively scans the entire network and kills every running script on every server. Useful for a hard reset of the automation system.

#### `clean-stasis.js`
*   **Logic:** Utility to remove all active stasis links across the network, freeing up the stasis link limit for re-allocation to more critical nodes.

#### `check-depths.js`
*   **Logic:** Scans all unlocked DarkNet servers and prints their "depth" (distance from home) to the terminal, allowing the user to identify how deep into the network the worms have penetrated.

#### `local-hack.js`
*   **Logic:** A simple, low-RAM script designed to run on the player's `home` machine or small servers. It continuously executes a basic Hack/Grow/Weaken loop against a local target (usually `n00dles` or `joesguns`) to provide a baseline income and hacking experience gain.

#### `gimme-money.js` / `[action]-pirate.js`
*   **Purpose:** These are the "Worker" payloads. `gimme-money.js` is a self-contained HGW script for the early-game `auto-deploy.js`. The `pirate.js` variants are single-threaded, specialized scripts for Hack, Grow, or Weaken, designed to be executed in massive batches by the late-game `launch-fleets.js` engine.

### 6.4. Auxiliary Tools and Data

#### `darknet-keys.js` / `darknet-words.txt`
*   **Data:** These files serve as the persistent memory for the DarkNet ecosystem. `darknet-keys.js` stores the JSON-encoded vault of all cracked server passwords. `darknet-words.txt` is an ever-growing dictionary of strings harvested from the network, used as candidates for word-based authentication models.

#### `bb-save-tool.py`
*   **Purpose:** An external Python utility designed to parse and manipulate BitBurner save files. It can be used to extract data or perform "surgery" on a save state outside of the game environment.

#### `share.js`
*   **Logic:** A utility script that consumes all available RAM on a server to run `ns.share()`, which increases the player's Faction Reputation gain rate.

#### `stan.js`
*   **Logic:** Automated manager for "Stanek's Gift". It places and rotates fragments on the Stanek grid to maximize the bonus to various stats (Hacking, Strength, etc.).

#### `improve-study.js`
*   **Logic:** A Singularity-based automation script that sends the player to a university to study a specific course (e.g., Computer Science) to gain experience while AFK.

#### `gtfo.js`
*   **Purpose:** Preparation script for installing Augmentations or prestiging. It stops the stock trader, alerts the player to check final items, and kills all running scripts to save state.

#### `increase-mega.js`
*   **Logic:** Spends Hacknet hashes to increase the maximum money of `megacorp`, which is often the most lucrative target for late-game hacking fleets.

#### `heart.js`
*   **Purpose:** Simple utility to display the player's current "Karma" (negative value representing crime activity).
