
// generated from libSceNKWebKit / libkernel_web / libSceLibcInternal
// file offset ≈ rva + 0x4000  |  RVA = loadBase-relative (1º LOAD VA 0)
// PS4 13.52 — offsets extraídos do SYMTAB/JMPREL SCE
//
// Confirmado via ASLR:
//   __ps5NativeCtor=0x8036F9E20 → base=0x800000000
//   __ps5NativeCtor=0x81CBF9E20 → base=0x819500000
// Offset fixo: 0x36F9E20
const OFFSET_wk_host_constructor_candidates = [
    0x36F9E20
];

const OFFSET_wk_vtable_first_element = 0x0; // TODO

// --- WebKit GOT/import slots (RVA do slot; valor = ponteiro resolvido) ---
const OFFSET_wk_memset_import              = 0x3CB8CB8; // NID 8zTFvBIAIN8
const OFFSET_wk_memcpy_import              = 0x3CB8C38; // NID Q3VBxCXhUHs
const OFFSET_wk_malloc_import              = 0x3CBA008; // NID gQX+4GDQjpM
// __stack_chk_guard não tem entrada JMPREL; usar __stack_chk_fail:
const OFFSET_wk___stack_chk_fail_import    = 0x3CB8C30; // NID Ou3iL1abvng
const OFFSET_wk___stack_chk_guard_import   = 0x3CB8C30; // alias → fail (para o trecho mínimo)

// --- libSceLibcInternal ---
const OFFSET_lc_memset     = 0x27350;
const OFFSET_lc_memcpy     = 0x26AD0;
const OFFSET_lc_malloc     = 0x28D60;
const OFFSET_lc_free       = 0x28D70;
const OFFSET_lc_vsnprintf  = 0x12B50;
const OFFSET_lc_setjmp     = 0xD32D0;
const OFFSET_lc_longjmp    = 0xD3320;
const OFFSET_lc_memcmp     = 0xD3460;
const OFFSET_lc_strcmp     = 0xD35D0;

// --- libkernel_web ---
const OFFSET_lk___stack_chk_fail           = 0x29F50;
const OFFSET_lk___stack_chk_guard          = 0x29F50; // alias: trecho mínimo usa fail
const OFFSET_lk___stack_chk_guard_data     = 0x61410; // variável (Object), não função
const OFFSET_lk_sceKernelSendNotificationRequest = 0x8B0;
const OFFSET_lk_sceKernelDlsym             = 0x2E50;
const OFFSET_lk_sceKernelUsleep            = 0x4F40;
const OFFSET_lk_sysctlbyname               = 0x7410;
const OFFSET_lk_pthread_create_name_np     = 0xA020;
const OFFSET_lk_usleep                     = 0xF560;
const OFFSET_lk_scePthreadAttrInit         = 0xFEC0;
const OFFSET_lk_pthread_create             = 0x10110;
const OFFSET_lk_sceKernelSleep             = 0x10DA0;
const OFFSET_lk_sceKernelGetCurrentCpu     = 0x140C0;
const OFFSET_lk_scePthreadAttrSetstacksize = 0x15F40;
const OFFSET_lk_pthread_join               = 0x1AEC0;
const OFFSET_lk_scePthreadAttrSetdetachstate = 0x1AFF0;
const OFFSET_lk_scePthreadAttrDestroy      = 0x213E0;
const OFFSET_lk_pthread_exit               = 0x235C0;
const OFFSET_lk_sleep                      = 0x24A00;
const OFFSET_lk_scePthreadJoin             = 0x27970;
const OFFSET_lk_scePthreadCreate           = 0x29F30;
const OFFSET_lk_getpid                     = 0x2CB70;

const OFFSET_lk__thread_list               = 0x0; // interno
const OFFSET_lk_worker_wait_return         = 0x0; // interno
const OFFSET_WORKER_STACK_OFFSET           = 0x0; // layout do exploit

let wk_gadgetmap = {};
let syscall_map = {};
