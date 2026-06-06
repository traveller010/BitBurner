import { getNetworkNodes } from "./utils.js";

// Global tracking set to prevent logging duplicate unknown contract types
const reportedUnknownContracts = new Set();

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    const tick = 60_000; // Check the network for new contracts once every minute

    // Configured to match our central matrix logging layout
    const PORT_SUCCESS = 15;
    const PORT_DIAG = 14;

    // =========================================================================
    // 🔀 THE ROUTER MAP
    // Maps exact Bitburner game contract strings to their translated algorithms
    // =========================================================================
    const solvers = {
        // Base Matrix Solvers
        "Caesar Cipher": caesarCipher,
        "Algorithmic Stock Trader II": stockTraderII,
        "Array Jumping Game": arrayJumpingGame,
        "Largest Prime Factor": largestPrimeFactor,
        "Unique Paths in a Grid I": uniquePathsI,
        "Sanitize Parentheses in Expression": sanitizeParentheses,
        "Total Number of Primes": totalNumberOfPrimes,
        "Subarray with Maximum Sum": subarrayMaxSum,
        "Compression I: RLE Compression": rleCompression,
        "Find All Valid Math Expressions": findMathExpressions,
        "Proper 2-Coloring of a Graph": proper2Coloring,
        "Minimum Path Sum in a Triangle": minPathSumTriangle,

        // Upgraded Cryptographic & Optimization Network Solvers
        "Total Ways to Sum II": totalWaysToSumII,
        "Find Largest Prime Factor": findLargestPrimeFactor,
        "Algorithmic Stock Trader IV": algorithmicStockTraderIV,
        "HammingCodes: Encoded Binary to Integer": hammingDecodeToInteger,
        "Generate IP Addresses": generateIPAddresses,
        "Compression II: LZ Decompression": lzDecompressII,
        "Square Root": bigIntSqrt,
        "Unique Paths in a Grid II": uniquePathsII,
        "Algorithmic Stock Trader III": stockTraderIII,
        "Spiralize Matrix": spiralizeMatrix,
        "Encryption I: Caesar Cipher": caesarCipherI,
        "Shortest Path in a Grid": shortestPathInGrid,
        "Merge Overlapping Intervals": mergeIntervals,
        "Algorithmic Stock Trader I": stockTraderI,
        "Compression III: LZ Compression": lzCompressIII,
        "Array Jumping Game II": arrayJumpingGameII,
        "HammingCodes: Integer to Encoded Binary": hammingEncode,
        "Largest Rectangle in a Matrix": largestRectangle,
        "Encryption II: Vigenère Cipher": vigenereCipher,
        "Total Ways to Sum": totalWaysToSum
    };

    ns.tprint("🟢 [SYSTEM] Coding Contract Solver Daemon initialized and running.");

    while (true) {
        const servers = getNetworkNodes(ns);

        for (const server of servers) {
            const files = ns.ls(server, ".cct");

            for (const file of files) {
                const type = ns.codingcontract.getContractType(file, server);
                const data = ns.codingcontract.getData(file, server);

                if (solvers[type]) {
                    ns.print(`🕵️‍♂️ Found contract: "${type}" on ${server}. Attempting solution...`);

                    try {
                        // Execute the corresponding mathematical solver
                        const answer = solvers[type](data);

                        // Submit the solution to the game engine
                        const reward = ns.codingcontract.attempt(answer, file, server);

                        if (reward) {
                            ns.tprint(`✅ [REWARD] Solved "${type}" on ${server}! Reward claimed: ${reward}`);
                            // SUCCESS CHANNEL: Pipe the win data directly to darknet-success.txt
                            ns.tryWritePort(PORT_SUCCESS, `[CONTRACT-SOLVED] [${server}] Cracked ${file} (${type})! Reward: ${reward}`);
                        } else {
                            ns.tprint(`❌ [FAILURE] Solver returned an incorrect answer for "${type}" on ${server}. Check logic.`);
                            // DIAGNOSTICS CHANNEL: Send math mismatch metrics to darknet-diagnostics.txt
                            ns.tryWritePort(PORT_DIAG, `[CONTRACT-FAIL] [${server}] Incorrect submission for ${file} (${type}) with answer: ${JSON.stringify(answer)}`);
                        }
                    } catch (err) {
                        ns.tprint(`💥 [ERROR] Solver crashed while processing "${type}" on ${server}: ${err}`);
                        // DIAGNOSTICS CHANNEL: Catch execution context errors
                        ns.tryWritePort(PORT_DIAG, `[CONTRACT-CRASH] [${server}] Logic exception on ${file} (${type}) | ${err}`);
                    }
                } else {
                    ns.print(`⚠️ [UNSUPPORTED] Found contract type "${type}" on ${server} but no solver is written for it yet.`);

                    // 🛡️ THE DEDUPLICATION SHIELD: Only log this type if we haven't processed it yet
                    if (!reportedUnknownContracts.has(type)) {
                        // Dynamically pull the exact problem description text from the server file
                        let description = ns.codingcontract.getDescription(file, server);

                        // Clean up line breaks for single-row log parsing harmony
                        let cleanDesc = description.replace(/\n/g, " ").replace(/\s+/g, " ");

                        // Send the full brief straight to darknet-diagnostics.txt via Port 14
                        ns.tryWritePort(PORT_DIAG, `[UNKNOWN CONTRACT] Host: ${server} | File: ${file} | Type: "${type}" | Problem: ${cleanDesc}`);
                        ns.tprint(`[UNKNOWN CONTRACT] Host: ${server} | File: ${file} | Type: "${type}" | Problem: ${cleanDesc}`);

                        // Lock it into our known tracking ledger
                        reportedUnknownContracts.add(type);
                    }
                }
            }
        }

        await ns.sleep(tick);
    }
}

