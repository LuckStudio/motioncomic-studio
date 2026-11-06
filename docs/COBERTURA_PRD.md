# Cobertura del PRD

Estado de cada sección del PRD ampliado tras el paso 17. ✔ hecho · ◐ parcial · ✘ pendiente. Todo lo marcado se ha probado en Chromium con archivos sintéticos; falta probarlo con arte real.

## 5. Modos de trabajo
| Función | Estado | Nota |
| --- | --- | --- |
| Modo Página: viñetas por detección sin IA, orden occidental o manga, cámara entre viñetas, enfoque, recorrido panorámico | ✔ | Rectángulos y polígonos libres |
| Modo Libre, proporción cambiable después | ✔ | |
| Modo Webtoon (scroll, pausas, zooms) | ✔ | Se pidió para la segunda versión; ya está |
| Borrador en un clic con «Mi estilo» | ✔ | Páginas, imágenes o PDF |
| Formato y calculadora de resolución | ✔ | 16:9, 9:16, 3:4, 1:1, 2:1 y personalizada |

## 6. Importación y archivos
| Función | Estado | Nota |
| --- | --- | --- |
| PSD con capas, grupos, visibilidad, modos de fusión básicos | ✔ | Capas de texto entran como imagen |
| PNG, JPEG, WebP, PDF, audio, fuentes | ✔ | |
| Detección inteligente de capas y avisos | ✔ | Vacías, ocultas, nombres repetidos |
| Aviso de resolución, proxies y límites de memoria | ✔ | |
| Aviso de perfil de color CMYK a sRGB | ✔ | |
| ZIP o carpeta de PNG, SVG | ✔ | Fase 2 del PRD |
| Krita, Clip Studio, Procreate directos | ✘ | Se entra por PNG o PSD exportados |
| Biblioteca de assets con carpetas y etiquetas | ✔ | Los archivos se guardan una vez por proyecto |

## 7. Capas y parallax
| Función | Estado | Nota |
| --- | --- | --- |
| Profundidad z, intensidad global, huecos (sobreescalado, rojo, tapar) | ✔ | El margen seguro es una cifra, no un dibujo |
| Desenfoque de profundidad y rack focus | ✔ | |
| Viñeteado, grano, tramado, tinte; partículas | ✔ | |
| Límite máximo de desplazamiento, pivote por capa | ✔ | |
| Sombra, brillo, contorno, ajuste de color por capa; saturación y contraste globales | ◐ | |
| Animación de personaje por capas (parpadeo, bocas, respiración) | ◐ | |

## 8. Cámara y animación
| Función | Estado | Nota |
| --- | --- | --- |
| Zoom, paneo, Ken Burns, temblor, ángulo holandés | ✔ | |
| Encuadre manual y trayectoria dibujada con puntos | ✔ | Trayectoria libre solo en planos libres |
| Preset propio reutilizable | ✔ | |
| Temblor, golpe con destello y sonido, pulso, vibración | ✔ | |
| Dolly zoom, whip pan con motion blur | ◐ | |
| Entradas, salidas y bucles de capas | ✔ | Sí en el texto |
| Keyframes visibles en la línea de tiempo, editor de curvas Bézier | ✔ | Hay cuatro curvas y fotogramas inicio y fin |
| Marcadores de pulso musical | ✔ | |

## 9. Transiciones y efectos
| Función | Estado | Nota |
| --- | --- | --- |
| Corte, fundido a negro, barrido, destello | ✔ | |
| Fundido a blanco, motion blur direccional, zoom a través, revelado de tinta, apertura de viñetas, glitch | ◐ | |
| Líneas de velocidad y concentración, aberración, destellos de color | ✔ | |
| Lluvia, polvo, nieve, chispas, humo | ✔ | Niebla y luz ✘ |
| Vista previa al pasar el cursor | ✔ | |

## 10. Texto
Bocadillos (tres formas), cajas, onomatopeyas, subtítulos con SRT, revelado, entrada animada, sincronía con la voz, multiidioma, zonas seguras y tipografías propias: ✔. Capas de texto del PSD como elementos animables: ✔.

## 11. Línea de tiempo y audio
| Función | Estado | Nota |
| --- | --- | --- |
| Cinco pistas, mover, recortar, dividir, snap, deshacer ilimitado, J K L | ✔ | |
| Pistas ampliables sin límite, ripple, duplicar y agrupar clips, selección múltiple, marcadores con notas | ✔ | |
| Onda, marcadores en pausas, ajustar planos a la voz, grabación con cuenta atrás | ✔ | |
| Volumen, fundidos, ducking, normalización, biblioteca generada por código | ✔ | |
| Voz sintética (TTS) | ✘ | |

