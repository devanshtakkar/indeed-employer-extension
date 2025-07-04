document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton');
  
  if (startButton) {
    startButton.addEventListener('click', async () => {
      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
          // Send start message to content script
          chrome.tabs.sendMessage(tab.id, { action: 'start' });
          console.log('Start message sent to content script');
          
          // Close popup after starting
          window.close();
        }
      } catch (error) {
        console.error('Error sending start message:', error);
      }
    });
  }
});
