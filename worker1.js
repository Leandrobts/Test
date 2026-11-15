const width = 640;
const height = 360;
let availableBuffer = null;

// Recebe o buffer reciclado da thread principal
onmessage = function(e) {
    if (e.data.buffer) {
        availableBuffer = e.data.buffer;
    }
};

// Aloca o primeiro buffer na inicialização
availableBuffer = new ArrayBuffer(width * height * 4);

let x = 100, y = 100, speedX = 4, speedY = 3, boxSize = 60;

function renderLoop() {
    if (!availableBuffer) return;
    const buffer = availableBuffer;
    availableBuffer = null; // consome o buffer atual

    const data = new Uint8ClampedArray(buffer);
    
    // Limpa o frame (fundo cinza escuro)
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = 30;  // R
        data[i + 1] = 30;  // G
        data[i + 2] = 30;  // B
        data[i + 3] = 255; // A
    }

    // Atualiza lógica da animação (ex: quadrado móvel)
    x += speedX;
    y += speedY;
    if (x <= 0 || x + boxSize >= width) speedX = -speedX;
    if (y <= 0 || y + boxSize >= height) speedY = -speedY;

    // Desenha o quadrado azul no buffer de pixels
    for (let py = y; py < y + boxSize; py++) {
        for (let px = x; px < x + boxSize; px++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                data[idx]     = 0;   // R
                data[idx + 1] = 150; // G
                data[idx + 2] = 255; // B
            }
        }
    }

    // Envia o buffer de volta para a thread principal como Transferable
    postMessage({ buffer, width, height }, [buffer]);
}

// Roda a ~60 FPS
setInterval(renderLoop, 1000 / 60);