// =========================================================================
// 🧮 TRANSLATED PYTHON MATHEMATICAL SOLVERS
// =========================================================================

function caesarCipher(data) {
    const [plaintext, shift] = data;
    return plaintext.toUpperCase().split('').map(char => {
        if (/[A-Z]/.test(char)) {
            return String.fromCharCode(((char.charCodeAt(0) - 65 - shift) % 26 + 26) % 26 + 65);
        }
        return char;
    }).join('');
}

function stockTraderII(prices) {
    let maxProfit = 0;
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) {
            maxProfit += prices[i] - prices[i - 1];
        }
    }
    return maxProfit;
}

function arrayJumpingGame(nums) {
    let maxReach = 0;
    const lastIndex = nums.length - 1;
    for (let i = 0; i < nums.length; i++) {
        if (i > maxReach) return 0;
        maxReach = Math.max(maxReach, i + nums[i]);
        if (maxReach >= lastIndex) return 1;
    }
    return 1;
}

function largestPrimeFactor(n) {
    let factor = 2;
    while (factor * factor <= n) {
        if (n % factor === 0) {
            n = Math.floor(n / factor);
        } else {
            factor++;
        }
    }
    return n;
}

function uniquePathsI(dimensions) {
    const [rows, cols] = dimensions;
    const down = rows - 1;
    const right = cols - 1;
    const total = down + right;
    let k = Math.min(down, right);
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (total - k + i) / i;
    }
    return Math.round(res);
}

function sanitizeParentheses(s) {
    function isValid(str) {
        let balance = 0;
        for (const char of str) {
            if (char === '(') balance++;
            else if (char === ')') {
                balance--;
                if (balance < 0) return false;
            }
        }
        return balance === 0;
    }

    let currentLevel = new Set([s]);
    while (currentLevel.size > 0) {
        const validMatches = Array.from(currentLevel).filter(isValid);
        if (validMatches.length > 0) return validMatches;

        const nextLevel = new Set();
        for (const str of currentLevel) {
            for (let i = 0; i < str.length; i++) {
                if (str[i] === '(' || str[i] === ')') {
                    nextLevel.add(str.slice(0, i) + str.slice(i + 1));
                }
            }
        }
        currentLevel = nextLevel;
    }
    return [""];
}

function totalNumberOfPrimes(range) {
    const [start, end] = range;
    if (end < 2) return 0;

    const isPrime = new Array(end + 1).fill(true);
    isPrime[0] = isPrime[1] = false;

    for (let p = 2; p * p <= end; p++) {
        if (isPrime[p]) {
            for (let i = p * p; i <= end; i += p) {
                isPrime[i] = false;
            }
        }
    }

    let count = 0;
    for (let i = Math.max(2, start); i <= end; i++) {
        if (isPrime[i]) count++;
    }
    return count;
}

