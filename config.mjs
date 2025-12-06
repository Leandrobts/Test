/* config.mjs - Atualizado para FW 12.00 */

// ... (código de copyright anterior) ...

function check_bcd(value) {
    for (let i = 0; i <= 12; i += 4) {
        const nibble = (value >>> i) & 0xf;
        if (nibble > 9) return false;
    }
    return true;
}

export function set_target(value) {
    if (!Number.isInteger(value)) throw TypeError(`value not an integer: ${value}`);
    // Aceita até 12.00 (0xC00)
    if (value >= 0x20000 || value < 0) throw RangeError(`value invalid: ${value}`);
    
    // Se for 12.00, representamos como 0xC00 (C = 12 em hex)
    target = value;
}

export let target = null;
// 0xC00 = 12.00
set_target(0xC00);
