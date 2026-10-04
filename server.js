const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Servidor activo.');
});

app.get('/live/telesistema', async (req, res) => {
  console.log('Obteniendo señal en vivo de Telesistema (Dailymotion)...');
  
  const videoId = 'x80ac48';
  const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;

  try {
    const response = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    // Extraer la URL del manifiesto M3U8 directo cargado con sus tokens frescos
    const m3u8Url = response.data?.qualities?.auto?.[0]?.url;

    if (m3u8Url) {
      console.log('Manifiesto HLS obtenido con éxito.');
      return res.redirect(m3u8Url);
    } else {
      console.error('No se encontró el objeto M3U8 en la respuesta de Dailymotion.');
      return res.status(500).json({ error: 'No se pudo obtener el flujo M3U8.' });
    }
  } catch (error) {
    console.error('Error al consultar Dailymotion:', error.message);
    return res.status(500).json({ error: 'Error al conectar con la señal del canal.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
