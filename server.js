const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Función auxiliar para generar el formato de 3 dígitos (ej: 5 -> "005", 27 -> "027")
function formatChannelNumber(num) {
  return String(num).padStart(3, '0');
}

// Generador automático de los 49 canales aplicando la regla de tvabierta.net por defecto
const channelsData = [];

for (let i = 1; i <= 49; i++) {
  let channelObj = {
    numero: i,
    id: `canal${i}`,
    nombre: `Canal ${i}`
  };

  // Excepciones o enlaces personalizados para canales específicos si lo requieres
  if (i === 1) {
    channelObj.id = "sitv";
    channelObj.nombre = "SI TV";
    channelObj.url = "http://190.122.104.210:5080/LiveApp/streams/sitv2.m3u8";
  } else if (i === 4) {
    channelObj.id = "canal4";
    channelObj.nombre = "Canal 4 RD";
    channelObj.url = "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8";
  } else {
    // Para todos los demás, aplica la regla del enlace HLS estructurado con su número de 3 dígitos
    channelObj.url = `https://hls.tvabierta.net/hls/${formatChannelNumber(i)}.m3u8`;
  }

  channelsData.push(channelObj);
}

// Ruta principal y de canales
app.get('/', (req, res) => {
  res.json(channelsData);
});

app.get('/channels', (req, res) => {
  res.json(channelsData);
});

// Ruta para obtener el stream individual
app.get('/stream/:id', (req, res) => {
  const { id } = req.params;
  const channel = channelsData.find(c => c.id === id);

  if (!channel) {
    return res.status(404).json({ error: 'Canal no encontrado' });
  }

  if (channel.url) {
    return res.json({ url: channel.url });
  }

  res.status(404).json({ error: 'URL no disponible para este canal' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