function subarrayMaxSum(nums) {
    if (nums.length === 0) return 0;
    let maxSoFar = nums[0];
    let currentMax = nums[0];

    for (let i = 1; i < nums.length; i++) {
        currentMax = Math.max(nums[i], currentMax + nums[i]);
        maxSoFar = Math.max(maxSoFar, currentMax);
    }
    return maxSoFar;
}

function rleCompression(s) {
    if (!s) return "";
    const encoded = [];
    let currentChar = s[0];
    let currentCount = 1;

    for (let i = 1; i < s.length; i++) {
        if (s[i] === currentChar) {
            currentCount++;
        } else {
            while (currentCount > 9) {
                encoded.push(`9${currentChar}`);
                currentCount -= 9;
            }
            if (currentCount > 0) {
                encoded.push(`${currentCount}${currentChar}`);
            }
            currentChar = s[i];
            currentCount = 1;
        }
    }

    while (currentCount > 9) {
        encoded.push(`9${currentChar}`);
        currentCount -= 9;
    }
    if (currentCount > 0) {
        encoded.push(`${currentCount}${currentChar}`);
    }

    return encoded.join('');
}

function findMathExpressions(data) {
    const [num, target] = data;
    const res = [];
    if (!num) return res;

    function dfs(index, path, prevOperand, currentVal) {
        if (index === num.length) {
            if (currentVal === target) res.push(path);
            return;
        }

        for (let i = index; i < num.length; i++) {
            if (i > index && num[index] === '0') break;

            const currStr = num.slice(index, i + 1);
            const currVal = parseInt(currStr, 10);

            if (index === 0) {
                dfs(i + 1, currStr, currVal, currVal);
            } else {
                dfs(i + 1, path + '+' + currStr, currVal, currentVal + currVal);
                dfs(i + 1, path + '-' + currStr, -currVal, currentVal - currVal);
                dfs(i + 1, path + '*' + currStr, prevOperand * currVal, (currentVal - prevOperand) + (prevOperand * currVal));
            }
        }
    }

    dfs(0, "", 0, 0);
    return res;
}

function proper2Coloring(data) {
    const [numVertices, edges] = data;
    const graph = {};

    for (let i = 0; i < numVertices; i++) graph[i] = [];
    for (const [u, v] of edges) {
        graph[u].push(v);
        graph[v].push(u);
    }

    const colors = new Array(numVertices).fill(-1);

    for (let startNode = 0; startNode < numVertices; startNode++) {
        if (colors[startNode] === -1) {
            const queue = [startNode];
            colors[startNode] = 0;

            while (queue.length > 0) {
                const currentNode = queue.shift();
                const currentColor = colors[currentNode];
                const neighborColor = 1 - currentColor;

                for (const neighbor of graph[currentNode]) {
                    if (colors[neighbor] === -1) {
                        colors[neighbor] = neighborColor;
                        queue.push(neighbor);
                    } else if (colors[neighbor] === currentColor) {
                        return [];
                    }
                }
            }
        }
    }
    return colors;
}

function minPathSumTriangle(triangle) {
    if (!triangle || triangle.length === 0) return 0;
    const dp = [...triangle[triangle.length - 1]];

    for (let row = triangle.length - 2; row >= 0; row--) {
        for (let col = 0; col < triangle[row].length; col++) {
            dp[col] = triangle[row][col] + Math.min(dp[col], dp[col + 1]);
        }
    }
    return dp[0];
}

function lzDecompressII(data) {
    let output = "";
    let i = 0;
    let isType1 = true;
    
    while (i < data.length) {
        let L = parseInt(data[i], 10);
        i++;
        
        if (L === 0) {
            isType1 = !isType1;
            continue;
        }
        
        if (isType1) {
            output += data.substring(i, i + L);
            i += L;
        } else {
            let X = parseInt(data[i], 10);
            i++;
            for (let j = 0; j < L; j++) {
                output += output[output.length - X];
            }
        }
        isType1 = !isType1;
    }
    return output;
}

function bigIntSqrt(data) {
    let val = BigInt(data);
    if (val < 0n) return "0";
    if (val === 0n || val === 1n) return val.toString();
    
    let x = val;
    let y = (x + 1n) / 2n;
    while (y < x) {
        x = y;
        y = (x + val / x) / 2n;
    }
    
    let lower = x;
    let upper = x + 1n;
    let diffLower = val - lower * lower;
    let diffUpper = upper * upper - val;
    
    return (diffLower < diffUpper ? lower : upper).toString();
}

