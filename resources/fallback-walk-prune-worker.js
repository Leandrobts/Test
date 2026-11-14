self.addEventListener('unhandledrejection', function(event) {
    postMessage('FAIL unhandledrejection: ' + event.reason);
});

function paddedFontDataURL(path, paddingLength)
{
    const fontRequest = new XMLHttpRequest();
    fontRequest.open('GET', path, false);
    fontRequest.responseType = 'arraybuffer';
    fontRequest.send();
    const padding = new Uint8Array(paddingLength);
    const blob = new Blob([fontRequest.response, padding], { type: 'font/woff' });
    return new FileReaderSync().readAsDataURL(blob);
}

try {
    postMessage('step: start');

    postMessage('step: self.fonts = ' + (typeof self.fonts));

    const dataURL = paddedFontDataURL('Ahem.woff', 800000);
    postMessage('step: dataURL ok, length = ' + dataURL.length);

    const faceCount = 4;
    const faces = [];
    for (let faceIndex = 0; faceIndex < faceCount; ++faceIndex) {
        const face = new FontFace('paddedAhem', 'url("' + dataURL + '#' + faceIndex + '")');
        faces.push(face);
        self.fonts.add(face);
    }
    postMessage('step: faces added');

    postMessage('step: self.fonts.check = ' + (typeof self.fonts.check));
    postMessage('step: self.fonts.load  = ' + (typeof self.fonts.load));

    for (let primeIndex = 0; primeIndex < 1000 - faceCount; ++primeIndex)
        self.fonts.check('11px primingFamily' + primeIndex, 'a');
    // ... (paddedFontDataURL e setup das faces igual antes) ...

postMessage('step: priming done');

// Teste 1: face.load() individual funciona?
faces[0].load()
    .then(function() { postMessage('step: face[0].load() resolveu, status = ' + faces[0].status); })
    .catch(function(e) { postMessage('step: face[0].load() error: ' + e.message); });

// Teste 2: carregar só paddedAhem sem Times
self.fonts.load('32px paddedAhem', 'a')
    .then(function(loaded) { postMessage('step: fonts.load(paddedAhem) resolveu, count = ' + loaded.length); })
    .catch(function(e) { postMessage('step: fonts.load(paddedAhem) error: ' + e.message); });

// Sentinela: sempre dispara para sabermos o estado real
setTimeout(function() {
    postMessage('TIMEOUT faces: ' + faces.map(function(f) { return f.status; }).join(','));
}, 4000);

} catch(e) {
    postMessage('FAIL exception: ' + e.message + ' — stack: ' + e.stack);
}
