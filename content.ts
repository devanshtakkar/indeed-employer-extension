chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    const profileContainer = document.getElementById('candidateProfileContainer');
    if (profileContainer) {
      const profileData = profileContainer.innerHTML;
      fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile: profileData }),
      })
      .then(response => response.json())
      .then(data => console.log('Success:', data))
      .catch((error) => console.error('Error:', error));
    } else {
      console.log("Could not find candidate profile container.");
    }
  }
});
