/** @format */

// inject.js
(function () {
  let activeHighlight = null;
  let currentTarget = null;
  let showAllNotes = true;
  let orphanContainer = null;
  let showOrphans = true;
  let lastRenderedNotesJSON = "";

  function safeStorageGet(key) {
    if (!chrome.runtime?.id) return Promise.resolve({});
    return chrome.storage.local.get(key);
  }

  function safeStorageSet(data) {
    if (!chrome.runtime?.id) return Promise.resolve();
    return chrome.storage.local.set(data);
  }

  function ensureNoteOverlayContainer() {
    let container = document.getElementById("note-overlay-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "note-overlay-container";
      Object.assign(container.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "9999999",
      });
      document.body.appendChild(container);
    }
    return container;
  }

  async function isNotesEnabledForSite() {
    const { notesEnabled = true, disabledSites = [] } = await chrome.storage.local.get([
      "notesEnabled",
      "disabledSites",
    ]);
    if (notesEnabled === false) return false;
    return !disabledSites.includes(location.hostname);
  }

  // Wrap renderNotes and note-adding logic:
  async function maybeRenderNotes() {
    const isEnabled = await isNotesEnabledForSite();
    // determine whether show orphans window
    chrome.storage.local.get(["showOrphans"], (data) => {
      showOrphans = !!data.showOrphans;
    });
    if (isEnabled) {
      renderNotes();
    } else {
      // Optionally, hide all notes UI
      document
        .querySelectorAll(".sticky-note-dot, .sticky-note-box, #orphan-notes-container")
        .forEach((n) => n.remove());
    }
  }

  ensureNoteOverlayContainer();
  maybeRenderNotes();

  async function startNewNote(e) {
    if (!e.altKey || !currentTarget) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const primarySelector = getBestSelector(currentTarget);
    const pathSelector = getPathSelector(currentTarget);
    const pathname = window.location.pathname;
    const host = location.hostname;

    window.showNoteModal("", async (noteHTML) => {
      if (!noteHTML) {
        removeHighlight();
        currentTarget = null;
        return;
      }
      const key = `${host}${pathname}`;
      const existing = await safeStorageGet(key);
      const notes = existing[key] || [];
      notes.push({
        selector: {
          primary: primarySelector,
          path: pathSelector,
        },
        note: noteHTML,
        pinned: false,
      });
      await safeStorageSet({ [key]: notes });
      maybeRenderNotes();
      removeHighlight();
      currentTarget = null;
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TOGGLE_NOTES") {
      showAllNotes = !showAllNotes;
      maybeRenderNotes();
    }
    if (message.type === "TOGGLE_ORPHANS") {
      showOrphans = message.show;
      maybeRenderNotes();
    }
    if (message.type === "CONTEXT_ADD_NOTE") {
      // Use the last hovered element or prompt user to click one
      document.body.style.cursor = "crosshair";
      const handler = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        document.body.style.cursor = "";
        document.removeEventListener("mousedown", handler, true);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        currentTarget = el;
        highlightElement(el);

        window.showNoteModal("", async (noteHTML) => {
          if (!noteHTML) {
            removeHighlight();
            currentTarget = null;
            return;
          }
          const primarySelector = getBestSelector(currentTarget);
          const pathSelector = getPathSelector(currentTarget);
          const pathname = window.location.pathname;
          const host = location.hostname;
          const key = `${host}${pathname}`;
          const existing = await safeStorageGet(key);
          const notes = existing[key] || [];
          notes.push({
            selector: {
              primary: primarySelector,
              path: pathSelector,
            },
            note: noteHTML,
            pinned: false,
          });
          await safeStorageSet({ [key]: notes });
          maybeRenderNotes();
          removeHighlight();
          currentTarget = null;
        });
      };
      document.addEventListener("mousedown", handler, true);
      alert("Click on the element you want to add a note to.");
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    currentTarget = el;
    highlightElement(el);
  });

  document.addEventListener("mouseup", startNewNote);

  function addDataNoteTextAttributes() {
    document.querySelectorAll("*").forEach((el) => {
      const text = el.textContent && el.textContent.trim();
      if (
        text &&
        text.length > 0 &&
        text.length <= 200 && // avoid very long texts
        !/\s{2,}/.test(text) // avoid multiple whitespaces
      ) {
        const parent = el.parentNode;
        if (parent) {
          const sameTagSiblings = Array.from(parent.children).filter((child) => child.nodeName === el.nodeName);
          const sameTextCount = sameTagSiblings.filter(
            (child) => child.textContent && child.textContent.trim() === text
          ).length;
          if (sameTextCount === 1) {
            // Escape quotes for attribute value
            const escapedText = text.replace(/"/g, '\\"');
            // Set attribute if not already set (avoid redundancy)
            if (el.getAttribute("data-note-text") !== escapedText) {
              el.setAttribute("data-note-text", escapedText);
            }
          }
        }
      }
    });
  }

  function renderNote(noteData, index) {
    const target = document.querySelector(noteData.selector.primary || noteData.selector.path);
    if (!target) return;

    // Get bounding rect for positioning
    const rect = target.getBoundingClientRect();
    const overlay = ensureNoteOverlayContainer();

    // Create dot
    const dot = document.createElement("div");
    dot.className = "sticky-note-dot";
    dot.textContent = "•";
    Object.assign(dot.style, {
      top: `${rect.top}px`,
      left: `${rect.left - 20}px`,
    });

    // Create note box
    const noteBox = document.createElement("div");
    noteBox.className = "sticky-note-box";
    noteBox.innerHTML = noteData.note;
    Object.assign(noteBox.style, {
      display: noteData.pinned ? "block" : "none",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
    });

    // --- Add Edit Button ---
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.style.marginLeft = "8px";
    editBtn.style.fontSize = "12px";
    editBtn.style.cursor = "pointer";
    editBtn.onclick = async (e) => {
      e.stopPropagation();
      window.showNoteModal(noteData.note, async (newHTML) => {
        const pathname = window.location.pathname;
        const key = `${location.hostname}${pathname}`;
        const data = await safeStorageGet(key);
        const notes = data[key] || [];
        notes[index].note = newHTML;
        await safeStorageSet({ [key]: notes });
        maybeRenderNotes();
      });
    };
    noteBox.appendChild(editBtn);
    // --- End Edit Button ---

    // Highlight border element
    function showHighlight() {
      highlightElement(target);
    }

    // Dot hover/click logic
    dot.addEventListener("mouseenter", () => {
      noteBox.style.display = "block";
      showHighlight();
    });
    dot.addEventListener("mouseleave", () => {
      if (!noteData.pinned) noteBox.style.display = "none";
      removeHighlight();
    });
    dot.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pathname = window.location.pathname;
      const key = `${location.hostname}${pathname}`;
      const data = await safeStorageGet(key);
      const notes = data[key] || [];
      notes[index].pinned = !notes[index].pinned;
      await safeStorageSet({ [key]: notes });
      maybeRenderNotes();
    });

    // Note hover highlights element
    noteBox.addEventListener("mouseenter", showHighlight);
    noteBox.addEventListener("mouseleave", () => {
      if (!noteData.pinned) noteBox.style.display = "none";
      removeHighlight();
    });

    overlay.appendChild(dot);
    overlay.appendChild(noteBox);
  }

  async function renderOrphan({ note, selector, index }) {
    const noteDiv = document.createElement("div");
    noteDiv.style.cursor = "pointer";
    noteDiv.title = selector.primary || note;
    noteDiv.innerHTML = note;

    // add remove button
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.style.marginLeft = "8px";
    removeBtn.style.fontSize = "12px";
    removeBtn.style.cursor = "pointer";

    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const key = `${location.hostname}${window.location.pathname}`;
      const data = await safeStorageGet(key);
      const notes = data[key] || [];
      notes.splice(index, 1);
      await safeStorageSet({ [key]: notes });
      maybeRenderNotes();
    });

    // add copy button
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.style.marginLeft = "8px";
    copyBtn.style.fontSize = "12px";
    copyBtn.style.cursor = "pointer";

    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(note);
      alert("Note copied to clipboard!");
    });

    // add find on click note
    noteDiv.addEventListener("click", (e) => {
      e.stopPropagation();
      // Try to find the closest ancestor matching selector.path, but skip if it's inside the orphan notes board
      let path = selector.path;
      let found = null;
      while (path && path.length > 0) {
        try {
          const candidate = document.querySelector(path);
          if (
            candidate &&
            !candidate.closest("#orphan-notes-container") // skip if inside orphan board
          ) {
            found = candidate;
            break;
          }
        } catch (err) {}
        // Remove last > segment and try again
        path = path.replace(/\s*>\s*[^>]+$/, "");
      }
      if (found) {
        highlightElement(found);
        found.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        alert("No matching element found in DOM for this path.");
      }
    });

    noteDiv.appendChild(removeBtn);

    orphanContainer.appendChild(noteDiv);
  }

  async function renderNotes() {
    const pathname = window.location.pathname;
    const key = `${location.hostname}${pathname}`;
    const data = await safeStorageGet(key);
    const notes = data[key] || [];
    const rendered = [];

    // TODO check if possible to fix
    // Compare with previous notes
    const currentNotesJSON = JSON.stringify(notes);
    if (currentNotesJSON !== lastRenderedNotesJSON) {
      addDataNoteTextAttributes();
      // No change detected, skip rendering
      //   return;
    }

    // clean up
    document.querySelectorAll(".sticky-note-dot, .sticky-note-box").forEach((n) => n.remove());
    if (orphanContainer) orphanContainer.remove();
    orphanContainer = null;
    removeHighlight();

    const orphans = [];

    notes.forEach((noteData, index) => {
      try {
        const el = document.querySelector(noteData.selector.primary || noteData.selector.path);
        if (el) {
          renderNote(noteData, index);
          rendered.push(noteData);
        } else {
          // No matching element, add to orphan list
          orphans.push({ ...noteData, index });
        }
      } catch (err) {
        console.warn("Failed selector:", noteData.selector);
        orphans.push({ ...noteData, index });
      }
    });

    lastRenderedNotesJSON = JSON.stringify(rendered);

    // handle orphans
    if (showOrphans && orphans.length > 0) {
      orphanContainer = document.createElement("div");
      orphanContainer.id = "orphan-notes-container";
      orphanContainer.className = "notebook-wrapper";
      orphanContainer.innerHTML = "<div>Notes not yet on screen:</div>";

      orphans.forEach(renderOrphan);

      document.body.appendChild(orphanContainer);
    }
  }

  /**
   * Determine when to call render notes
   */
  window.addEventListener("DOMContentLoaded", maybeRenderNotes);
  window.addEventListener("scrollend", maybeRenderNotes);
  window.addEventListener("resize", maybeRenderNotes);

  let renderTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(maybeRenderNotes, 2000); // wait 2s after last mutation before rendering
  });
  observer.observe(document.body, { childList: true, subtree: true });

  /**
   * show hide highlight
   **/
  function highlightElement(el) {
    removeHighlight();
    activeHighlight = document.createElement("div");
    const rect = el.getBoundingClientRect();
    Object.assign(activeHighlight.style, {
      position: "absolute",
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: `2px dashed red`,
      zIndex: 9998,
      pointerEvents: "none",
    });
    document.body.appendChild(activeHighlight);
  }

  function removeHighlight() {
    if (activeHighlight) {
      activeHighlight.remove();
      activeHighlight = null;
    }
  }

  /**
   * this is used to get/choose the best selector for the element
   */
  function getBestSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.getAttribute("aria-label")) return `[aria-label="${el.getAttribute("aria-label")}"]`;
    if (el.name) return `[name="${el.name}"]`;

    // Check for unique text content (short, non-empty, not just whitespace)
    const text = el.textContent && el.textContent.trim();
    if (
      text &&
      text.length > 0 &&
      text.length <= 200 && // avoid very long texts for performance and selector simplicity
      !/\s{2,}/.test(text) // avoid multiple consecutive whitespace characters
    ) {
      const parent = el.parentNode;

      if (parent) {
        // Get siblings of same tag name
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.nodeName === el.nodeName);

        // Count siblings with exactly the same trimmed text content
        const sameTextCount = sameTagSiblings.filter(
          (child) => child.textContent && child.textContent.trim() === text
        ).length;

        // If text is unique among siblings, add attribute and return selector
        if (sameTextCount === 1) {
          // Escape double quotes inside text for attribute selector
          const escapedText = text.replace(/"/g, '\\"');
          el.setAttribute("data-note-text", escapedText);
          return `${el.nodeName.toLowerCase()}[data-note-text="${escapedText}"]`;
        }
      }
    }
  }

  function getPathSelector(el) {
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let sel = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === "string") {
        const classes = el.className
          .trim()
          .split(/\s+/)
          .filter((c) => !/\d/.test(c) && !c.startsWith("css-") && !c.includes("--"))
          .join(".");
        if (classes) sel += `.${classes}`;
      }
      const parent = el.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.nodeName === el.nodeName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          sel += `:nth-of-type(${index})`;
        }
      }
      path.unshift(sel);
      el = el.parentNode;
    }
    return path.join(" > ");
  }
})();
