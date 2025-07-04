chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    const profileContainer = document.getElementById('candidateProfileContainer');
    if (profileContainer) {
      console.log(profileContainer);
    } else {
      console.log("Could not find candidate profile container.");
    }
  }
});