function uniquePathsII(grid) {
    if (!grid || grid.length === 0 || grid[0].length === 0) return 0;
    let R = grid.length;
    let C = grid[0].length;
    let dp = Array(C).fill(0);
    
    dp[0] = grid[0][0] === 0 ? 1 : 0;
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            if (grid[r][c] === 1) {
                dp[c] = 0;
            } else if (c > 0) {
                dp[c] += dp[c - 1];
            }
        }
    }
    return dp[C - 1];
}

function stockTraderIII(prices) {
    let hold1 = -Infinity, hold2 = -Infinity;
    let release1 = 0, release2 = 0;
    
    for (let price of prices) {
        hold1 = Math.max(hold1, -price);
        release1 = Math.max(release1, hold1 + price);
        hold2 = Math.max(hold2, release1 - price);
        release2 = Math.max(release2, hold2 + price);
    }
    return release2;
}

function spiralizeMatrix(matrix) {
    let result = [];
    if (!matrix || matrix.length === 0) return result;
    
    let top = 0, bottom = matrix.length - 1;
    let left = 0, right = matrix[0].length - 1;
    
    while (top <= bottom && left <= right) {
        for (let i = left; i <= right; i++) result.push(matrix[top][i]);
        top++;
        for (let i = top; i <= bottom; i++) result.push(matrix[i][right]);
        right--;
        if (top <= bottom) {
            for (let i = right; i >= left; i--) result.push(matrix[bottom][i]);
            bottom--;
        }
        if (left <= right) {
            for (let i = bottom; i >= top; i--) result.push(matrix[i][left]);
            left++;
        }
    }
    return result;
}

function caesarCipherI(data) {
    let text = data[0];
    let shift = data[1];
    let result = "";
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (char >= 'A' && char <= 'Z') {
            let code = text.charCodeAt(i);
            let encoded = ((code - 65 - shift) % 26 + 26) % 26 + 65;
            result += String.fromCharCode(encoded);
        } else {
            result += char;
        }
    }
    return result;
}

function shortestPathInGrid(grid) {
    let R = grid.length;
    let C = grid[0].length;
    if (grid[0][0] === 1 || grid[R - 1][C - 1] === 1) return "";
    
    let queue = [[0, 0, ""]];
    let visited = Array.from({ length: R }, () => Array(C).fill(false));
    visited[0][0] = true;
    
    let dirs = [
        [1, 0, "D"],
        [-1, 0, "U"],
        [0, 1, "R"],
        [0, -1, "L"]
    ];
    
    while (queue.length > 0) {
        let [r, c, path] = queue.shift();
        if (r === R - 1 && c === C - 1) return path;
        
        for (let [dr, dc, move] of dirs) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < R && nc >= 0 && nc < C && !visited[nr][nc] && grid[nr][nc] === 0) {
                visited[nr][nc] = true;
                queue.push([nr, nc, path + move]);
            }
        }
    }
    return "";
}

function mergeIntervals(intervals) {
    if (intervals.length <= 1) return intervals;
    intervals.sort((a, b) => a[0] - b[0]);
    
    let merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        let current = intervals[i];
        let last = merged[merged.length - 1];
        
        if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current);
        }
    }
    return merged;
}

function stockTraderI(prices) {
    let maxProfit = 0;
    let minPrice = Infinity;
    
    for (let p of prices) {
        if (p < minPrice) minPrice = p;
        else if (p - minPrice > maxProfit) maxProfit = p - minPrice;
    }
    return maxProfit;
}

