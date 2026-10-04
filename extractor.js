const puppeteer = require('puppeteer');

async function obtenerUrlCanal(urlPagina) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-first-run',
        '--no-zygote',
        '--disable-web-security',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const page = await browser.newPage();

    // User-Agent de navegador real para omitir restricciones anti-bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let streamUrl = null;

    // Escuchar todas las peticiones de red
    page.on('request', request => {
      const reqUrl = request.url();
      
      // Filtrar formatos M3U8 / HLS
      if ((reqUrl.includes('.m3u8') || reqUrl.includes('playlist.m3u8') || reqUrl.includes('manifest.m3u8')) && !streamUrl) {
        if (!reqUrl.endsWith('.js') && !reqUrl.endsWith('.css')) {
          streamUrl = reqUrl;
          console.log('¡Enlace M3U8 capturado con éxito!:', streamUrl);
        }
      }
    });

    // Navegar a la página y esperar la carga del DOM
    await page.goto(urlPagina, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Forzar play en el video o en cualquier iframe presente
    await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        v.muted = true;
        v.play().catch(() => {});
      });

      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(f => {
        try {
          const frameDoc = f.contentDocument || f.contentWindow.document;
          const frameVideos = frameDoc.querySelectorAll('video');
          frameVideos.forEach(fv => {
            fv.muted = true;
            fv.play().catch(() => {});
          });
        } catch (e) {}
      });
    });

    // Esperar 8 segundos para que la transmisión inicie las peticiones de red
    await new Promise(resolve => setTimeout(resolve, 8000));

    return streamUrl;
  } catch (error) {
    console.error('Error al extraer el canal:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { obtenerUrlCanal };
