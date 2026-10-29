// Adaptação: mantém a preparação original no Worker, mas a medição
// acontece na página HTML, pois document não existe em Workers.
// NÃO é reprodução equivalente do teste original de UAF.

function fontDataURL(path) {
    var fontRequest = new XMLHttpRequest();
    fontRequest.open('GET', path, false);
    fontRequest.responseType = 'arraybuffer';
    fontRequest.send();
    if (fontRequest.status && (fontRequest.status < 200 || fontRequest.status >= 300))
        throw new Error('Falha ao carregar fonte: HTTP ' + fontRequest.status);
    return new FileReaderSync().readAsDataURL(
        new Blob([fontRequest.response], { type: 'font/woff' })
    );
}

try {
    if (typeof FontFace === 'undefined' || !self.fonts)
        throw new Error('FontFace ou self.fonts indisponível no Worker');
    if (typeof FileReaderSync === 'undefined')
        throw new Error('FileReaderSync indisponível no Worker');

    var dataUrl = fontDataURL('Ahem.woff');
    var face1 = new FontFace('testFace', 'url("' + dataUrl + '")');
    var face2 = new FontFace('testFace', 'url("' + dataUrl + '")');
    self.fonts.add(face1);
    self.fonts.add(face2);

    void face1.loaded;
    void face2.loaded;

    var reenterFontFaceSet = function () {
        self.fonts.add(new FontFace('unrelated', 'local("nonexistent")'));
    };
    Object.defineProperty(face1, 'then', { get: reenterFontFaceSet });
    Object.defineProperty(face2, 'then', { get: reenterFontFaceSet });

    // Solicita medição à página. Fontes no Worker não são necessariamente
    // compartilhadas com o FontFaceSet do documento principal.
    self.postMessage({
        type: 'measure-text',
        font: '10px Times, testFace',
        character: 0x13A0
    });
} catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
}

self.onmessage = function (event) {
    if (event.data && event.data.type === 'measurement-complete')
        self.postMessage({ type: 'done' });
    else if (event.data && event.data.type === 'measurement-error')
        self.postMessage({ type: 'error', message: event.data.message });
};
