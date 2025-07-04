chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    processPageAndNavigate();
  }
});

async function processPageAndNavigate() {
  const profileContainer = document.getElementById('candidateProfileContainer');
  if (profileContainer) {
    const profileData = profileContainer.innerHTML;
    try {
      const response = await fetch('http://localhost:3000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile: profileData }),
      });
      const data = await response.json();
      console.log('Successfully sent profile data:', data);
    } catch (error) {
      console.error('Error sending profile data:', error);
    }
  } else {
    console.log("Could not find candidate profile container. Ending loop.");
    return; // End the loop if container not found
  }

  // Now, find and click the next button
  const nextButton = document.getElementById('nextPreBlock-next');
  if (nextButton) {
    console.log("Clicking next button...");
    (nextButton as HTMLElement).click();

    // Wait for a short period for the page to load/network to settle
    // Note: This is a simple delay. For more robust network idle detection,
    // a background script with chrome.webRequest API would be needed.
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds delay

    // Continue the loop
    processPageAndNavigate();
  } else {
    console.log("Next button not found. Ending loop.");
  }
}
