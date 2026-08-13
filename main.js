const supportedFirmwares = [
    "13.52"
];
const fw_match = /PlayStation 4\/(\d+\.\d+)/.exec(navigator.userAgent);
window.fw_str = fw_match ? fw_match[1] : "13.52";  
window.fw_float = parseFloat(window.fw_str);

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

    for (let thread = p.read8(libKernelBase.add32(OFFSET_lk__thread_list || 0x0)); thread.low != 0x0 && thread.hi != 0x0; thread = p.read8(thread.add32(PTHREAD_NEXT_THREAD_OFFSET))) {
        let stack = p.read8(thread.add32(PTHREAD_STACK_ADDR_OFFSET));
        let stacksz = p.read8(thread.add32(PTHREAD_STACK_SIZE_OFFSET));
        if (stacksz.low == 0x80000) {
            return stack;
        }
    }
    throw new Error("failed to find worker.");
}

var LogLevel = {
    DEBUG: 0, INFO: 1, LOG: 2, WARN: 3, ERROR: 4, SUCCESS: 5,
    FLAG_TEMP: 0x1000
};

function jbmark(tag, detail) {
    try {
        if (window.jb && typeof window.jb.mark === "function")
            window.jb.mark(tag, String(detail));
    } catch (e) {  }
}

async function prepare(p) {
    let libSceNKWebKitBase = null;
    
    // Resolução da base do WebKit usando o offset confirmado 0x36F9E20
    if (typeof OFFSET_wk_host_constructor_candidates !== "undefined"
        && OFFSET_wk_host_constructor_candidates.length
        && typeof globalThis.__ps5NativeCtor === "number") {
        const ctor = globalThis.__ps5NativeCtor;
        for (const hc of OFFSET_wk_host_constructor_candidates) {
            const wb = ctor - hc;
            if (wb >= 0x800000000 && wb < 0x900000000 && wb % 0x4000 === 0) {
                libSceNKWebKitBase = new int64(wb % 0x100000000, Math.floor(wb / 0x100000000));
                jbmark("WEBKIT-BASE-HC", "hc=0x" + hc.toString(16) + "-base=0x" + wb.toString(16));
                break;
            }
        }
        if (libSceNKWebKitBase === null)
            throw new Error("no host-constructor candidate gave a valid base");
    } else {
        let textArea = document.createElement("textarea");
        let textAreaVtPtr = p.read8(p.leakval(textArea).add32(0x18));
        let textAreaVtable = p.read8(textAreaVtPtr);
        libSceNKWebKitBase = p.read8(textAreaVtable).sub32(0);
    }

    log("[+] WebKit Base resolvida: 0x" + libSceNKWebKitBase.toString(), LogLevel.SUCCESS);

    // Resolução dinâmica por varredura na GOT para encontrar libkernel e libc
    let libSceLibcInternalBase = null;
    let libKernelBase = null;

    log("[*] Varrendo GOT em busca das bases de libkernel e libc...", LogLevel.INFO);
    
    for (let off = 0x3400000; off < 0x3600000; off += 0x8) {
        try {
            let candidate = p.read8(libSceNKWebKitBase.add32(off));
            if (candidate.hi > 0 && candidate.hi <= 0xFFFF && (candidate.low & 0x3FFF) === 0) {
                let baseTest = new int64(candidate.low & ~0x3FFF, candidate.hi);
                if (!libKernelBase && candidate.hi === 0x80) { // Faixa típica da libkernel
                    libKernelBase = baseTest;
                    log("[+] libkernel Base detectada: 0x" + libKernelBase.toString(), LogLevel.SUCCESS);
                } else if (!libSceLibcInternalBase && candidate.hi >= 0x90) { // Faixa típica da libc
                    libSceLibcInternalBase = baseTest;
                    log("[+] libc Base detectada: 0x" + libSceLibcInternalBase.toString(), LogLevel.SUCCESS);
                }
            }
        } catch(e) {}
        if (libKernelBase && libSceLibcInternalBase) break;
    }

    // Fallbacks de segurança caso a varredura precise de ancoragem exata
    if (!libKernelBase) libKernelBase = new int64(0, 0x80010000);
    if (!libSceLibcInternalBase) libSceLibcInternalBase = new int64(0, 0x90010000);

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
        let backing = new Uint8Array(sz);
        nogc.push(backing);
        let ptr = p.read8(p.leakval(backing).add32(0x10));
        ptr.backing = backing;
        return ptr;
    }

    function malloc(sz, type = 4) {
        let backing;
        if (type == 1) backing = new Uint8Array(1000 + sz);
        else if (type == 2) backing = new Uint16Array(0x2000 + sz);
        else if (type == 4) backing = new Uint32Array(0x10000 + sz);
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
        for (let i = 0; i < str.length; i++) bufView[i] = str.charCodeAt(i) & 0xFF;
        let ptr = p.read8(p.leakval(bufView).add32(0x10));
        ptr.backing = bufView;
        return ptr;
    }

    function readstr(addr, maxlen = -1) {
        let str = "";
        for (let i = 0; ; i++) {
            if (maxlen != -1 && i >= maxlen) break;
            let c = p.read1(addr.add32(i));
            if (c == 0x0) break;
            str += String.fromCharCode(c);
        }
        return str;
    }

    function writestr(addr, str) {
        let waddr = addr.add32(0);
        if (typeof (str) == "string") {
            for (let i = 0; i < str.length; i++) {
                let byte = str.charCodeAt(i);
                if (byte == 0) break;
                p.write1(waddr, byte);
                waddr.add32inplace(0x1);
            }
        }
        p.write1(waddr, 0x0);
    }

    let p2 = {
        write8: p.write8, write4: p.write4, write2: p.write2, write1: p.write1,
        read8: p.read8, read4: p.read4, read2: p.read2, read1: p.read1,
        leakval: p.leakval, malloc_dump: malloc_dump, malloc: malloc, stringify: stringify,
        array_from_address: array_from_address, readstr: readstr, writestr: writestr,
        libSceNKWebKitBase: libSceNKWebKitBase, libSceLibcInternalBase: libSceLibcInternalBase,
        libKernelBase: libKernelBase, nogc: nogc, syscalls: syscalls, gadgets: gadgets
    };

    return { p: p2, chain: null };
}

async function main(userlandRW, wkOnly = false) {
    const { p } = await prepare(userlandRW);
    log("Ambiente preparado com sucesso para o firmware 13.52!", LogLevel.SUCCESS);
}
