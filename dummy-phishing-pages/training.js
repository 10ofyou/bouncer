(() => {
  const dialog = document.querySelector('#url-lesson');
  const host = window.location.hostname || 'this training website';
  const hostTargets = document.querySelectorAll('[data-current-host]');
  const protectedControls = document.querySelectorAll('input, form button[type="submit"]');

  hostTargets.forEach((node) => { node.textContent = host; });

  function showLesson(event) {
    event.preventDefault();
    if (event.currentTarget instanceof HTMLInputElement) event.currentTarget.blur();
    if (!dialog.open) dialog.showModal();
  }

  protectedControls.forEach((control) => {
    control.addEventListener('pointerdown', showLesson);
    control.addEventListener('focus', showLesson);
    control.addEventListener('keydown', showLesson);
  });

  document.querySelector('form')?.addEventListener('submit', showLesson);
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); });
})();

