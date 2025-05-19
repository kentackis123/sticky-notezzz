window.showNoteModal = function (initialHTML = "", onSave) {
  // Remove any existing modal
  document.getElementById("sticky-note-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "sticky-note-modal";

  const box = document.createElement("div");
  box.classList.add("sticky-note-modal-box");

  // Toolbar for bold/italic/underline/ul/ol (no inline handlers)
  const toolbar = document.createElement("div");
  toolbar.style.marginBottom = "8px";

  const boldBtn = document.createElement("button");
  boldBtn.type = "button";
  boldBtn.textContent = "B";
  boldBtn.style.fontWeight = "bold";
  boldBtn.onclick = () => document.execCommand("bold", false, null);

  const italicBtn = document.createElement("button");
  italicBtn.type = "button";
  italicBtn.textContent = "I";
  italicBtn.style.fontStyle = "italic";
  italicBtn.onclick = () => document.execCommand("italic", false, null);

  const underlineBtn = document.createElement("button");
  underlineBtn.type = "button";
  underlineBtn.textContent = "U";
  underlineBtn.style.textDecoration = "underline";
  underlineBtn.onclick = () => document.execCommand("underline", false, null);

  // Unordered List button
  const ulBtn = document.createElement("button");
  ulBtn.type = "button";
  ulBtn.textContent = "• List";
  ulBtn.style.marginLeft = "8px";
  ulBtn.onclick = () =>
    document.execCommand("insertUnorderedList", false, null);

  // Ordered List button
  const olBtn = document.createElement("button");
  olBtn.type = "button";
  olBtn.textContent = "1. List";
  olBtn.style.marginLeft = "4px";
  olBtn.onclick = () => document.execCommand("insertOrderedList", false, null);

  toolbar.appendChild(boldBtn);
  toolbar.appendChild(italicBtn);
  toolbar.appendChild(underlineBtn);
  toolbar.appendChild(ulBtn);
  toolbar.appendChild(olBtn);

  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.style.border = "1px solid #ccc";
  editor.style.minHeight = "60px";
  editor.style.padding = "8px";
  editor.innerHTML = initialHTML;

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.style.marginTop = "10px";
  saveBtn.onclick = () => {
    onSave(editor.innerHTML);
    modal.remove();
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginLeft = "10px";
  cancelBtn.onclick = () => modal.remove();

  box.appendChild(toolbar);
  box.appendChild(editor);
  box.appendChild(saveBtn);
  box.appendChild(cancelBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
};
