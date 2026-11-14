// FontCascade::fallbackRangesAt hands out a reference into
// FontCascadeFonts::m_realizedFallbackRanges. Resolving a character walks those ranges and
// resolves fonts with ExternalResourceDownloadPolicy::Allow, which on a worker completes the
// load synchronously and reaches FontCascadeCache::pruneUnreferencedEntries, destroying the
// FontCascadeFonts being walked.

function paddedFontDataURL(path, paddingLength)
{
    const fontRequest = new XMLHttpRequest();
    fontRequest.open('GET', path, false);
    fontRequest.responseType = 'arraybuffer';
    fontRequest.send();
    // Padding keeps the data URL over the 1 MB limit in
    // CSSFontFaceSource::opportunisticallyStartFontDataURLLoading, so the face stays Pending
    // until the walk below pumps it.
    const padding = new Uint8Array(paddingLength);
    const blob = new Blob([fontRequest.response, padding], { type: 'font/woff' });
    return new FileReaderSync().readAsDataURL(blob);
}

const dataURL = paddedFontDataURL('../../../resources/Ahem.woff', 800000);

// One family with several distinct requests, so the walk pumps several times and each pump
// runs FontCascade::update and advances FontCascadeCache's prune counter.
const faceCount = 4;
const faces = [];
for (let faceIndex = 0; faceIndex < faceCount; ++faceIndex) {
    const face = new FontFace('paddedAhem', 'url("' + dataURL + '#' + faceIndex + '")');
    faces.push(face);
    self.fonts.add(face);
}

// Bring the prune counter to one below its interval so that a pump during the walk crosses it.
// self.fonts.check() triggers a synchronous FontCascade lookup in FontCascadeCache,
// incrementing its prune counter — the same mechanism that canvas context.font = ... uses.
for (let primeIndex = 0; primeIndex < 1000 - faceCount; ++primeIndex)
    self.fonts.check('11px primingFamily' + primeIndex, 'a');

// Times has no glyph for U+13A0, so self.fonts.load() walks the cascade down to paddedAhem.
// In a worker, the load triggered during this walk completes synchronously, reaching
// FontCascadeCache::pruneUnreferencedEntries — this is what causes the UAF without the fix.
self.fonts.load('32px Times, paddedAhem', String.fromCharCode(0x13A0) + String.fromCharCode(0x0301))
    .then(() => postMessage(faces.map(face => face.status).join(',')))
    .catch(e => postMessage('error: ' + e.message));
