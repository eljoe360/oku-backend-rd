const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Función para rellenar ceros a 3 dígitos (ej: 9 -> "009")
function pad(num) {
  return String(num).padStart(3, '0');
}

// Lista base completa idéntica al formato que tu Roku leía perfectamente
const channelsList = [
  { numero: 1, id: "sitv", nombre: "SI TV", url: "http://190.122.104.210:5080/LiveApp/streams/sitv2.m3u8" },
  { numero: 2, id: "canal2", nombre: "Canal 2", url: "https://hls.tvabierta.net/hls/002.m3u8" },
  { numero: 3, id: "canal3", nombre: "Canal 3", url: "https://hls.tvabierta.net/hls/003.m3u8" },
  { numero: 4, id: "canal4", nombre: "Canal 4 RD", url: "https://cdn.protvradiostream.com/canal4rd-1/ngrp:canal4rd-1_all/playlist.m3u8" },
  { numero: 5, id: "telemicro", nombre: "Telemicro Canal 5", url: "https://live2.telemicro.com.do/live/55/playlist.m3u8" },
  { numero: 6, id: "canal6", nombre: "Canal 6", url: "https://stream.elseis.do/canal6/master.m3u8" },
  { numero: 7, id: "canal7", nombre: "Antena 7", url: "https://hls.tvabierta.net/hls/007.m3u8" },
  { numero: 8, id: "canal8", nombre: "Telemedios Canal 8", url: "http://190.122.104.210:5080/LiveApp/streams/telemedios.m3u8" },
  { numero: 9, id: "canal9", nombre: "Color Visión Canal 9", url: "https://hls.tvabierta.net/hls/009.m3u8" },
  { numero: 10, id: "canal10", nombre: "Canal 10", url: "https://hls.tvabierta.net/hls/010.m3u8" },
  { numero: 11, id: "canal11", nombre: "Telesistema 11 (TV)", url: "https://hls.tvabierta.net/hls/011.m3u8" },
  { numero: 12, id: "canal12", nombre: "Canal 12", url: "https://hls.tvabierta.net/hls/012.m3u8" },
  { numero: 13, id: "canal13", nombre: "Telecentro Canal 13", url: "https://live2.telemicro.com.do/live/telecentrocast_1080p/chunks.m3u8" },
  { numero: 14, id: "canal14", nombre: "Canal 14", url: "https://hls.tvabierta.net/hls/014.m3u8" },
  { numero: 15, id: "canal15", nombre: "Digital 15", url: "https://live4.telemicro.com.do/live/digital15cast_1080p/chunks.m3u8" },
  { numero: 16, id: "canal16", nombre: "Canal 16", url: "https://hls.tvabierta.net/hls/016.m3u8" },
  { numero: 17, id: "canal17", nombre: "Canal 17", url: "https://hls.tvabierta.net/hls/017.m3u8" },
  { numero: 18, id: "canal18", nombre: "AME 47 Canal 18", url: "https://ss2.tvrdomi.com:1936/ame47/ame47/playlist.m3u8" },
  { numero: 19, id: "canal19", nombre: "TV HD Live 19", url: "https://5790d294af2dc.streamlock.net/tvhdlive/tvhdlive/playlist.m3u8" },
  { numero: 20, id: "canal20", nombre: "Canal 20", url: "https://hls.tvabierta.net/hls/020.m3u8" },
  { numero: 21, id: "canal21", nombre: "Canal 21", url: "https://hls.tvabierta.net/hls/021.m3u8" },
  { numero: 22, id: "canal22", nombre: "Canal 22", url: "https://hls.tvabierta.net/hls/022.m3u8" },
  { numero: 23, id: "canal23", nombre: "Canal 23", url: "https://hls.tvabierta.net/hls/023.m3u8" },
  { numero: 24, id: "canal24", nombre: "Canal 24", url: "https://hls.tvabierta.net/hls/024.m3u8" },
  { numero: 25, id: "canal25", nombre: "Canal 25", url: "https://hls.tvabierta.net/hls/025.m3u8" },
  { numero: 26, id: "canal26", nombre: "Canal 26", url: "https://hls.tvabierta.net/hls/026.m3u8" },
  { numero: 27, id: "canal27", nombre: "Canal 27", url: "https://2-fss-2.streamhoster.com/pl_138/206532-6829902-1/chunklist.m3u8" }
];

// Completamos automáticamente del 28 al 49 para mantener la estructura limpia
for (let i = 28; i <= 49; i++) {
  channelsList.push({
    numero: i,
    id: `canal${i}`,
    nombre: `Canal ${i}`,
    url: `https://hls.tvabierta.net/hls/${pad(i)}.m3u8`
  });
}

// Muchos clientes BrightScript de Roku esperan un objeto con la llave "channels" o "results" 
// además del arreglo plano. Devolvemos ambos formatos para garantizar compatibilidad total.
app.get('/', (req, res) => {
  res.json({
    channels: channelsList,
    total: channelsList.length
  });
});

app.get('/channels', (req, res) => {
  res.json(channelsList);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Roku corriendo en el puerto ${PORT}`);
});
