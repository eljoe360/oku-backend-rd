const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

// Función para obtener el stream de Telemicro manejando sesión
async function obtenerStreamTelemicro() {
    try {
        // Step 1: Obtener la sesión inicial y cookies de Telemicro
        const sessionRes = await axios.get('https://telemicro.com.do/telemicro-en-vivo/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 5000
        });

        // Extraer cookies recibidas
        const cookies = sessionRes.headers['set-cookie'] ? sessionRes.headers['set-cookie'].join('; ') : '';

        // Buscar direct de la playlist m3u8 si esta incrustada
        const match = sessionRes.data.match(/https?:\/\/[^"'\s]+\.m3u8(?:\?nimblesessionid=\d+)?/i);
        if (match && match[0]) {
            return match[0];
        }

        // Step 2: Intentar consulta directa al endpoint de Nimble con cookies de sesión
        const streamRes = await axios.get('https://live2.telemicro.com.do/live/55/playlist.m3u8', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookies,
                'Referer': 'https://telemicro.com.do/'
            },
            timeout: 5000
        });

        if (streamRes.request.res.responseUrl) {
            return streamRes.request.res.responseUrl;
        }
    } catch (error) {
        console.error('Error al resolver token Nimble:', error.message);
    }

    // Respaldo garantizado que NUNCA deja la pantalla en negro
    return "http://190.122.104.210:5080/LiveApp/streams/sitv2.m3u8";
}

app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let canales = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const hoy = new Date().toISOString().split('T')[0];

        const vigentes = canales.filter(c => !c.vencimiento || c.vencimiento >= hoy);

        const resultados = await Promise.all(vigentes.map(async (canal) => {
            let c = { ...canal };

            if (c.telemicro_web) {
                c.url = await obtenerStreamTelemicro();
            }

            return c;
        }));

        res.json(resultados);
    } catch (error) {
        console.error('Error general en backend:', error.message);
        res.status(500).json({ error: 'Error al procesar la lista' });
    }
});

app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
