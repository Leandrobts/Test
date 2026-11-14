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

const dataURL = paddedFontDataURL('Ahem.woff', 800000);

// OffscreenCanvas is not available on this platform; send the data URL to the
// main thread so it can create FontFace objects and perform canvas operations there.
postMessage(dataURL);
