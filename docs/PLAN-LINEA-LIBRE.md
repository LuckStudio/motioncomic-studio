# Plan: línea de tiempo libre («capas agrupadas») y bibliotecas de sonido

Estado: **diseño acordado, sin implementar**. Se avanza poco a poco; cada fase se prueba, se documenta y se fusiona antes de la siguiente.

## Decisiones tomadas con la persona

- **No se cambia lo que hay.** La línea de tiempo actual se queda como **«Clásica»** (más sencilla). Se añade un segundo tipo, **«Libre»**, más cercano a Premiere y CapCut.
- **El tipo se elige al crear el proyecto.** Cambiarlo a mitad de proyecto es más difícil; si se ofrece más adelante, será de Clásica a Libre y con una versión guardada antes, nunca de vuelta.
- **«Capa agrupada»** (no «plano» ni «grupo parallax») es el clip que reúne varias capas con su profundidad y su cámara. Es donde se aplica el efecto parallax u otros efectos.
- **Editar una capa agrupada:** se despliega en la propia línea de tiempo **y** se ve en la pestaña de Capas, para ordenar sus capas.
- **Mezcla libre:** en las pistas de vídeo (V1, V2…) conviven imagen, vídeo, texto y capa agrupada. Lo que está en una pista superior tapa a lo de abajo.
- **Subtítulos:** pista propia, siempre arriba del todo. Es la única que tiene pista propia por defecto; el texto normal va en cualquier pista de vídeo.
- **Orden:** primero la línea de tiempo (fases H1 a H5). Después efectos y sonidos (bloques I y J).

## Cómo se construye (decisión técnica)

El dibujo actual compone en este orden fijo: plano base → planos superpuestos → superposiciones → aspecto → textos → subtítulos. En modo libre se compone **por pista, de abajo arriba**, mezclando los tres tipos de clip, y los subtítulos van siempre encima.

Para no reescribir el estudio entero se reutilizan las piezas que ya existen:

| Clip en modo libre | Pieza que lo implementa hoy |
|---|---|
| Capa agrupada | plano superpuesto (`xshot`: capas, cámara, efectos propios) |
| Imagen o vídeo | superposición (`overlay`) |
| Texto | texto (`text`) |
| Pista | un único índice de pista compartido por los tres |

El proyecto libre lleva un **plano base oculto** cuya duración se ajusta sola al final del último clip; mantiene la duración total y el audio funcionando sin tocar el resto del código. Los proyectos clásicos no se tocan.

## Fases de la línea de tiempo

1. **H1 · Modelo y dibujo.** Campo `tl` del proyecto (`classic` o `free`), pistas únicas, composición por pista en el dibujo y la exportación, plano base oculto con duración automática. Pruebas de orden de dibujo. Sin cambios visibles en proyectos clásicos.
2. **H2 · Línea de tiempo libre.** Selector «Línea de tiempo: Clásica o Libre» al crear el proyecto; subtítulos arriba; pistas V mezclables; añadir, quitar, renombrar, bloquear y ocultar pistas; arrastrar clips entre pistas; importar a cualquier pista.
3. **H3 · Capas agrupadas.** Agrupar y desagrupar clips seleccionados (la profundidad sale de la pista); desplegar en la línea de tiempo; ordenar sus capas en la pestaña de Capas; doble clic para entrar a editarla.
4. **H4 · Efectos y transiciones.** Efectos sobre cualquier clip y **capa de ajuste** (un clip que afecta a lo de debajo); transiciones entre clips seguidos de la misma pista.
5. **H5 · Poner al día** el conector MCP, el curso Aprender, la ayuda y los atajos con el modo libre. Opcional: convertir un proyecto clásico a libre.

## Después de la línea de tiempo

**I · Treinta efectos nuevos** (movimiento, cómic y manga, luz y atmósfera, imagen y estilo; los que distorsionan píxel a píxel se marcan como más pesados).

**J · Sonidos y bibliotecas**
- **J1 · Unos 20 SFX generados por código** (papel, espada, láser, boing, latido, pasos, teclado, obturador, subidas de tensión, golpes de glitch, barridos, campanita…), sin licencias.
- **J2 · Importar packs descargados:** el ZIP de un pack se indexa por carpetas como categorías. En la app se citan las fuentes y su licencia: Kenney (CC0), Sonniss GDC Bundles (gratis y comercial, no redistribuible), Pixabay y Mixkit (licencia gratuita, descarga manual) y BBC Sound Effects (solo uso personal o educativo, con aviso si el vídeo es comercial).
- **J3 · Freesound opcional:** la persona crea una cuenta gratuita y pega su clave en Preferencias; con tutorial paso a paso dentro de la app. Búsqueda y escucha, filtro de licencias (CC0, CC-BY), añadir al proyecto y **créditos automáticos** al exportar. Por defecto, sin clave, no aparece nada. Pendiente de comprobar que el navegador permite llamar a la API directamente: desde el entorno de desarrollo la red no llega a freesound.org, así que se verificará al implementarlo y, si no es posible, se ofrecerá solo en la app instalada o en local.

## Riesgos conocidos

- Es el cambio más grande desde el principio; por eso se hace en fases y el modo clásico no se toca.
- La conversión de clásico a libre (H5, opcional) necesita pruebas con proyectos reales.
- Los atajos, el MCP y el curso tendrán que distinguir entre los dos tipos de línea de tiempo.
