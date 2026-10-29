// In a worker, loading a small data: URL font completes synchronously, so the
// pre-warm loop in CSSFontSelector::opportunisticallyStartFontDataURLLoading
// resolves FontFace.loaded and runs author script while it is still iterating.
// That script calls FontFaceSet.add(), which clears CSSFontFaceSet::m_cache.

function fontDataURL(path)
{
    const fontRequest = new XMLHttpRequest();
    fontRequest.open('GET', path, false);
    fontRequest.responseType = 'arraybuffer';
    fontRequest.send();
    return new FileReaderSync().readAsDataURL(new Blob([fontRequest.response], { type: 'font/woff' }));
}

const dataUrl = fontDataURL('Ahem.woff');

const face1 = new FontFace('testFace', 'url("' + dataUrl + '")');
const face2 = new FontFace('testFace', 'url("' + dataUrl + '")');
self.fonts.add(face1);
self.fonts.add(face2);

// Populating the deferred promise makes resolution observable below.
void face1.loaded;
void face2.loaded;

const reenterFontFaceSet = function () {
    self.fonts.add(new FontFace('unrelated', 'local("nonexistent")'));
};
Object.defineProperty(face1, 'then', { get: reenterFontFaceSet });
Object.defineProperty(face2, 'then', { get: reenterFontFaceSet });

// Criar Canvas convencional
const canvas = document.createElement('canvas');

canvas.width = 10;
canvas.height = 10;

// Obter contexto 2D
const context = canvas.getContext('2d');

if (!context) {
    throw new Error('Canvas 2D indisponível');
}

// Manter a mesma configuração de fonte
context.font = '10px Times, testFace';

// Manter o mesmo caractere do teste original
const result = context.measureText(
    String.fromCharCode(0x13A0)
);

// Confirmar a execução
console.log('measureText executado:', result.width);
console.log('done');
window.postMessage('done', '*');
