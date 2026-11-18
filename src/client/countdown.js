const clock = document.querySelector('[data-remaining]');
if (clock) {
  const initial = Number(clock.dataset.remaining);
  const units = JSON.parse(clock.dataset.units);
  const started = performance.now();
  const render = () => {
    const remaining = Math.ceil((initial - (performance.now() - started)) / 1000);
    if (remaining <= 0) return location.reload();
    const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24,
      Math.floor(remaining / 60) % 60, remaining % 60];
    clock.textContent = values.map((value, index) => value + ' ' + units[index]).join(' · ');
  };
  render();
  setInterval(render, 1000);
}
