import { JOB_SERVER_URL } from './CONSTANTS';

// Global variable to track processing state
let isProcessing = false;
let jobPostingId: number | null = null;

// Check if processing was already running when page loads
chrome.storage.local.get(['isProcessing', 'processingJobId'], (result) => {
  if (result.isProcessing && result.processingJobId) {
    isProcessing = result.isProcessing;
    jobPostingId = result.processingJobId;
    console.log('Resuming processing for job posting ID:', jobPostingId);
    
    // Wait a moment for page to load, then continue processing
    setTimeout(() => {
      if (isProcessing) {
        processPageAndNavigate();
      }
    }, 1000);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    if (request.jobPostingId) {
      jobPostingId = request.jobPostingId;
      isProcessing = true;
      
      // Store processing state in local storage
      chrome.storage.local.set({
        isProcessing: true,
        processingJobId: jobPostingId
      });
      
      console.log('Starting processing for job posting ID:', jobPostingId);
      processPageAndNavigate();
    } else {
      console.error('No job posting ID provided');
    }
  } else if (request.action === 'stop') {
    console.log('Stop signal received');
    isProcessing = false;
    jobPostingId = null;
    
    // Update processing state in local storage
    chrome.storage.local.set({
      isProcessing: false,
      processingJobId: null
    });
  }
});

// Function to wait for navigation to complete by monitoring URL changes and DOM elements
function waitForPageToLoad(expectedUrlPattern?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = 5000; // 5 seconds timeout
    const pollInterval = 100; // Check every 100ms
    
    const currentUrl = window.location.href;
    
    const checkPageReady = () => {
      // Check if we've timed out
      if (Date.now() - startTime > timeout) {
        console.log('Navigation timeout - proceeding anyway');
        resolve();
        return;
      }
      
      // Check if URL has changed (indicating navigation occurred)
      const newUrl = window.location.href;
      const urlChanged = newUrl !== currentUrl;
      
      // Check if the key elements are present (indicating page has loaded)
      const profileContainer = document.getElementById('candidateProfileContainer');
      const nextButton = document.getElementById('nextPreBlock-next');
      
      // Check if document is ready
      const documentReady = document.readyState === 'complete';
      
      if (urlChanged && profileContainer && documentReady) {
        console.log(`Navigation complete - URL changed from ${currentUrl} to ${newUrl}`);
        resolve();
      } else {
        // Keep polling
        setTimeout(checkPageReady, pollInterval);
      }
    };
    
    // Start checking after a brief delay to allow navigation to begin
    setTimeout(checkPageReady, pollInterval);
  });
}

// Alternative approach: wait for URL change + DOM stability
function waitForNavigationComplete(): Promise<void> {
  return new Promise((resolve) => {
    const originalUrl = window.location.href;
    let checkCount = 0;
    const maxChecks = 50; // 5 seconds max (50 * 100ms)
    
    const checkNavigation = () => {
      checkCount++;
      
      // If we've exceeded max checks, resolve anyway
      if (checkCount >= maxChecks) {
        console.log('Max navigation checks reached, proceeding...');
        resolve();
        return;
      }
      
      const currentUrl = window.location.href;
      
      // Check if URL has changed
      if (currentUrl !== originalUrl) {
        // URL changed, now wait for the page to be ready
        console.log(`URL changed from ${originalUrl} to ${currentUrl}`);
        
        // Additional check for DOM readiness
        const checkDOMReady = () => {
          const profileContainer = document.getElementById('candidateProfileContainer');
          const documentReady = document.readyState === 'complete';
          
          if (profileContainer && documentReady) {
            console.log('DOM is ready, navigation complete');
            resolve();
          } else {
            // Keep checking DOM for a bit longer
            setTimeout(checkDOMReady, 100);
          }
        };
        
        // Wait a moment for DOM to settle, then check
        setTimeout(checkDOMReady, 200);
      } else {
        // URL hasn't changed yet, keep checking
        setTimeout(checkNavigation, 100);
      }
    };
    
    // Start checking
    checkNavigation();
  });
}

async function processPageAndNavigate() {
  // Check if processing should continue
  if (!isProcessing) {
    console.log('Processing stopped by user');
    return;
  }

  const profileContainer = document.getElementById('candidateProfileContainer');
  console.log('profileContainer', profileContainer);
  if (profileContainer) {
    const profileData = profileContainer.innerHTML;
    
    // Check if we have a job posting ID
    if (!jobPostingId) {
      console.error('No job posting ID available. Cannot process profile.');
      return;
    }
    
    try {
      const response = await fetch(`${JOB_SERVER_URL}/indeed-applicant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profile: profileData,
          job_posting_id: jobPostingId
        }),
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

  // Check again before continuing navigation
  if (!isProcessing) {
    console.log('Processing stopped during profile submission');
    return;
  }

  // Now, find and click the next button
  const nextButton = document.getElementById('nextPreBlock-next');
  if (nextButton) {
    console.log("Clicking next button...");
    
    // Click the next button
    (nextButton as HTMLElement).click();

    // Wait for navigation to complete using URL change detection
    try {
      await waitForNavigationComplete();
      console.log("Navigation completed, continuing...");
      
      // Continue the loop only if still processing
      if (isProcessing) {
        processPageAndNavigate();
      } else {
        console.log('Processing stopped during navigation');
      }
    } catch (error) {
      console.error("Error waiting for navigation:", error);
    }
  } else {
    console.log("Next button not found. Ending loop.");
    // Update processing state when ending
    isProcessing = false;
    chrome.storage.local.set({
      isProcessing: false,
      processingJobId: null
    });
  }
}
