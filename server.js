/* =========================================================
   PROCESADOR PROXY Y REESCRITOR DE MANIFIESTOS M3U8 (CON FILTRO DE MÁXIMA CALIDAD)
========================================================= */
async function procesarPlaylistProxy(streamUrl, req, res, referer = '') {
    try {
        const headers = { 'User-Agent': USER_AGENT };
        if (referer) {
            headers['Referer'] = referer;
            headers['Origin'] = new URL(referer).origin;
        }

        const respuesta = await axios.get(streamUrl, {
            httpAgent: agenteParaUrl(streamUrl),
            httpsAgent: agenteParaUrl(streamUrl),
            timeout: 8000,
            responseType: 'text',
            headers
        });

        const baseUrl = obtenerBaseUrl(req);
        const contenido = respuesta.data;
        const lineas = contenido.split(/\r?\n/);

        // DETECCIÓN: Si es una lista Maestra (Master Playlist) con múltiples calidades
        if (contenido.includes('#EXT-X-STREAM-INF')) {
            let mejoresCalidades = [];
            let currentStreamInf = null;

            for (let i = 0; i < lineas.length; i++) {
                const linea = lineas[i].trim();
                if (linea.startsWith('#EXT-X-STREAM-INF:')) {
                    currentStreamInf = linea;
                } else if (linea && !linea.startsWith('#') && currentStreamInf) {
                    const urlAbsoluta = new URL(linea, streamUrl).href;
                    
                    // Extraer ancho de banda y resolución para priorizar la más alta
                    let bandwidth = 0;
                    let resolution = 0;

                    const bwMatch = currentStreamInf.match(/BANDWIDTH=(\d+)/);
                    if (bwMatch) bandwidth = parseInt(bwMatch[1], 10);

                    const resMatch = currentStreamInf.match(/RESOLUTION=(\d+x\d+)/);
                    if (resMatch) {
                        const [w, h] = resMatch[1].split('x').map(Number);
                        resolution = h; // Usamos la altura (ej. 1080, 720, 480) como referencia principal
                    }

                    mejoresCalidades.push({
                        streamInf: currentStreamInf,
                        url: urlAbsoluta,
                        bandwidth,
                        resolution
                    });

                    currentStreamInf = null;
                }
            }

            if (mejoresCalidades.length > 0) {
                // Ordenar de mayor a menor calidad (primero por resolución vertical, luego por ancho de banda)
                mejoresCalidades.sort((a, b) => {
                    if (b.resolution !== a.resolution) return b.resolution - a.resolution;
                    return b.bandwidth - a.bandwidth;
                });

                // OPCIÓN A: Si quieres forzar y servir ÚNICAMENTE la máxima calidad disponible:
                const mejorSubPlaylist = mejoresCalidades[0].url;
                // Redirigimos recursivamente o procesamos directamente la subplaylist de mayor calidad
                return await procesarPlaylistProxy(mejorSubPlaylist, req, res, referer);
            }
        }

        // Si es una lista de fragmentos normal (.ts o .m4s chunks)
        const nuevasLineas = lineas.map(linea => {
            const texto = linea.trim();
            if (texto && !texto.startsWith('#')) {
                const urlAbsoluta = new URL(texto, streamUrl).href;
                const sig = firmar(urlAbsoluta, referer);
                const query = `url=${encodeURIComponent(urlAbsoluta)}&ref=${encodeURIComponent(referer)}&sig=${sig}`;

                if (texto.includes('.m3u8')) {
                    return `${baseUrl}/api/proxy/subplaylist?${query}`;
                }
                return `${baseUrl}/api/proxy/segment?${query}`;
            }
            return linea;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(nuevasLineas.join('\n'));
        return true;
    } catch (error) {
        return false;
    }
}
