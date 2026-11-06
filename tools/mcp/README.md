# Conector MCP de MotionComic Studio

Pequeño programa de Node.js 18+ sin dependencias que permite a un asistente de IA (cliente MCP) abrir MotionComic Studio, crear proyectos y añadir archivos locales. Escucha solo en 127.0.0.1 con un código de emparejamiento; cada cambio pide permiso en el estudio.

```json
{ "mcpServers": { "motioncomic": { "command": "node", "args": ["/ruta/a/tools/mcp/server.js"] } } }
```

Variables opcionales: `MOTIONCOMIC_URL` (dirección del estudio, por defecto la publicada) y `MOTIONCOMIC_PORT` (puerto local, por defecto 47821). Más información en el README principal, sección «Conexión con una IA (MCP)».
