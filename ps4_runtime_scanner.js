// ============================================================================
// PS4 13.52 — Runtime Offset Scanner (standalone, non-module)
// ============================================================================
// Este arquivo deve ser carregado DINAMICAMENTE pelo index.html APÓS
// window.p estar ativo. Não use "type=module" ao carregá-lo.
//
// Requisitos prévios (definidos pelo exploit):
//   - window.p      (read/write primitive)
//   - window.int64  (classe int64)
//   - window.__ps5NativeCtor  (endereço do construtor nativo)
//
// O index.html chama este script via:
//   const s = document.createElement('script');
//   s.src = './ps4_runtime_scanner.js';
//   document.body.appendChild(s);
// ============================================================================

(function() {
  'use strict';

  // ─── Aguardar window.p ───────────────────────────────────────────────────
  if (!window.p || !window.int64) {
    console.error('[scanner] window.p ou window.int64 não disponíveis!');
    return;
  }

  const p = window.p;
  const int64 = window.int64;

  const SCAN_START = 0x800000000;
  const SCAN_END   = 0x900000000;
  const STEP       = 0x4000;

  // ─── Helpers DOM ─────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const log = (m, c='i') => {
    const con = $('con');
    if (!con) { console.log(m); return; }
    const d = document.createElement('div');
    d.className = c;
    d.textContent = m;
    con.appendChild(d);
    con.scrollTop = 9e9;
  };
  const setStatus = (m, s='r') => {
    const st = $('st'), dot = $('dot');
    if (st) st.textContent = m;
    if (dot) dot.className = s;
  };
  const setProg = (pct, show=true) => {
    const pbw = $('pb-w'), pb = $('pb');
    if (pbw) pbw.style.display = show ? 'block' : 'none';
    if (pb) pb.style.width = Math.min(100, pct) + '%';
  };

  // ─── Helpers memória ─────────────────────────────────────────────────────
  function readString(addr, maxLen=200) {
    let s = '';
    for (let i = 0; i < maxLen; i++) {
      let c = p.read1(addr + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function readU64(addr) {
    let v = p.read8(addr);
    return (BigInt(v.hi) << 32n) | BigInt(v.low >>> 0);
  }

  function addrNum(addr) {
    if (typeof addr === 'number') return addr;
    if (typeof addr === 'bigint') return Number(addr);
    if (addr.low !== undefined && addr.hi !== undefined)
      return Number((BigInt(addr.hi) << 32n) | BigInt(addr.low >>> 0));
    return Number(addr);
  }

  function addrStr(addr) {
    let n = addrNum(addr);
    return '0x' + n.toString(16).padStart(16, '0');
  }

  function n64(n) {
    const h = Math.floor(n / 0x100000000) >>> 0;
    const l = (n - h * 0x100000000) >>> 0;
    return new int64(l, h);
  }

  // ─── 1. Encontrar bases ELF ──────────────────────────────────────────────
  function findElfBases(start, end) {
    const bases = [];
    for (let addr = start; addr < end; addr += STEP) {
      try {
        let magic = p.read4(addr);
        if (magic === 0x464c457f) bases.push(addr);
      } catch (e) {}
    }
    return bases;
  }

  // ─── 2. Identificar módulos ──────────────────────────────────────────────
  function identifyModule(base) {
    const checks = [
      { str: 'libkernel_web', name: 'libkernel' },
      { str: 'libkernel',     name: 'libkernel' },
      { str: 'pthread_create',name: 'libkernel' },
      { str: 'sceKernelGetCurrentCpu', name: 'libkernel' },
      { str: 'libSceLibcInternal', name: 'libc' },
      { str: 'memset',        name: 'libc' },
      { str: 'malloc',        name: 'libc' },
      { str: 'libSceNKWebKit',name: 'webkit' },
      { str: 'WebKit',        name: 'webkit' },
    ];
    for (let off = 0; off < 0x400000; off += 0x40) {
      try {
        let s = readString(base + off, 80);
        for (let c of checks) {
          if (s.includes(c.str)) return c.name;
        }
      } catch (e) {}
    }
    return 'unknown';
  }

  // ─── 3. Scan imports WebKit ──────────────────────────────────────────────
  function findImportsToModule(wkBase, libBase, libSize, scanSize) {
    const imports = [];
    const libBaseN = addrNum(libBase);
    for (let off = 0; off < scanSize; off += 8) {
      try {
        let ptr = readU64(wkBase + off);
        if (ptr >= BigInt(libBaseN) && ptr < BigInt(libBaseN + libSize)) {
          imports.push({ wkOffset: off, target: Number(ptr) });
        }
      } catch (e) {}
    }
    return imports;
  }

  // ─── 4. Identificar memset ───────────────────────────────────────────────
  function isMemset(addr) {
    try {
      let b0 = p.read1(addr);
      let b1 = p.read1(addr + 1);
      let b2 = p.read1(addr + 2);
      if (b0 === 0x48 && b1 === 0x89 && b2 === 0xF8) return true; // mov rax, rdi
      if (b0 === 0x48 && b1 === 0x85 && b2 === 0xD2) return true; // test rdx, rdx
      if (b0 === 0x48 && b1 === 0x89 && b2 === 0xF7) return true; // mov rdi, rsi
    } catch (e) {}
    return false;
  }

  // ─── 5. Identificar __stack_chk_guard ────────────────────────────────────
  function isStackChkGuard(addr) {
    try {
      let val = readU64(addr);
      let low = Number(val & 0xFFFFFFFFn);
      if ((low & 0xFF) === 0x00 && val !== 0n) {
        let ptrVal = Number(val);
        if (ptrVal < 0x7000000000 || ptrVal > 0x9000000000) return true;
      }
    } catch (e) {}
    return false;
  }

  // ─── 6. Scan gadgets ─────────────────────────────────────────────────────
  function findGadgets(base, size) {
    const gadgets = {};
    const patterns = {
      'ret':        { bytes: [0xC3], mask: [0xFF] },
      'pop rdi':    { bytes: [0x5F, 0xC3], mask: [0xFF, 0xFF] },
      'pop rsi':    { bytes: [0x5E, 0xC3], mask: [0xFF, 0xFF] },
      'pop rdx':    { bytes: [0x5A, 0xC3], mask: [0xFF, 0xFF] },
      'pop rcx':    { bytes: [0x59, 0xC3], mask: [0xFF, 0xFF] },
      'pop rax':    { bytes: [0x58, 0xC3], mask: [0xFF, 0xFF] },
      'pop rsp':    { bytes: [0x5C, 0xC3], mask: [0xFF, 0xFF] },
      'pop r8':     { bytes: [0x41, 0x58, 0xC3], mask: [0xFF, 0xFF, 0xFF] },
      'pop r9':     { bytes: [0x41, 0x59, 0xC3], mask: [0xFF, 0xFF, 0xFF] },
      'mov [rdi], rsi': { bytes: [0x48, 0x89, 0x37, 0xC3], mask: [0xFF, 0xFF, 0xFF, 0xFF] },
      'mov [rdi], rax': { bytes: [0x48, 0x89, 0x07, 0xC3], mask: [0xFF, 0xFF, 0xFF, 0xFF] },
      'mov [rdi], eax': { bytes: [0x89, 0x07, 0xC3], mask: [0xFF, 0xFF, 0xFF] },
      'mov rax, [rax]': { bytes: [0x48, 0x8B, 0x00, 0xC3], mask: [0xFF, 0xFF, 0xFF, 0xFF] },
      'add rax, rcx':   { bytes: [0x48, 0x01, 0xC8, 0xC3], mask: [0xFF, 0xFF, 0xFF, 0xFF] },
    };

    for (let off = 0; off < size; off += 8) {
      try {
        let qword = readU64(base + off);
        let bytes = [];
        let tmp = qword;
        for (let i = 0; i < 8; i++) {
          bytes.push(Number(tmp & 0xFFn));
          tmp >>= 8n;
        }
        for (let [name, pat] of Object.entries(patterns)) {
          if (gadgets[name]) continue;
          let patLen = pat.bytes.length;
          for (let start = 0; start <= 8 - patLen; start++) {
            let match = true;
            for (let i = 0; i < patLen; i++) {
              if ((bytes[start + i] & pat.mask[i]) !== pat.bytes[i]) {
                match = false; break;
              }
            }
            if (match) {
              gadgets[name] = off + start;
              break;
            }
          }
        }
      } catch (e) {}
    }
    return gadgets;
  }

  // ─── 7. Scan syscalls ────────────────────────────────────────────────────
  function findSyscalls(lkBase, size) {
    const syscalls = {};
    for (let off = 0; off < size; off += 1) {
      try {
        if (p.read1(lkBase + off)      === 0x48 &&
            p.read1(lkBase + off + 1)  === 0xC7 &&
            p.read1(lkBase + off + 2)  === 0xC0 &&
            p.read1(lkBase + off + 7)  === 0x49 &&
            p.read1(lkBase + off + 8)  === 0x89 &&
            p.read1(lkBase + off + 9)  === 0xCA &&
            p.read1(lkBase + off + 10) === 0x0F &&
            p.read1(lkBase + off + 11) === 0x05 &&
            p.read1(lkBase + off + 12) === 0xC3) {
          let num = p.read4(lkBase + off + 3);
          syscalls[num] = off;
        }
      } catch (e) {}
    }
    return syscalls;
  }

  // ─── 8. Achar _thread_list ───────────────────────────────────────────────
  function findThreadList(lkBase, lkSize) {
    const dataStart = lkBase + 0x50000;
    const dataEnd   = lkBase + Math.min(lkSize, 0x300000);
    for (let off = dataStart; off < dataEnd; off += 8) {
      try {
        let threadPtr = readU64(off);
        if (threadPtr === 0n) continue;
        let tp = Number(threadPtr);
        if (tp < 0x100000000 || tp > 0xffffffffffff) continue;
        let stackAddr = readU64(tp + 0xA8);
        let stackSize = readU64(tp + 0xB0);
        let sa = Number(stackAddr);
        if (sa > 0x7000000000 && sa < 0x8000000000 && stackSize === 0x80000n) {
          let next = readU64(tp + 0x38);
          let n = Number(next);
          if (n === 0 || (n > 0x100000000 && n < 0xffffffffffff)) {
            return off - lkBase;
          }
        }
      } catch (e) {}
    }
    return -1;
  }

  // ─── 9. Achar worker_wait_return ─────────────────────────────────────────
  function findWorkerWaitReturn(lkBase, lkSize) {
    for (let off = 0; off < lkSize; off += 1) {
      try {
        if (p.read1(lkBase + off)     === 0x48 &&
            p.read1(lkBase + off + 1) === 0x8B &&
            p.read1(lkBase + off + 2) === 0x47 &&
            p.read1(lkBase + off + 3) === 0x38) {
          let b4 = p.read1(lkBase + off + 4);
          let b5 = p.read1(lkBase + off + 5);
          if (b4 === 0x48 && b5 === 0x85) return off;
        }
      } catch (e) {}
    }
    return -1;
  }

  // ─── MAIN ────────────────────────────────────────────────────────────────
  async function main() {
    log('', 'i');
    log('=== RUNTIME SCANNER INICIADO ===', 's');
    setStatus('Scanner em execução...', 'r');

    const ctorN = globalThis.__ps5NativeCtor;
    if (!ctorN) {
      setStatus('__ps5NativeCtor ausente', 'e');
      log('ERRO: __ps5NativeCtor não definido', 'e');
      return;
    }

    const CTOR_RVA = 0x36F9E20;
    const wkBase = n64(ctorN - CTOR_RVA);
    log('[+] WebKit Base = ' + addrStr(wkBase), 'ok');

    // 1. Bases ELF
    log('', 'i');
    log('=== [1/8] Scan ELF headers ===', 's');
    const bases = findElfBases(SCAN_START, SCAN_END);
    log('Módulos ELF encontrados: ' + bases.length, 'i');

    const moduleMap = {};
    for (const base of bases) {
      const name = identifyModule(base);
      if (name !== 'unknown' && !moduleMap[name]) {
        moduleMap[name] = base;
        log('  ' + name + ': ' + addrStr(base), 'ok');
      }
    }

    if (!moduleMap.webkit) moduleMap.webkit = addrNum(wkBase);
    const wkBaseN = moduleMap.webkit;
    const lkBase = moduleMap.libkernel || 0;
    const lcBase = moduleMap.libc || 0;

    if (!lkBase || !lcBase) {
      log('ERRO: libkernel ou libc não encontrados via ELF scan', 'e');
      log('Tentando usar bases fixas conhecidas do FW 13.52...', 'w');
      // Bases fixas típicas do PS4 13.52 (ajuste se necessário)
      // moduleMap.libkernel = 0x8045c74000;
      // moduleMap.libc = 0x93840fc000;
    }

    // 2. Imports
    log('', 'i');
    log('=== [2/8] Scan WebKit imports ===', 's');
    const libcImports = lcBase ? findImportsToModule(wkBaseN, lcBase, 0x400000, 0x4000000) : [];
    const lkImports   = lkBase ? findImportsToModule(wkBaseN, lkBase, 0x400000, 0x4000000) : [];
    log('Imports libc: ' + libcImports.length, 'i');
    log('Imports libkernel: ' + lkImports.length, 'i');

    // 3. memset
    log('', 'i');
    log('=== [3/8] Identificando memset ===', 's');
    let wk_memset_import = -1, lc_memset = -1;
    for (const imp of libcImports) {
      if (isMemset(imp.target)) {
        wk_memset_import = imp.wkOffset;
        lc_memset = imp.target - lcBase;
        log('  memset: wk+0x' + wk_memset_import.toString(16) + ' → lc+0x' + lc_memset.toString(16), 'ok');
        break;
      }
    }
    if (wk_memset_import === -1) log('  AVISO: memset não identificado', 'w');

    // 4. __stack_chk_guard
    log('', 'i');
    log('=== [4/8] Identificando __stack_chk_guard ===', 's');
    let wk_scg_import = -1, lk_scg = -1;
    for (const imp of lkImports) {
      if (isStackChkGuard(imp.target)) {
        wk_scg_import = imp.wkOffset;
        lk_scg = imp.target - lkBase;
        log('  __stack_chk_guard: wk+0x' + wk_scg_import.toString(16) + ' → lk+0x' + lk_scg.toString(16), 'ok');
        break;
      }
    }
    if (wk_scg_import === -1) log('  AVISO: __stack_chk_guard não identificado', 'w');

    // 5. Gadgets
    log('', 'i');
    log('=== [5/8] Scan ROP gadgets ===', 's');
    setStatus('Scan gadgets...', 'r');
    const gadgets = findGadgets(wkBaseN, 0x2000000);
    for (let [name, off] of Object.entries(gadgets)) {
      log('  ' + name + ' @ +0x' + off.toString(16), 'ok');
    }

    // 6. Syscalls
    log('', 'i');
    log('=== [6/8] Scan syscalls ===', 's');
    setStatus('Scan syscalls...', 'r');
    const syscalls = lkBase ? findSyscalls(lkBase, 0x200000) : {};
    let scCount = Object.keys(syscalls).length;
    log('Syscalls encontrados: ' + scCount, 'ok');
    const important = [0x14, 0x1, 0x3, 0x4, 0x5, 0x6, 0x7, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C];
    for (let num of important) {
      if (syscalls[num] !== undefined) {
        log('  syscall 0x' + num.toString(16) + ' @ +0x' + syscalls[num].toString(16), 'a');
      }
    }

    // 7. _thread_list
    log('', 'i');
    log('=== [7/8] Scan _thread_list ===', 's');
    let threadListOff = lkBase ? findThreadList(lkBase, 0x400000) : -1;
    if (threadListOff !== -1) log('  _thread_list: +0x' + threadListOff.toString(16), 'ok');
    else log('  AVISO: _thread_list não encontrado', 'w');

    // 8. worker_wait_return
    log('', 'i');
    log('=== [8/8] Scan worker_wait_return ===', 's');
    let workerWaitOff = lkBase ? findWorkerWaitReturn(lkBase, 0x200000) : -1;
    if (workerWaitOff !== -1) log('  worker_wait_return: +0x' + workerWaitOff.toString(16), 'ok');
    else log('  AVISO: worker_wait_return não encontrado', 'w');

    // ─── Gerar output ──────────────────────────────────────────────────────
    log('', 'i');
    log('=== GERANDO 13_52.js ===', 's');

    let out = [];
    out.push('// PS4 FW 13.52 — Offsets descobertos em runtime');
    out.push('// WebKit Base: ' + addrStr(wkBaseN));
    out.push('// libkernel Base: ' + (lkBase ? addrStr(lkBase) : 'NAO_ENCONTRADO'));
    out.push('// libc Base: ' + (lcBase ? addrStr(lcBase) : 'NAO_ENCONTRADO'));
    out.push('');
    out.push('const OFFSET_wk_host_constructor_candidates = [');
    out.push('  0x' + CTOR_RVA.toString(16) + ' // __ps5NativeCtor - wkBase');
    out.push('];');
    out.push('');
    out.push('const OFFSET_wk_vtable_first_element = 0x0;');
    if (wk_memset_import !== -1) {
      out.push('const OFFSET_wk_memset_import = 0x' + wk_memset_import.toString(16) + ';');
    } else {
      out.push('const OFFSET_wk_memset_import = 0x0; // TODO');
    }
    if (wk_scg_import !== -1) {
      out.push('const OFFSET_wk___stack_chk_guard_import = 0x' + wk_scg_import.toString(16) + ';');
    } else {
      out.push('const OFFSET_wk___stack_chk_guard_import = 0x0; // TODO');
    }
    out.push('');
    if (lc_memset !== -1) {
      out.push('const OFFSET_lc_memset = 0x' + lc_memset.toString(16) + ';');
    } else {
      out.push('const OFFSET_lc_memset = 0x0; // TODO');
    }
    out.push('const OFFSET_lc_malloc = 0x0; // TODO');
    out.push('const OFFSET_lc_free = 0x0; // TODO');
    out.push('const OFFSET_lc_memcpy = 0x0; // TODO');
    out.push('const OFFSET_lc_setjmp = 0x0; // TODO');
    out.push('const OFFSET_lc_longjmp = 0x0; // TODO');
    out.push('');
    if (lk_scg !== -1) {
      out.push('const OFFSET_lk___stack_chk_guard = 0x' + lk_scg.toString(16) + ';');
    } else {
      out.push('const OFFSET_lk___stack_chk_guard = 0x0; // TODO');
    }
    out.push('const OFFSET_lk_pthread_create_name_np = 0x0; // TODO');
    out.push('const OFFSET_lk_pthread_join = 0x0; // TODO');
    out.push('const OFFSET_lk_pthread_exit = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadCreate = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadJoin = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadAttrInit = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadAttrSetstacksize = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadAttrSetdetachstate = 0x0; // TODO');
    out.push('const OFFSET_lk_scePthreadAttrDestroy = 0x0; // TODO');
    out.push('const OFFSET_lk_sceKernelSendNotificationRequest = 0x0; // TODO');
    out.push('const OFFSET_lk_getpid = 0x0; // TODO');
    if (threadListOff !== -1) {
      out.push('const OFFSET_lk__thread_list = 0x' + threadListOff.toString(16) + ';');
    } else {
      out.push('const OFFSET_lk__thread_list = 0x0; // TODO');
    }
    if (workerWaitOff !== -1) {
      out.push('const OFFSET_lk_worker_wait_return = 0x' + workerWaitOff.toString(16) + ';');
    } else {
      out.push('const OFFSET_lk_worker_wait_return = 0x0; // TODO');
    }
    out.push('const OFFSET_lk_sleep = 0x0; // TODO');
    out.push('const OFFSET_lk_sceKernelGetCurrentCpu = 0x0; // TODO');
    out.push('');
    out.push('let wk_gadgetmap = {');
    for (let [name, off] of Object.entries(gadgets)) {
      out.push('  "' + name + '": 0x' + off.toString(16) + ',');
    }
    out.push('};');
    out.push('');
    out.push('let syscall_map = {');
    let scKeys = Object.keys(syscalls).map(Number).sort((a,b) => a - b);
    for (let num of scKeys) {
      out.push('  0x' + num.toString(16).padStart(3, '0') + ': 0x' + syscalls[num].toString(16) + ',');
    }
    out.push('};');

    let finalOutput = out.join('\n');

    const outPre = $('out-pre');
    const outBox = $('out-box');
    if (outPre) outPre.textContent = finalOutput;
    if (outBox) outBox.style.display = 'block';

    window.scannerOutput = finalOutput;
    setStatus('Scanner completo! Copie o output abaixo.', 'ok');
    log('', 'i');
    log('✅ Scanner concluído. Copie o código acima e salve como 13.52.js', 'ok');
  }

  // Executar
  main().catch(e => {
    setStatus('Scanner falhou: ' + e.message, 'e');
    log('FATAL: ' + e.message, 'e');
    console.error(e);
  });
})();
