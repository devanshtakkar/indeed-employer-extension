// Import the job server URL
const JOB_SERVER_URL = "http://localhost:3000";

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
  const jobSelect = document.getElementById('jobSelect') as HTMLSelectElement;
  const jobError = document.getElementById('jobError') as HTMLDivElement;
  
  // Load job postings when popup opens
  loadJobPostings();
  
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
          jobPostingId: parseInt(selectedJobId)
        });
        
        console.log('Job posting stored in local storage:', selectedJobData);
        
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
});
