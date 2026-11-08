(() => {
  "use strict";
  const source = document.getElementById("site-release");
  if (!source) return;
  const release = JSON.parse(source.textContent);
  const button = document.createElement("button");
  button.id = "release-version";
  button.type = "button";
  button.textContent = release.label;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "release-notes");
  const dialog = document.createElement("dialog");
  dialog.id = "release-notes";
  dialog.setAttribute("aria-labelledby", "release-notes-title");
  const title = document.createElement("h2");
  title.id = "release-notes-title";
  title.textContent = "패치노트";
  const version = document.createElement("p");
  version.className = "release-notes-version";
  version.textContent = release.label;
  const notes = document.createElement("ul");
  for (const note of release.notes) {
    const item = document.createElement("li");
    item.textContent = note;
    notes.append(item);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "secondary-action";
  close.textContent = "닫기";
  close.autofocus = true;
  close.addEventListener("click", () => dialog.close());
  button.addEventListener("click", () => { if (!dialog.open) dialog.showModal(); });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.append(title, version, notes, close);
  document.body.append(button, dialog);
})();
