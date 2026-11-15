// Mock do contexto 2D que serializa chamadas para a thread principal
class WorkerContextProxy {
    constructor() {
        this._fillStyle = '#000';
    }
    set fillStyle(val) {
        this._fillStyle = val;
        postMessage({ type: 'setProperty', property: 'fillStyle', value: val });
    }
    get fillStyle() {
        return this._fillStyle;
    }
    fillRect(x, y, w, h) {
        postMessage({ type: 'call', method: 'fillRect', args: [x, y, w, h] });
    }
    clearRect(x, y, w, h) {
        postMessage({ type: 'call', method: 'clearRect', args: [x, y, w, h] });
    }
}

// Mock do objeto Canvas
class WorkerCanvasProxy {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.ctx = new WorkerContextProxy();
    }
    getContext(type) {
        if (type === '2d') return this.ctx;
        throw new Error('Apenas contexto 2D é suportado neste proxy.');
    }
}

// Instância simulada para enganar o script do teste
const canvas = new WorkerCanvasProxy(640, 360);
const ctx = canvas.getContext('2d');

let x = 50, y = 50, speedX = 5, speedY = 4, size = 50;

function renderLoop() {
    // Comandos de desenho gerados no Worker
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    x += speedX;
    y += speedY;
    if (x <= 0 || x + size >= canvas.width) speedX = -speedX;
    if (y <= 0 || y + size >= canvas.height) speedY = -speedY;

    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x, y, size, size);
}

// Roda a ~60 FPS
setInterval(renderLoop, 1000 / 60);
