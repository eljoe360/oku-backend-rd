// ======================================================
// CANAL 7 (ANTENA 7 / CLOUDFRONT)
// ======================================================
const CANAL7_MASTER = 'https://d3gie3ig6argu.cloudfront.net/ts:abr.m3u8';
const CANAL7_BASE = 'https://d3gie3ig6argu.cloudfront.net/';

async function obtenerPlaylistCanal7() {
    // 1. Obtener la playlist máster de CloudFront
    const masterRes = await axios.get(CANAL7_MASTER, {
        httpsAgent: httpsAgent,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Origin': 'https://www.antena7.com.do',
            'Referer': 'https://www.antena7.com.do/'
        },
        timeout: 20000
    });

    const masterLines = masterRes.data.split(/\r?\n/);
    let subPlaylistUrl = null;

    // Buscar la sub-playlist (resolución/bitrate)
    for (const line of masterLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            subPlaylistUrl = new URL(trimmed, CANAL7_BASE).href;
            break;
        }
    }

    if (!subPlaylistUrl) {
        subPlaylistUrl = CANAL7_MASTER;
    }

    // 2. Obtener la sub-playlist con los segmentos reales
    const subRes = await axios.get(subPlaylistUrl, {
        httpsAgent: httpsAgent,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Origin': 'https://www.antena7.com.do',
            'Referer': 'https://www.antena7.com.do/'
        },
        timeout: 20000
    });

    const playlist = subRes.data;
    const lineas = playlist.split(/\r?\n/);
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

        const urlSegmento = new URL(texto, subPlaylistUrl).href;
        const proxy = '/api/canal7/proxy?url=' + encodeURIComponent(urlSegmento);
        resultado.push(proxy);
    }

    return resultado.join('\n');
}

app.get('/api/canal7/proxy', async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).send('Falta URL');
        }

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Origin': 'https://www.antena7.com.do',
                'Referer': 'https://www.antena7.com.do/'
            },
            timeout: 30000
        });

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(response.data);
    } catch (error) {
        console.log('Error proxy Canal 7: ' + error.message);
        return res.status(502).send('Error obteniendo segmento Canal 7');
    }
});

app.get('/api/canal7', async (req, res) => {
    try {
        console.log('Roku solicitó Canal 7');
        const playlist = await obtenerPlaylistCanal7();

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(playlist);
    } catch (error) {
        console.log('Error Canal 7: ' + error.message);
        return res.status(502).send('Error obteniendo Canal 7');
    }
});
