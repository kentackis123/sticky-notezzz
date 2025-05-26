document.addEventListener("DOMContentLoaded", () => {
  // 1. Toggle Notes Switch
  const toggleBtn = document.getElementById("toggleNotes");
  if (toggleBtn) {
    // Get state from storage
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.storage.local.get(["notesEnabled"], (data) => {
        const enabled = data.notesEnabled !== false;
        toggleBtn.textContent = enabled ? "Disable Notes" : "Enable Notes";
      });
    });

    toggleBtn.addEventListener("click", () => {
      const enabled = toggleBtn.textContent === "Enable Notes";
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
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) {
        const url = new URL(tab.url);
        chrome.storage.local.get(["disabledSites"], (data) => {
          const disabledSites = data.disabledSites || [];
          const isDisabled = disabledSites.includes(url.hostname);
          disableSiteBtn.textContent = isDisabled
            ? "Enable for this site"
            : "Disable for this site";
        });
      }
    });

    disableSiteBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.url) {
          const url = new URL(tab.url);
          chrome.storage.local.get(["disabledSites"], (data) => {
            let disabledSites = data.disabledSites || [];
            const isDisabled = disabledSites.includes(url.hostname);
            if (isDisabled) {
              disabledSites = disabledSites.filter((h) => h !== url.hostname);
            } else {
              disabledSites.push(url.hostname);
            }
            chrome.storage.local.set({ disabledSites }, () => {
              disableSiteBtn.textContent = isDisabled
                ? "Disable for this site"
                : "Enable for this site";
              // Optionally, notify content script to re-render
              chrome.tabs.query(
                { active: true, currentWindow: true },
                ([tab]) => {
                  if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_NOTES" });
                  }
                }
              );
            });
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

// control orphan container
const toggleOrphans = document.getElementById("toggleOrphans");
if (toggleOrphans) {
  chrome.storage.local.get(["showOrphans"], (data) => {
    toggleOrphans.checked = !!data.showOrphans;
  });
  toggleOrphans.addEventListener("change", () => {
    chrome.storage.local.set({ showOrphans: toggleOrphans.checked });
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "TOGGLE_ORPHANS",
          show: toggleOrphans.checked,
        });
      }
    });
  });
}
