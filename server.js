const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/eljoe360/channels.roku/main/channels.json';

// Función para extraer la URL .m3u8 en vivo desde Dailymotion usando el ID
async function obtenerStreamDailymotion(idVideo) {
    try {
        const response = await axios.get(`https://www.dailymotion.com/player/metadata/video/${idVideo}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (response.data && response.data.qualities && response.data.qualities.auto) {
            return response.data.qualities.auto[0].url;
        }
    } catch (error) {
        console.error(`Error al extraer stream Dailymotion (${idVideo}):`, error.message);
    }
    return null;
}

app.get('/api/canales', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_JSON_URL);
        const canales = response.data;
        const hoy = new Date().toISOString().split('T')[0];

        // Filtrar canales no vencidos
        const canalesValidos = canales.filter(canal => {
            if (!canal.vencimiento) return true;
            return canal.vencimiento >= hoy;
        });

        // Resolver enlaces automáticos dinámicos (ej: DailyMotion / Color Visión)
        const canalesProcesados = await Promise.all(
            canalesValidos.map(async (canal) => {
                if (canal.dailymotion_id) {
                    const urlFresca = await obtenerStreamDailymotion(canal.dailymotion_id);
                    if (urlFresca) {
                        return { ...canal, url: urlFresca };
                    }
                }
                return canal;
            })
        );

        res.json(canalesProcesados);
    } catch (error) {
        console.error('Error al procesar los canales:', error.message);
        res.status(500).json({ error: 'Error al obtener la lista de canales' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
