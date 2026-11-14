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
    postMessage('step: priming done');

    self.fonts.load('32px Times, paddedAhem', String.fromCharCode(0x13A0) + String.fromCharCode(0x0301))
        .then(function() {
            postMessage('PASS if no crash, faces ' + faces.map(function(f) { return f.status; }).join(','));
        })
        .catch(function(e) {
            postMessage('FAIL load rejected: ' + e.message);
        });

} catch(e) {
    postMessage('FAIL exception: ' + e.message + ' — stack: ' + e.stack);
}
