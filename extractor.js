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
        '--disable-features=IsolateOrigins,site-per-process',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    const page = await browser.newPage();

    // 1. Configurar User-Agent y Viewport de Escritorio Real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });

    let streamUrl = null;

    const esUrlValida = (url) => {
      if (!url) return false;
      const urlLower = url.toLowerCase();
      // Filtrar estáticos falsos
      if (urlLower.endsWith('.js') || urlLower.endsWith('.css') || urlLower.endsWith('.png') || urlLower.endsWith('.jpg')) {
        return false;
      }
      return urlLower.includes('.m3u8') || urlLower.includes('/hls/') || urlLower.includes('manifest') || urlLower.includes('playlist');
    };

    // 2. Interceptación Nivel 1: Request
    page.on('request', request => {
      const reqUrl = request.url();
      if (esUrlValida(reqUrl) && !streamUrl) {
        streamUrl = reqUrl;
        console.log('¡M3U8 capturado (Request)!:', streamUrl);
      }
    });

    // 3. Interceptación Nivel 2: Response
    page.on('response', response => {
      const resUrl = response.url();
      if (esUrlValida(resUrl) && !streamUrl) {
        streamUrl = resUrl;
        console.log('¡M3U8 capturado (Response)!:', streamUrl);
      }
    });

    // 4. Navegación flexible (Espera carga inicial)
    try {
      await page.goto(urlPagina, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log('Timeout inicial de navegación, procediendo con la extracción...');
    }

    // 5. Interacción Forzada: Clics en videos, iFrames y botones Play
    await page.evaluate(async () => {
      const dispararEventos = (el) => {
        if (!el) return;
        ['click', 'mousedown', 'mouseup', 'touchstart'].forEach(eventType => {
          try {
            el.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, view: window }));
          } catch (e) {}
        });
      };

      // Intentar dar play a elementos video
      document.querySelectorAll('video').forEach(v => {
        v.muted = true;
        v.play().catch(() => {});
        dispararEventos(v);
      });

      // Hacer clic en botones de play o capas overlay
      const selectores = ['button', '.play', '#play', '.vjs-big-play-button', '[aria-label="Play"]', 'iframe'];
      selectores.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => dispararEventos(el));
      });
    });

    // Esperar 6 segundos para dar tiempo a que los scripts generen la petición de streaming
    await new Promise(resolve => setTimeout(resolve, 6000));

    // 6. Extracción Nivel 3: Escaneo profundo del HTML, iFrames y Variables globales de JS
    if (!streamUrl) {
      console.log('Escaneando DOM, iFrames y variables de JS...');
      streamUrl = await page.evaluate(() => {
        const regexM3U8 = /(https?:\/\/[^"' ]+?\.(?:m3u8)[^"' ]*)/i;

        // A. Buscar en etiquetas <source> o <video>
        const fuentes = Array.from(document.querySelectorAll('video src, source')).map(e => e.src);
        for (const src of fuentes) {
          if (src && src.includes('.m3u8')) return src;
        }

        // B. Buscar en todo el HTML del documento
        const matchHTML = document.documentElement.outerHTML.match(regexM3U8);
        if (matchHTML) return matchHTML[1];

        // C. Buscar dentro de iFrames accesibles
        const iframes = document.querySelectorAll('iframe');
        for (const frame of iframes) {
          try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            const matchFrame = doc.documentElement.outerHTML.match(regexM3U8);
            if (matchFrame) return matchFrame[1];
          } catch (e) {}
        }

        return null;
      });
    }

    return streamUrl;
  } catch (error) {
    console.error('Error crítico en extractor:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { obtenerUrlCanal };
