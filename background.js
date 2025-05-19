chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-note",
    title: "Add sticky note here",
    contexts: ["all"],
  });
  chrome.contextMenus.create({
    id: "open-dashboard",
    title: "Open Sticky Notes Dashboard",
    contexts: ["all"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-note") {
    chrome.tabs.sendMessage(tab.id, { type: "CONTEXT_ADD_NOTE" });
  }
  if (info.menuItemId === "open-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});
