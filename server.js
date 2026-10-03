// ======================================================
// CANAL 6 (MÁXIMA CALIDAD / MASTER)
// ======================================================
// Apuntamos al master para que Roku seleccione la mayor calidad disponible
const CANAL6_STREAM_URL = 'https://stream.elseis.do/canal6/master.m3u8';

async function obtenerPlaylistCanal6() {
    const response = await axios.get(CANAL6_STREAM_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://elseis.do/'
        },
        timeout: 20000
    });

    const baseUrl = new URL(CANAL6_STREAM_URL);
    const lineas = response.data.split(/\r?\n/);
    const resultado = [];

    for (const linea of lineas) {
        const texto = linea.trim();
        if (!texto) { 
            resultado.push(''); 
            continue; 
        }
        if (texto.startsWith('#')) { 
            resultado.push(texto); 
            continue; 
        }

        // Si es una Sub-playlist (m3u8 de alta calidad) o un segmento .ts, 
        // convertimos la URL relativa a absoluta y la pasamos por el proxy
        const urlAbsoluta = new URL(texto, baseUrl).href;
        
        if (texto.endsWith('.m3u8')) {
            // Reescribir sub-playlists para mantener el proxy en la variante de mayor resolución
            resultado.push('/api/canal6/playlist_proxy?url=' + encodeURIComponent(urlAbsoluta));
        } else {
            // Reescribir segmentos .ts directamente
            resultado.push('/api/canal6/proxy?url=' + encodeURIComponent(urlAbsoluta));
        }
    }

    return resultado.join('\n');
}

// Endpoint para procesar sub-playlists de alta resolución (720p/1080p)
app.get('/api/canal6/playlist_proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL');

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://elseis.do/'
            },
            timeout: 20000
        });

        const baseUrl = new URL(url);
        const lineas = response.data.split(/\r?\n/);
        const resultado = [];

        for (const linea of lineas) {
            const texto = linea.trim();
            if (!texto) { resultado.push(''); continue; }
            if (texto.startsWith('#')) { resultado.push(texto); continue; }

            const urlSegmento = new URL(texto, baseUrl).href;
            resultado.push('/api/canal6/proxy?url=' + encodeURIComponent(urlSegmento));
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(resultado.join('\n'));
    } catch (error) {
        return res.status(502).send('Error sub-playlist Canal 6');
    }
});

// Proxy para los trozos de video .ts
app.get('/api/canal6/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('Falta URL');

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': 'https://elseis.do/'
            },
            timeout: 30000
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(response.data);
    } catch (error) {
        return res.status(502).send('Error segmento Canal 6');
    }
});

// Endpoint principal del Canal 6 para Roku
app.get('/api/canal6', async (req, res) => {
    try {
        const playlist = await obtenerPlaylistCanal6();
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(playlist);
    } catch (error) {
        return res.status(502).send('Error Canal 6');
    }
});
