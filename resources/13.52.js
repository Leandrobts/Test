// ============================================================
// PS4 Firmware 13.52 — Offsets do WebKit
// ============================================================
//
// OFFSET_wk_host_constructor_candidates
//   Distância fixa do __ps5NativeCtor (NativeConstructor do JSC)
//   até a base do ELF do WebKit (libSceNKWebKit.sprx).
//
//   Confirmado por 2 runs com ASLR diferente:
//     Run1: 0x8036F9E20 − 0x036F9E20 = 0x800000000  ✅ (% 0x4000 = 0)
//     Run2: 0x81CBF9E20 − 0x036F9E20 = 0x819500000  ✅ (% 0x4000 = 0)
//
//   O ASLR do PS4 13.52 usa granularidade de pelo menos 0x100000 (1 MB),
//   e o binário é carregado com alinhamento de 0x4000 (16 KB) ou maior.
//   O offset dentro do binário é estático (não muda com ASLR).
//
const OFFSET_wk_host_constructor_candidates = [0x036F9E20];

// Range observado do ASLR do WebKit no PS4 13.52
// (baseado nas duas runs: 0x800000000 e 0x819500000)
const WK_ASLR_LOW  = 0x800000000;
const WK_ASLR_HIGH = 0x900000000;

// Alinhamento mínimo confirmado para a base do WebKit
// PS4 usa páginas de 4KB mas o loader alinha o SPRX a pelo menos 16KB
const WK_BASE_ALIGN = 0x4000;

// ============================================================
// Offsets ainda desconhecidos — serão preenchidos após
// o primeiro run completo com o ELF scan resolver as bases:
//
//   OFFSET_wk___stack_chk_guard_import  → slot da GOT do WebKit
//   OFFSET_lk___stack_chk_guard         → offset em libkernel
//   OFFSET_wk_memset_import             → slot da GOT do WebKit
//   OFFSET_lc_memset                    → offset em libc
//
// Quando esses forem conhecidos, a resolução de libkernel e libc
// também fica instantânea (igual ao PS5), sem precisar da GOT scan.
// ============================================================
