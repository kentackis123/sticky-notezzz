/** @format */

chrome.storage.local.get(null).then((data) => {
  const header = document.getElementById("header");
  const container = document.getElementById("notesContainer");
  container.innerHTML = "";

  function safeStorageGet(key) {
    if (!chrome.runtime?.id) return Promise.resolve({});
    return chrome.storage.local.get(key);
  }

  function safeStorageSet(data) {
    if (!chrome.runtime?.id) return Promise.resolve();
    return chrome.storage.local.set(data);
  }

  // --- Import/Export Buttons ---
  const importExportBar = document.createElement("div");
  importExportBar.style.display = "flex";
  importExportBar.style.justifyContent = "flex-end";
  importExportBar.style.gap = "8px";
  importExportBar.style.marginBottom = "8px";
  // Export Button
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export";
  exportBtn.onclick = () => {
    chrome.storage.local.get(null).then((allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sticky-notes-export.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  };

  // Import Button
  const importBtn = document.createElement("button");
  importBtn.textContent = "Import";
  importBtn.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = (e) => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          // Validate structure: must be an object, keys are strings, values are arrays of notes
          if (
            typeof imported !== "object" ||
            Array.isArray(imported) ||
            Object.entries(imported).some(([key, notes]) => {
              if (key !== "notesEnabled") {
                return !Array.isArray(notes);
              }
              return false;
            })
          ) {
            alert("Invalid import file structure.");
            return;
          }
          // Merge with existing data
          chrome.storage.local.get(null).then((existing) => {
            const merged = { ...existing };
            for (const [key, notes] of Object.entries(imported)) {
              if (!Array.isArray(notes)) continue;
              if (!merged[key]) merged[key] = [];
              merged[key] = merged[key].concat(notes);
            }
            chrome.storage.local.set(merged, () => location.reload());
          });
        } catch (err) {
          alert("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  importExportBar.appendChild(importBtn);
  importExportBar.appendChild(exportBtn);
  header.appendChild(importExportBar);

  // --- Add Search Bar ---
  const searchBar = document.createElement("input");
  searchBar.type = "text";
  searchBar.placeholder = "Search notes...";
  searchBar.style.width = "100%";
  searchBar.style.margin = "12px 0";
  searchBar.style.padding = "6px";
  searchBar.style.fontSize = "16px";
  container.appendChild(searchBar);
  // --- End Search Bar ---

  if (Object.keys(data).length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "No notes saved yet.";
    container.appendChild(emptyMsg);
    return;
  }

  // Group notes by hostname and then by pathname
  const grouped = {};
  for (const [key, notes] of Object.entries(data)) {
    // key is like "hostname/pathname"
    const match = key.match(/^([^/]+)(\/.*)$/);
    if (!match) continue;
    const [_, hostname, pathname] = match;
    if (!grouped[hostname]) grouped[hostname] = {};
    grouped[hostname][pathname] = notes;
  }

  // Helper to create accordion section
  function createAccordion(title, contentEl, url = null) {
    const section = document.createElement("div");
    section.className = "accordion-section";
    const header = document.createElement("div");
    header.className = "accordion-header";

    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = title;
      link.target = "_blank";
      header.appendChild(link);
    } else {
      header.textContent = title;
    }

    const content = document.createElement("div");
    content.className = "accordion-content";
    content.style.display = "none";
    content.appendChild(contentEl);

    header.addEventListener("click", () => {
      content.style.display = content.style.display === "none" ? "block" : "none";
    });

    section.appendChild(header);
    section.appendChild(content);
    return section;
  }

  // --- Render notes (wrapped in a function for search) ---
  function renderNotes(filter = "") {
    // Remove all except search bar
    Array.from(container.children).forEach((child) => {
      if (child !== searchBar) child.remove();
    });

    for (const [hostname, pathGroups] of Object.entries(grouped)) {
      const hostSection = document.createElement("div");
      hostSection.className = "site-group";

      let hostHasMatch = false;

      for (const [pathname, notes] of Object.entries(pathGroups)) {
        const pathSection = document.createElement("div");
        pathSection.className = "pathname-group";

        let pathHasMatch = false;

        notes.forEach((note, noteIdx) => {
          // Filter by search
          const noteText = (note.note || "").toLowerCase();
          if (
            !filter ||
            noteText.includes(filter.toLowerCase()) ||
            (pathname && pathname.toLowerCase().includes(filter.toLowerCase())) ||
            (hostname && hostname.toLowerCase().includes(filter.toLowerCase()))
          ) {
            const noteEl = document.createElement("div");
            const noteTextEl = document.createElement("div");
            noteTextEl.innerHTML = note.note; // Render as HTML
            noteEl.appendChild(noteTextEl);
            noteEl.className = "dash-note";

            // Delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              const key = `${hostname}${pathname}`;
              const data = await safeStorageGet(key);
              const notes = data[key] || [];
              notes.splice(noteIdx, 1);
              await safeStorageSet({ [key]: notes });
              location.reload();
            });
            // Edit button
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.onclick = () => {
              window.showNoteModal(note.note, async (newHTML) => {
                const key = `${hostname}${pathname}`;
                chrome.storage.local.get(key, (data) => {
                  const notesArr = data[key] || [];
                  notesArr[noteIdx].note = newHTML;
                  chrome.storage.local.set({ [key]: notesArr }, () => location.reload());
                });
              });
            };

            const actionBar = document.createElement("div");
            actionBar.classList.add("action-bar");
            actionBar.appendChild(editBtn);
            actionBar.appendChild(deleteBtn);
            noteEl.appendChild(actionBar);
            pathSection.appendChild(noteEl);
            pathHasMatch = true;
            hostHasMatch = true;
          }
        });

        // Accordion for pathname if any match
        if (pathHasMatch) {
          const url = `https://${hostname}${pathname}`;
          hostSection.appendChild(createAccordion(pathname, pathSection, url));
        }
      }

      // Accordion for hostname if any match
      if (hostHasMatch) {
        const url = `https://${hostname}`;
        container.appendChild(createAccordion(hostname, hostSection, url));
      }
    }
  }

  // Initial render
  renderNotes();

  // Search handler
  searchBar.addEventListener("input", (e) => {
    renderNotes(searchBar.value);
  });
});
