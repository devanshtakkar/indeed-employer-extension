// Import the job server URL
import { JOB_SERVER_URL } from './CONSTANTS';

interface JobPosting {
  id: number;
  job_title: string;
  job_location: string;
  post_url: string;
  job_description: string;
  assessment_test_id: string;
  created_at: string;
  updated_at: string;
}

interface JobPostingsResponse {
  success: boolean;
  message: string;
  data?: JobPosting[];
}

// Global variable to store job postings
let jobPostings: JobPosting[] = [];

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton') as HTMLButtonElement;
  const stopButton = document.getElementById('stopButton') as HTMLButtonElement;
  const jobSelect = document.getElementById('jobSelect') as HTMLSelectElement;
  const jobError = document.getElementById('jobError') as HTMLDivElement;
  const statusInfo = document.getElementById('statusInfo') as HTMLDivElement;
  const requestStatus = document.getElementById('requestStatus') as HTMLDivElement;
  const requestStatusContent = document.getElementById('requestStatusContent') as HTMLDivElement;
  
  // Load job postings when popup opens
  loadJobPostings();
  
  // Check current processing state
  checkProcessingState();
  
  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'statusUpdate') {
      updateRequestStatus(message.data, message.isError);
    }
  });
  
  function clearRequestStatus() {
    requestStatus.style.display = 'none';
    requestStatusContent.innerHTML = '';
  }
  
  // Enable start button only when a job is selected
  jobSelect.addEventListener('change', () => {
    const hasSelection = jobSelect.value && jobSelect.value !== "";
    startButton.disabled = !hasSelection;
    hideError(); // Clear any previous errors when selection changes
  });
  
  if (startButton) {
    startButton.addEventListener('click', async () => {
      const selectedJobId = jobSelect.value;
      
      if (!selectedJobId) {
        showError('Please select a job posting first');
        return;
      }
      
      // Disable button and show loading state
      startButton.disabled = true;
      const originalText = startButton.textContent;
      startButton.textContent = 'Starting...';
      
      try {
        // Find the selected job posting data
        const selectedJobData = await getSelectedJobData(parseInt(selectedJobId));
        
        if (!selectedJobData) {
          showError('Selected job posting not found');
          return;
        }
        
        // Store the selected job posting in Chrome local storage
        await chrome.storage.local.set({
          selectedJobPosting: selectedJobData,
          jobPostingId: parseInt(selectedJobId),
          isProcessing: true,
          processingJobId: parseInt(selectedJobId)
        });
        
        console.log('Job posting stored in local storage:', selectedJobData);
        
        // Clear previous status and show starting message
        clearRequestStatus();
        updateRequestStatus({ message: 'Processing started...', success: true }, false);
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
          // Send start message to content script with selected job ID
          chrome.tabs.sendMessage(tab.id, { 
            action: 'start',
            jobPostingId: parseInt(selectedJobId),
            jobPosting: selectedJobData
          });
          console.log('Start message sent to content script with job ID:', selectedJobId);
          
          // Update UI to show processing state
          updateUIForState(true, selectedJobData);
        }
      } catch (error) {
        console.error('Error sending start message:', error);
        showError('Error starting processing. Please try again.');
        
        // Re-enable button and restore text on error
        startButton.disabled = !jobSelect.value;
        startButton.textContent = originalText || 'Start Processing';
      }
    });
  }
  
  // Stop button event listener
  if (stopButton) {
    stopButton.addEventListener('click', async () => {
      try {
        // Send stop message to content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'stop' });
          console.log('Stop message sent to content script');
        }
        
        // Update local storage
        await chrome.storage.local.set({
          isProcessing: false,
          processingJobId: null
        });
        
        // Update UI
        updateUIForState(false);
        
        // Show stop message
        updateRequestStatus({ message: 'Processing stopped by user', success: false }, false);
        
      } catch (error) {
        console.error('Error sending stop message:', error);
        showError('Error stopping processing. Please try again.');
      }
    });
  }
  
  async function loadJobPostings() {
    try {
      hideError();
      
      const response = await fetch(`${JOB_SERVER_URL}/job-postings`);
      const data: JobPostingsResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch job postings');
      }
      
      if (data.success && data.data) {
        populateJobSelect(data.data);
      } else {
        throw new Error(data.message || 'No job postings found');
      }
    } catch (error) {
      console.error('Error loading job postings:', error);
      showError(error instanceof Error ? error.message : 'Failed to load job postings');
      
      // Show retry option
      jobSelect.innerHTML = '<option value="">Failed to load - Click to retry</option>';
      jobSelect.disabled = false;
      jobSelect.addEventListener('click', loadJobPostings, { once: true });
    }
  }
  
  function populateJobSelect(jobPostingsData: JobPosting[]) {
    // Store job postings globally
    jobPostings = jobPostingsData;
    
    jobSelect.innerHTML = '<option value="">Select a job posting...</option>';
    
    jobPostingsData.forEach(job => {
      const option = document.createElement('option');
      option.value = job.id.toString();
      option.textContent = `${job.job_title} (${job.job_location})`;
      jobSelect.appendChild(option);
    });
    
    jobSelect.disabled = false;
  }
  
  function getSelectedJobData(jobId: number): JobPosting | null {
    return jobPostings.find(job => job.id === jobId) || null;
  }
  
  function showError(message: string) {
    jobError.textContent = message;
    jobError.style.display = 'block';
  }
  
  function hideError() {
    jobError.style.display = 'none';
    jobError.textContent = '';
  }
  
  async function checkProcessingState() {
    try {
      const result = await chrome.storage.local.get(['isProcessing', 'processingJobId', 'selectedJobPosting']);
      
      if (result.isProcessing && result.processingJobId) {
        updateUIForState(true, result.selectedJobPosting);
      } else {
        updateUIForState(false);
      }
    } catch (error) {
      console.error('Error checking processing state:', error);
    }
  }
  
  function updateUIForState(isProcessing: boolean, selectedJob?: any) {
    if (isProcessing) {
      // Show processing state
      startButton.classList.add('hidden');
      stopButton.classList.remove('hidden');
      statusInfo.style.display = 'block';
      jobSelect.disabled = true;
      
      if (selectedJob) {
        statusInfo.textContent = `Processing: ${selectedJob.job_title} (${selectedJob.job_location})`;
      } else {
        statusInfo.textContent = 'Processing applicants...';
      }
    } else {
      // Show idle state
      startButton.classList.remove('hidden');
      stopButton.classList.add('hidden');
      statusInfo.style.display = 'none';
      jobSelect.disabled = false;
      
      // Re-enable start button if job is selected
      startButton.disabled = !jobSelect.value;
      startButton.textContent = 'Start Processing';
    }
  }

  function updateRequestStatus(data: any, isError: boolean) {
    requestStatus.style.display = 'block';
    
    if (isError) {
      requestStatus.className = 'status-error';
      requestStatusContent.innerHTML = `
        <strong>Request Failed</strong>
        <div class="status-details">
          Error: ${data.message || 'Network error'}
        </div>
        <div class="status-timestamp">${new Date().toLocaleTimeString()}</div>
      `;
    } else {
      requestStatus.className = data.success ? 'status-success' : 'status-warning';
      
      if (data.success && data.data) {
        const applicant = data.data.applicant;
        const jobPosting = data.data.jobPosting;
        
        requestStatusContent.innerHTML = `
          <strong>${data.message}</strong>
          <div class="status-details">
            <strong>Applicant:</strong>
            <div class="field">Name: ${applicant.firstName} ${applicant.lastName}</div>
            <div class="field">Email: ${applicant.email || 'N/A'}</div>
            <div class="field">Phone: ${applicant.phone || 'N/A'}</div>
            <div class="field">ID: ${applicant.id}</div>
            
            <strong style="margin-top: 8px;">Job Posting:</strong>
            <div class="field">Title: ${jobPosting.title}</div>
            <div class="field">Location: ${jobPosting.location}</div>
            <div class="field">Job ID: ${jobPosting.id}</div>
          </div>
          <div class="status-timestamp">${new Date().toLocaleTimeString()}</div>
        `;
      } else {
        requestStatusContent.innerHTML = `
          <strong>${data.message || 'Request processed'}</strong>
          <div class="status-timestamp">${new Date().toLocaleTimeString()}</div>
        `;
      }
    }
  }
});
