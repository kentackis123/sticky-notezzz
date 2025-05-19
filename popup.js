document.addEventListener("DOMContentLoaded", () => {
  // 1. Toggle Notes Switch
  const toggleBtn = document.getElementById("toggleNotes");
  const toggleSwitch = document.getElementById("toggleNotesSwitch");
  if (toggleBtn && toggleSwitch) {
    // Get state from storage
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.storage.local.get(["notesEnabled"], (data) => {
        const enabled = data.notesEnabled !== false;
        toggleSwitch.checked = enabled;
        toggleBtn.textContent = enabled ? "Disable Notes" : "Enable Notes";
      });
    });

    toggleSwitch.addEventListener("change", () => {
      const enabled = toggleSwitch.checked;
      chrome.storage.local.set({ notesEnabled: enabled });
      toggleBtn.textContent = enabled ? "Disable Notes" : "Enable Notes";
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_NOTES", enabled });
        }
      });
    });
  }

  // 2. Disable for this site
  const disableSiteBtn = document.getElementById("disableForSite");
  if (disableSiteBtn) {
    disableSiteBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.url) {
          const url = new URL(tab.url);
          chrome.storage.local.get(["disabledSites"], (data) => {
            const disabledSites = data.disabledSites || [];
            if (!disabledSites.includes(url.hostname)) {
              disabledSites.push(url.hostname);
              chrome.storage.local.set({ disabledSites });
            }
          });
        }
      });
    });
  }

  // 3. Show all notes (open dashboard)
  const dashboardBtn = document.getElementById("openDashboard");
  if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });
  }
});