function lzCompressIII(input) {
    let n = input.length;
    let dp = Array.from({ length: n + 1 }, () => [null, null]);
    dp[0][0] = "";
    
    for (let i = 0; i <= n; i++) {
        if (dp[i][0] !== null) {
            let s = dp[i][0] + "0";
            if (dp[i][1] === null || s.length < dp[i][1].length) dp[i][1] = s;
        }
        if (dp[i][1] !== null) {
            let s = dp[i][1] + "0";
            if (dp[i][0] === null || s.length < dp[i][0].length) dp[i][0] = s;
        }

        for (let L = 1; L <= 9; L++) {
            if (i + L > n) break;

            if (dp[i][0] !== null) {
                let s = dp[i][0] + L + input.substr(i, L);
                if (dp[i + L][1] === null || s.length < dp[i + L][1].length) dp[i + L][1] = s;
            }

            if (dp[i][1] !== null) {
                for (let X = 1; X <= 9; X++) {
                    let valid = true;
                    for (let j = 0; j < L; j++) {
                        if (i + j - X < 0 || input[i + j] !== input[i + j - X]) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        let s = dp[i][1] + L + X;
                        if (dp[i + L][0] === null || s.length < dp[i + L][0].length) dp[i + L][0] = s;
                    }
                }
            }
        }
    }
    
    let res0 = dp[n][0], res1 = dp[n][1];
    if (res0 === null) return res1;
    if (res1 === null) return res0;
    return res0.length < res1.length ? res0 : res1;
}

function arrayJumpingGameII(arr) {
    if (arr.length <= 1) return 0;
    let jumps = 0, currentEnd = 0, farthest = 0;
    
    for (let i = 0; i < arr.length - 1; i++) {
        farthest = Math.max(farthest, i + arr[i]);
        if (i === currentEnd) {
            jumps++;
            currentEnd = farthest;
            if (currentEnd >= arr.length - 1) return jumps;
        }
        if (i >= farthest) return 0; 
    }
    return currentEnd >= arr.length - 1 ? jumps : 0;
}

function hammingEncode(value) {
    let bin = value.toString(2);
    let data = bin.split("").map(Number);
    let n = data.length;
    
    let arr = [0]; 
    let dataIdx = 0;
    let i = 1;
    
    while (dataIdx < n) {
        if ((i & (i - 1)) === 0) {
            arr.push(0); 
        } else {
            arr.push(data[dataIdx]);
            dataIdx++;
        }
        i++;
    }
    
    for (let p = 1; p < arr.length; p *= 2) {
        let count = 0;
        for (let j = p; j < arr.length; j++) {
            if ((j & p) !== 0) {
                count += arr[j];
            }
        }
        arr[p] = count % 2;
    }
    
    let totalOnes = 0;
    for (let j = 1; j < arr.length; j++) {
        totalOnes += arr[j];
    }
    arr[0] = totalOnes % 2;
    
    return arr.join("");
}

function largestRectangle(matrix) {
    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return [];
    const R = matrix.length;
    const C = matrix[0].length;
    let maxArea = 0;
    let bestCoords = [[0, 0], [0, 0]];

    for (let r1 = 0; r1 < R; r1++) {
        const validCol = Array(C).fill(true);
        for (let r2 = r1; r2 < R; r2++) {
            // Update column validity for the current row stretch
            for (let c = 0; c < C; c++) {
                if (matrix[r2][c] === 1) {
                    validCol[c] = false;
                }
            }
            
            // Find the maximum consecutive sequence of open columns
            let currentWidth = 0;
            for (let c = 0; c < C; c++) {
                if (validCol[c]) {
                    currentWidth++;
                    const area = (r2 - r1 + 1) * currentWidth;
                    if (area > maxArea) {
                        maxArea = area;
                        bestCoords = [[r1, c - currentWidth + 1], [r2, c]];
                    }
                } else {
                    currentWidth = 0;
                }
            }
        }
    }
    return bestCoords;
}

function vigenereCipher(data) {
    const plaintext = data[0].toUpperCase();
    const keyword = data[1].toUpperCase();
    let result = "";
    let keyIdx = 0;
    
    for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext[i];
        if (char >= 'A' && char <= 'Z') {
            const pCode = char.charCodeAt(0) - 65;
            const kCode = keyword.charCodeAt(keyIdx % keyword.length) - 65;
            const cCode = (pCode + kCode) % 26 + 65;
            result += String.fromCharCode(cCode);
            keyIdx++; // Key index only progresses on valid alphabetic shifts
        } else {
            result += char; // Preserves spaces seamlessly
        }
    }
    return result;
}

