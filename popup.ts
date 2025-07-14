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

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton') as HTMLButtonElement;
  const jobSelect = document.getElementById('jobSelect') as HTMLSelectElement;
  const jobError = document.getElementById('jobError') as HTMLDivElement;
  
  // Load job postings when popup opens
  loadJobPostings();
  
  // Enable start button only when a job is selected
  jobSelect.addEventListener('change', () => {
    startButton.disabled = !jobSelect.value;
  });
  
  if (startButton) {
    startButton.addEventListener('click', async () => {
      const selectedJobId = jobSelect.value;
      
      if (!selectedJobId) {
        showError('Please select a job posting first');
        return;
      }
      
      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.id) {
          // Send start message to content script with selected job ID
          chrome.tabs.sendMessage(tab.id, { 
            action: 'start',
            jobPostingId: parseInt(selectedJobId)
          });
          console.log('Start message sent to content script with job ID:', selectedJobId);
          
          // Close popup after starting
          window.close();
        }
      } catch (error) {
        console.error('Error sending start message:', error);
        showError('Error starting processing. Please try again.');
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
  
  function populateJobSelect(jobPostings: JobPosting[]) {
    jobSelect.innerHTML = '<option value="">Select a job posting...</option>';
    
    jobPostings.forEach(job => {
      const option = document.createElement('option');
      option.value = job.id.toString();
      option.textContent = `${job.job_title} (${job.job_location})`;
      jobSelect.appendChild(option);
    });
    
    jobSelect.disabled = false;
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
