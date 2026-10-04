const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// 1. Endpoint principal que consulta Roku para cargar la lista de canales
app.get('/', (req, res) => {
  res.json({
    channels: [
      {
        id: "telesistema",
        title: "Telesistema 11",
        streamUrl: "https://oku-backend-rd.onrender.com/live/telesistema"
      }
      // Aquí puedes volver a pegar la lista de los demás canales que tenías configurados
    ]
  });
});

// 2. Extractor ultrarrápido para la señal de Telesistema 11 (Dailymotion)
app.get('/live/telesistema', async (req, res) => {
  console.log('Obteniendo enlace HLS de Telesistema...');
  const videoId = 'x80ac48';
  const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;

  try {
    const response = await axios.get(metadataUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const m3u8Url = response.data?.qualities?.auto?.[0]?.url;

    if (m3u8Url) {
      return res.redirect(m3u8Url);
    } else {
      return res.status(500).json({ error: 'No se pudo generar la señal M3U8.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error al conectar con el servidor de flujo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
