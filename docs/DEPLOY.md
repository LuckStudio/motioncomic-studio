# Publicar MotionComic Studio

MotionComic Studio es una web estática: HTML, CSS y JavaScript. No necesita servidor, base de datos ni compilar nada. Funciona en cualquier alojamiento que sirva archivos por HTTPS (Hostinger, Netlify, GitHub Pages, un VPS con nginx…).

## 1. Preparar la carpeta

```bash
node tools/pack.js
```

Crea `public/` (y `public.zip` si tienes `zip`) con solo lo necesario: `index.html`, `manifest.webmanifest`, `sw.js`, `.htaccess`, `src/`, `icons/`. Calcula una versión a partir del contenido para que el modo sin conexión se actualice solo cuando algo cambie.

### Imagen y texto al compartir el enlace

Al pegar el enlace en WhatsApp, Telegram, X, Facebook, LinkedIn o Slack aparece una tarjeta con el logotipo sobre fondo claro, el nombre y una descripción (`icons/share.png`, 1200×630). Esas redes **solo aceptan direcciones completas** en las etiquetas, así que `index.html` ya las lleva apuntando a GitHub Pages: `https://luckstudio.github.io/motioncomic-studio/`.

- **Si publicas con GitHub Pages:** en el repositorio, *Settings → Pages → Deploy from a branch → `main` / `(root)`*. No hay que hacer nada más.
- **Si publicas en tu propio dominio:** empaqueta indicándolo y las etiquetas se cambian solas:

  ```bash
  SITE_URL=https://tudominio.com node tools/pack.js
  ```

  (Si va en una carpeta, incluye la carpeta: `https://tudominio.com/studio`. También puedes guardar la dirección en `tools/site.txt`.)

- **Si compartes el enlace del repositorio de GitHub** (no el de la web), GitHub usa su propia tarjeta: sube `icons/share.png` en *Settings → General → Social preview*.

Para cambiar la imagen o su texto, edita `tools/share.js` y ejecuta `node tools/share.js` (necesita Playwright). Las redes guardan la tarjeta en caché: para que la actualicen usa el depurador de Facebook (<https://developers.facebook.com/tools/debug/>) y, en WhatsApp, comparte el enlace con un parámetro nuevo, por ejemplo `?v=2`.

Para probarla en local con las mismas cabeceras de seguridad que `.htaccess`:

```bash
node tools/serve.js public 8080
```

Abre `http://localhost:8080`. El modo sin conexión y la instalación funcionan en `localhost` y en cualquier dominio con HTTPS.

## 2. Subirla a Hostinger (hosting compartido o Cloud)

1. En hPanel, abre **Sitios web → Administrar → Archivos → Administrador de archivos**.
2. Entra en `public_html` (o en la carpeta del subdominio, por ejemplo `studio`).
3. Sube `public.zip` y extráelo ahí mismo. Comprueba que `index.html` y `.htaccess` quedan en esa carpeta (los archivos que empiezan por punto pueden estar ocultos: activa «mostrar archivos ocultos»).
4. Activa el **certificado SSL** del dominio y la redirección a HTTPS. Sin HTTPS no se instala como aplicación ni funciona sin conexión.
5. Abre el dominio. En Chrome o Edge aparece «Instalar la aplicación» en la pantalla de inicio de la herramienta.

El archivo `.htaccess` incluido sirve los tipos de archivo correctos, comprime, cachea las fuentes y las imágenes, obliga a consultar siempre `index.html`, `sw.js` y el manifiesto, y añade una política de seguridad de contenido: todo se carga del propio dominio, sin terceros. Si tu alojamiento usa nginx, traduce esas cabeceras a su configuración.

## 3. Actualizar

1. `node tools/pack.js`
2. Sube el contenido de `public/` sobre el anterior (sobrescribe).

Quien tenga la aplicación abierta o instalada verá en la pantalla de inicio «Hay una versión nueva» y la aplica con «Actualizar ahora». Los proyectos no se tocan: viven en el navegador de cada persona.

## 4. Qué comprobar tras publicar

- Se ve la pantalla de inicio con el proyecto de ejemplo y las tipografías de la marca.
- Abrir un proyecto, reproducir y exportar un MP4 corto.
- Desconectar la red y recargar: debe abrir igual.
- En la consola del navegador no aparecen errores de «Content Security Policy».

## Privacidad

La aplicación no envía nada a ningún servidor: no hay cuentas, analítica ni IA. Las tipografías y las librerías se sirven desde el propio dominio. Los proyectos y las imágenes se guardan en el navegador de quien las usa (IndexedDB); borrar los datos del sitio los elimina, por eso la herramienta recuerda exportar copias.