## 12 y 13. Interfaz, guardado y presets
| Función | Estado | Nota |
| --- | --- | --- |
| Visor, capas, inspector, línea de tiempo, Simple y Avanzado, espacios de trabajo | ✔ | |
| Barra de edición de la línea de tiempo (cuchilla, recorte de inicio y fin, reflejar, recorte de imagen, imán, zoom), fotogramas clave en capas, superposiciones y textos, editor de curvas Bézier y favoritos | ✔ | Atajos V, X, S, Q, W, N |
| Imán por bordes con guía, capas con aparición/desaparición propias y tramos con ilustración reemplazable (gestos) | ✔ | Alt desactiva el imán al arrastrar |
| Modo táctil (objetivos de 44 px, nombres con pulsación larga, vistas previas al mantener, sin dependencia del hover) | ✔ | Automático, siempre o nunca en Preferencias |
| Menú contextual, gestos de pellizco y desplazamiento, modo de precisión y aviso «Deshacer» al eliminar | ✔ | Clic derecho o pulsación larga |
| Teclado completo (visor, línea de tiempo, F6 entre paneles), regiones y enlaces para saltar, hoja de atajos con ? por espacio de trabajo | ✔ | Alt+Mayús+flechas recortan |
| Temas (gris medio, azul noche, sepia, personalizado), alto contraste, selección con símbolo y escala automática en tablet | ✔ | Preferencias › Apariencia |
| Ocultar herramientas, pestañas y espacios de trabajo; vistas guardadas con nombre y exportables (.mcview) | ✔ | Preferencias › Interfaz |
| Aviso de versión nueva con actualización guardando el proyecto, y ayuda para forzar la recarga si el navegador conserva una copia vieja | ✔ | version.json y meta mc-build lo escribe tools/pack.js |
| Tablet en vertical: visor, línea de tiempo y hoja inferior de paneles, con barra compacta y menú «más herramientas» | ✔ | Hasta 900 px de ancho |
| Escala de la interfaz (70–150 %) sin descuadres en línea de tiempo, arrastres, gestos y tutoriales | ✔ | `MC.uz()` convierte píxeles del ratón en medidas de la interfaz |
| Propiedades con pestañas por tipo de selección (estilo CapCut), con navegación por flechas, teclado y deslizamiento | ✔ | Recuerda la pestaña por tipo |
| Fotogramas clave por propiedad con rombo, saltos entre fotogramas, curvas predefinidas (incluye elástico, bote y mantener) y movimientos listos | ✔ | Compatibles con los proyectos anteriores |
| Paneles acoplables (izquierda/derecha/arriba), disposiciones predefinidas y ventanas separadas para varias pantallas | ✔ | Menú ⋮ y asa ⠿ en cada panel; la ventana nueva recibe el panel con sus atajos y se devuelve al cerrarla |
| Paneles acoplables y flotantes, barra de herramientas | ✘ | Disposición fija |
| Atajos configurables con mapas de Premiere y Photoshop | ✔ | |
| Calidad de previsualización, pantalla completa, guías, tema oscuro y claro | ✔ | Reglas ✔ |
| Inicio con proyectos, proyecto de ejemplo, tutoriales | ✔ | |
| Guardado local, autoguardado, recuperación, espacio usado, exportar e importar copia | ✔ | |
| Historial de versiones persistente | ✔ | Deshacer solo dura mientras el proyecto está abierto |
| PWA instalable y sin conexión | ✔ | |
| Mi estilo y presets con nombre | ✔ | |

## 14. Exportación
| Función | Estado | Nota |
| --- | --- | --- |
| MP4 H.264, presets por plataforma, rango, fps, bitrate, portada, SRT | ✔ | Audio AAC u Opus según el navegador |
| Cola en segundo plano, lotes con reencuadre, simulador | ✔ | Simulador genérico, sin marcas |
| H.265, ProRes, WebM, GIF, secuencia de PNG, audio solo | ◐ | |

## 16. Requisitos
Web instalable, español e inglés, accesibilidad por teclado, lectores de pantalla y tamaño de texto: ✔. Soporte de tableta y ordenador: ✔ revisado en emulación; móvil: usable, pensado como apoyo. Rendimiento y límites de memoria con archivos reales: ✘ sin validar.


Notas del paso 17: sombra, resplandor, contorno y color por elemento ✔ (sin capa de ajuste independiente); personaje por capas con parpadeo y boca según la voz ✔ (sin rig de huesos); dolly zoom ✔; GIF, WebM, secuencia PNG y solo audio ✔ (H.265 y ProRes no los ofrece el navegador).