function totalWaysToSum(data) {
    // In Bitburner, the data payload for this contract is a primitive integer N
    const n = parseInt(data, 10);
    if (isNaN(n) || n < 1) return 0;

    // dp[j] stores the number of unique combinations to sum up to value j
    const dp = new Array(n + 1).fill(0);
    
    // Base case: There is exactly 1 way to sum up to 0 (using an empty set)
    dp[0] = 1;

    // Iterate through all possible summands from 1 up to N - 1
    // (We stop at N-1 because the single summand N is barred by the 'at least two integers' rule)
    for (let i = 1; i < n; i++) {
        for (let j = i; j <= n; j++) {
            dp[j] += dp[j - i];
        }
    }

    return dp[n];
}

function generateIPAddresses(data) {
    const s = String(data);
    const result = [];
    const len = s.length;

    // Helper utility to validate individual IPv4 octet rules
    const isValidOctet = (p) => {
        if (p.length > 1 && p[0] === '0') return false; // Leading zero veto
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255;
    };

    // Iterate through all possible lengths for the first three octets (1 to 3 digits)
    for (let i = 1; i <= 3; i++) {
        for (let j = 1; j <= 3; j++) {
            for (let k = 1; k <= 3; k++) {
                // Determine the remaining length for the fourth octet
                let m = len - i - j - k;
                
                // Validate if the fourth octet falls within a legal 1-3 digit length boundary
                if (m >= 1 && m <= 3) {
                    let p1 = s.substring(0, i);
                    let p2 = s.substring(i, i + j);
                    let p3 = s.substring(i + j, i + j + k);
                    let p4 = s.substring(i + j + k);

                    // Confirm all four segments meet structural criteria before logging
                    if (isValidOctet(p1) && isValidOctet(p2) && isValidOctet(p3) && isValidOctet(p4)) {
                        result.push(`${p1}.${p2}.${p3}.${p4}`);
                    }
                }
            }
        }
    }

    return result;
}

function hammingDecodeToInteger(data) {
    const arr = String(data).split("").map(Number);
    const len = arr.length;
    let errPosition = 0;

    // Compute the bitwise error parity syndrome index
    for (let i = 1; i < len; i++) {
        if (arr[i] === 1) {
            errPosition ^= i;
        }
    }

    // If an altered bit is detected via a non-zero syndrome, execute correction
    if (errPosition !== 0 && errPosition < len) {
        arr[errPosition] = arr[errPosition] === 1 ? 0 : 1;
    }

    // Strip parity flags (skipping index 0 and all power-of-two coordinates)
    const dataBits = [];
    for (let i = 1; i < len; i++) {
        if ((i & (i - 1)) !== 0) {
            dataBits.push(arr[i]);
        }
    }

    return parseInt(dataBits.join(""), 2);
}

function totalWaysToSumII(data) {
    const target = data[0];
    const set = data[1];
    
    // DP array tracking combination counts per value step
    const dp = new Array(target + 1).fill(0);
    dp[0] = 1; // Base case baseline

    for (const num of set) {
        for (let i = num; i <= target; i++) {
            dp[i] += dp[i - num];
        }
    }

    return dp[target];
}

function findLargestPrimeFactor(data) {
    let n = Number(data);
    let maxPrime = -1;

    // Eliminate even numbers from the loop pool
    while (n % 2 === 0) {
        maxPrime = 2;
        n /= 2;
    }

    // Step through remaining odd values up to the square root boundary
    for (let i = 3; i * i <= n; i += 2) {
        while (n % i === 0) {
            maxPrime = i;
            n /= i;
        }
    }

    // If remaining value is a prime greater than 2, it is our maximum
    if (n > 2) {
        maxPrime = n;
    }

    return maxPrime;
}

function algorithmicStockTraderIV(data) {
    const k = data[0];
    const prices = data[1];

    if (!prices || prices.length < 2 || k === 0) return 0;

    // OPTIMIZATION SHORTCUT: If transactions exceed half the days, grab every positive delta
    if (k >= prices.length / 2) {
        let maxProfit = 0;
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                maxProfit += prices[i] - prices[i - 1];
            }
        }
        return maxProfit;
    }

    // Bounded DP layer tracking maximum transaction windows
    let dp = new Array(prices.length).fill(0);

    for (let t = 1; t <= k; t++) {
        let nextDp = new Array(prices.length).fill(0);
        let maxDiff = -prices[0]; 

        for (let d = 1; d < prices.length; d++) {
            nextDp[d] = Math.max(nextDp[d - 1], prices[d] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[d] - prices[d]);
        }
        dp = nextDp;
    }

    return dp[prices.length - 1];
}

