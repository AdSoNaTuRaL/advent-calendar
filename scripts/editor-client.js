const form = document.querySelector('form');
const grid = form.querySelector('.grid');
const submit = form.querySelector('button');
const status = form.querySelector('[role="status"]');
let dirty = false;

form.addEventListener('input', () => { dirty = true; });
form.addEventListener('change', event => {
  const select = event.target;
  if (select.name !== 'move') return;
  const cards = [...grid.children];
  const card = select.closest('.card');
  const from = cards.indexOf(card);
  const to = Number(select.value);
  if (from === to) return;
  const target = cards[to];
  if (to > from) target.after(card);
  else target.before(card);
  [...grid.children].forEach((item, index) => {
    item.querySelector('h2').textContent = 'Día ' + (index + 1);
    item.querySelector('select').value = index;
  });
  dirty = true;
  select.focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  submit.disabled = true;
  grid.inert = true;
  status.textContent = 'Guardando…';
  try {
    const entries = [...grid.children].map(card => ({
      id:Number(card.dataset.id), title:card.querySelector('[name="title"]').value,
      message:card.querySelector('[name="message"]').value, alt:card.querySelector('[name="alt"]').value
    }));
    const response = await fetch(form.action, {method:'POST',
      headers:{'Content-Type':'application/json','X-Editor-Key':form.dataset.key},
      body:JSON.stringify(entries)});
    status.textContent = await response.text() || 'Vuelve a cargar el editor e inténtalo de nuevo.';
    if (response.ok) dirty = false;
  } catch {
    status.textContent = 'No se pudo conectar con el editor local.';
  } finally {
    submit.disabled = false;
    grid.inert = false;
  }
});

window.addEventListener('beforeunload', event => {
  if (dirty) event.preventDefault();
});
