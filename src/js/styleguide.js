/* Guía de estilo: tarjeta de la pantalla de inicio y editor. Son notas en Markdown que escribe la persona (cuándo usa cada transición, el ritmo…),
   junto a los ajustes guardados en «Mi estilo». Se puede copiar para una IA, exportar e importar. Todo en este equipo. */
(function () {
  'use strict';
  const MC = window.MC, h = MC.h, t = MC.t;
  const when = (ms) => (ms ? new Date(ms).toLocaleString(MC.lang === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); MC.toast(t('Copiado. Pégalo en el chat de tu IA.', 'Copied. Paste it into your AI chat.')); }
    catch (e) {
      const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' } }, text); document.body.append(ta); ta.select();
      try { document.execCommand('copy'); MC.toast(t('Copiado. Pégalo en el chat de tu IA.', 'Copied. Paste it into your AI chat.')); } catch (e2) { MC.toast(t('No se pudo copiar; usa «Exportar».', 'Could not copy; use “Export”.')); }
      ta.remove();
    }
  };
  MC.copyForAI = () => { if (MC.learnEvent) MC.learnEvent('copyai'); return copy(MC.styleGuide.full()); };

  /* editor de la guía */
  MC.styleGuideDialog = () => {
    const ta = h('textarea', { class: 'input sg-ta', rows: 18, spellcheck: 'true', 'aria-label': t('Guía de estilo en Markdown', 'Style guide in Markdown'), value: MC.styleGuide.get() });
    ta.value = MC.styleGuide.get();
    const status = h('span', { class: 'cap', role: 'status', 'aria-live': 'polite' }, MC.styleGuide.savedAt() ? t('Guardado ', 'Saved ') + when(MC.styleGuide.savedAt()) : t('Es la plantilla: edítala y se guarda sola.', 'This is the template: edit it and it saves itself.'));
    let tm = 0; const save = () => { MC.styleGuide.set(ta.value); status.textContent = t('Guardado ', 'Saved ') + when(Date.now()); };
    ta.addEventListener('input', () => { status.textContent = t('Guardando…', 'Saving…'); clearTimeout(tm); tm = setTimeout(save, 500); });
    const file = h('input', { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain', hidden: true, onChange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; ta.value = (await f.text()).slice(0, 60000); save(); MC.toast(t('Guía importada', 'Guide imported')); } });
    const lines = MC.styleLines(MC.myStyle.get());
    const body = h('div', { style: { display: 'grid', gap: '10px', minWidth: 0 } },
      h('p', { class: 'cap' }, t('Escribe con tus palabras cómo trabajas: cuándo usas cada transición y por qué, el ritmo, lo que nunca haces… Es Markdown (títulos con #, listas con -). Se guarda en este equipo, la ve cualquier IA conectada por MCP y puedes copiarla para dársela en un chat. Debajo se añaden solos los ajustes de «Mi estilo».', 'Write in your own words how you work: when you use each transition and why, the pace, what you never do… It is Markdown (headings with #, lists with -). It is stored on this device, any AI connected through MCP can read it and you can copy it to give it in a chat. The settings of “My style” are added below automatically.')),
      ta, status,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => { save(); MC.copyForAI(); } }, MC.icon('copy', 14), t('Copiar para una IA', 'Copy for an AI')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => { save(); MC.download(new Blob([MC.styleGuide.full()], { type: 'text/markdown' }), 'guia-de-estilo-motioncomic.md'); } }, MC.icon('download', 14), t('Exportar .md', 'Export .md')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => file.click() }, MC.icon('upload', 14), t('Importar .md', 'Import .md')),
        h('button', { class: 'btn btn-g btn-sm', type: 'button', onClick: () => { if (confirm(t('¿Volver a la plantilla? Se pierde lo que has escrito.', 'Go back to the template? What you wrote is lost.'))) { MC.styleGuide.reset(); ta.value = MC.styleGuide.get(); status.textContent = t('Plantilla restaurada.', 'Template restored.'); } } }, t('Restaurar la plantilla', 'Restore the template')), file),
      h('details', null, h('summary', null, t('Ajustes guardados en «Mi estilo» (se añaden solos al copiar o exportar)', 'Settings saved in “My style” (added automatically when copying or exporting)')),
        lines.length ? h('ul', { class: 'cap' }, lines.map((q) => h('li', null, h('b', null, q[0] + ': '), q[1]))) : h('p', { class: 'cap' }, t('Aún no hay un «Mi estilo» guardado: ábrelo en un proyecto, pestaña Estilo → «Guardar como Mi estilo».', 'There is no saved “My style” yet: open a project, Style tab → “Save as My style”.'))));
    MC.modal(t('Mi guía de estilo', 'My style guide'), body, (close) => [h('button', { class: 'btn btn-p', type: 'button', onClick: () => { clearTimeout(tm); save(); close(); if (MC.app && !MC.studioApi) MC.app.render(); } }, t('Cerrar', 'Close'))], { wide: true });
    setTimeout(() => ta.focus(), 50);
  };

  /* tarjeta de la pantalla de inicio */
  MC.styleGuideCard = () => {
    const raw = MC.styleGuide.raw(), has = !!raw, lines = MC.styleLines(MC.myStyle.get());
    const snippet = has ? raw.split('\n').filter((l) => l.trim() && !/^#/.test(l.trim())).map((l) => l.trim().replace(/^[-*]\s*/, '')).slice(0, 3).join(' · ').slice(0, 220) : '';
    return h('section', { class: 'sg-card', 'aria-label': t('Mi guía de estilo', 'My style guide') },
      h('div', null, h('h2', null, t('Mi guía de estilo', 'My style guide')),
        h('p', { class: 'cap' }, t('Una plantilla editable para documentar cómo trabajas: cuándo usas cada transición, el ritmo, las viñetas, lo que nunca haces… Junto a «Mi estilo» sirve de referencia para ti y para cualquier IA que te ayude.', 'An editable template to document how you work: when you use each transition, the pace, the panels, what you never do… Together with “My style” it is a reference for you and for any AI helping you.')),
        h('p', { class: 'cap' }, h('b', null, t('Mi estilo: ', 'My style: ')), lines.length ? t('guardado el ', 'saved on ') + when(MC.myStyle.savedAt()) + ' · ' + lines.slice(0, 3).map((q) => q[1]).join(' · ') : t('aún sin guardar (pestaña Estilo de un proyecto).', 'not saved yet (Style tab of a project).')),
        snippet ? h('p', { class: 'cap sg-snip' }, snippet) : h('p', { class: 'cap' }, t('Todavía no has escrito nada: abre la guía y rellena la plantilla.', 'You have not written anything yet: open the guide and fill in the template.'))),
      h('div', { class: 'sg-acts' },
        h('button', { class: 'btn btn-p btn-sm', type: 'button', onClick: () => MC.styleGuideDialog() }, MC.icon('edit', 14), has ? t('Abrir y editar', 'Open and edit') : t('Abrir la plantilla', 'Open the template')),
        h('button', { class: 'btn btn-s btn-sm', type: 'button', onClick: () => MC.copyForAI() }, MC.icon('copy', 14), t('Copiar para una IA', 'Copy for an AI'))));
  };
})();
