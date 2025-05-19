chrome.storage.local.get(null).then((data) => {
  const header = document.getElementById("header");
  const container = document.getElementById("notesContainer");
  container.innerHTML = "";

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
  function createAccordion(title, contentEl) {
    const section = document.createElement("div");
    section.className = "accordion-section";
    const header = document.createElement("div");
    header.className = "accordion-header";
    header.textContent = title;
    header.style.cursor = "pointer";
    header.style.fontWeight = "bold";
    header.style.margin = "8px 0";
    header.style.background = "#f0f0f0";
    header.style.padding = "6px";
    header.style.borderRadius = "4px";

    const content = document.createElement("div");
    content.className = "accordion-content";
    content.style.display = "none";
    content.appendChild(contentEl);

    header.addEventListener("click", () => {
      content.style.display =
        content.style.display === "none" ? "block" : "none";
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
            (pathname &&
              pathname.toLowerCase().includes(filter.toLowerCase())) ||
            (hostname && hostname.toLowerCase().includes(filter.toLowerCase()))
          ) {
            const noteEl = document.createElement("div");
            noteEl.className = "note";
            noteEl.innerHTML = note.note; // Render as HTML

            // Edit button
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.style.marginLeft = "8px";
            editBtn.onclick = () => {
              window.showNoteModal(note.note, async (newHTML) => {
                note.note = newHTML;
                chrome.storage.local.get(null).then((data) => {
                  const key = Object.keys(data).find(
                    (k) =>
                      data[k] === notes ||
                      (Array.isArray(data[k]) && data[k][noteIdx] === note)
                  );
                  if (key) {
                    data[key][noteIdx].note = newHTML;
                    chrome.storage.local.set({ [key]: data[key] }, () =>
                      location.reload()
                    );
                  }
                });
              });
            };
            noteEl.appendChild(editBtn);

            pathSection.appendChild(noteEl);
            pathHasMatch = true;
            hostHasMatch = true;
          }
        });

        // Accordion for pathname if any match
        if (pathHasMatch) {
          hostSection.appendChild(createAccordion(pathname, pathSection));
        }
      }

      // Accordion for hostname if any match
      if (hostHasMatch) {
        container.appendChild(createAccordion(hostname, hostSection));
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
