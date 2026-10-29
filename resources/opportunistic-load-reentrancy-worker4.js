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

// Como o worker está na mesma pasta resources/ que o Ahem.woff, o caminho é direto:
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

// Solicita à Thread Principal que execute a medição com o elemento <canvas> do DOM
postMessage({ 
    action: 'MEASURE', 
    font: '10px Times, testFace', 
    text: String.fromCharCode(0x13A0) 
});

// Recebe a resposta da thread principal e finaliza o teste
onmessage = function(e) {
    if (e.data && (e.data.status === 'success' || e.data.status === 'error')) {
        console.log('done');
        postMessage('done');
    }
};
