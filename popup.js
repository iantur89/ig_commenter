// Popup script for the Chrome extension
class PopupController {
  constructor() {
    this.defaultInstructions = null;
    this.init();
  }

  async init() {
    await this.loadDefaultInstructions();
    this.loadSavedApiKey();
    this.loadSavedInstructions();
    this.setupEventListeners();
  }

  async loadDefaultInstructions() {
    try {
      const url = chrome.runtime.getURL('sys_instructions.txt');
      const response = await fetch(url);
      this.defaultInstructions = await response.text();
    } catch (error) {
      console.error('Error loading default instructions:', error);
      this.defaultInstructions = 'Error loading default instructions';
    }
  }

  setupEventListeners() {
    // API Key management
    document.getElementById('saveConfig').addEventListener('click', () => {
      this.saveConfiguration();
    });

    document.getElementById('apiKey').addEventListener('input', (e) => {
      chrome.storage.local.set({ apiKey: e.target.value });
    });

    // Instructions editor collapse/expand
    document.getElementById('instructionsToggle').addEventListener('click', () => {
      this.toggleInstructions();
    });

    // Instructions management
    document.getElementById('saveInstructions').addEventListener('click', () => {
      this.saveInstructions();
    });

    document.getElementById('resetInstructions').addEventListener('click', () => {
      this.resetInstructions();
    });

    document.getElementById('reloadInstructions').addEventListener('click', () => {
      this.reloadInstructions();
    });

    // Comment generation
    document.getElementById('generateComment').addEventListener('click', () => {
      this.generateComment();
    });
  }

  toggleInstructions() {
    const content = document.getElementById('instructionsContent');
    const icon = document.querySelector('.collapse-icon');
    
    if (content.classList.contains('open')) {
      content.classList.remove('open');
      icon.classList.remove('open');
    } else {
      content.classList.add('open');
      icon.classList.add('open');
    }
  }

  async loadSavedApiKey() {
    try {
      const result = await chrome.storage.local.get(['apiKey']);
      if (result.apiKey) {
        document.getElementById('apiKey').value = result.apiKey;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  async loadSavedInstructions() {
    try {
      const result = await chrome.storage.local.get(['systemInstructions']);
      const textarea = document.getElementById('systemInstructions');
      
      if (result.systemInstructions) {
        textarea.value = result.systemInstructions;
      } else if (this.defaultInstructions) {
        // First time: load from file and save to storage
        textarea.value = this.defaultInstructions;
        await chrome.storage.local.set({ systemInstructions: this.defaultInstructions });
      }
    } catch (error) {
      console.error('Error loading instructions:', error);
    }
  }

  async saveConfiguration() {
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.showStatus('API key should start with "sk-"', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey });
      this.showStatus('API key saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Error saving API key', 'error');
    }
  }

  async saveInstructions() {
    const instructions = document.getElementById('systemInstructions').value.trim();
    
    if (!instructions) {
      this.showStatus('Instructions cannot be empty', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ systemInstructions: instructions });
      this.showStatus('Instructions saved successfully!', 'success');
    } catch (error) {
      this.showStatus('Error saving instructions', 'error');
    }
  }

  async resetInstructions() {
    if (!confirm('Reset to default instructions? This will overwrite your current instructions and reload from the file.')) {
      return;
    }

    try {
      // Force reload the instructions from the file
      await this.loadDefaultInstructions();
      
      const textarea = document.getElementById('systemInstructions');
      textarea.value = this.defaultInstructions;
      await chrome.storage.local.set({ systemInstructions: this.defaultInstructions });
      this.showStatus('Instructions reset and reloaded from file', 'success');
    } catch (error) {
      this.showStatus('Error resetting instructions', 'error');
    }
  }

  async reloadInstructions() {
    try {
      this.showStatus('Reloading instructions from file...', 'info');
      
      // Force reload the instructions from the file
      await this.loadDefaultInstructions();
      
      const textarea = document.getElementById('systemInstructions');
      textarea.value = this.defaultInstructions;
      await chrome.storage.local.set({ systemInstructions: this.defaultInstructions });
      
      this.showStatus('Instructions reloaded from file successfully!', 'success');
    } catch (error) {
      this.showStatus('Error reloading instructions', 'error');
    }
  }

  async captureScreenshot() {
    try {
      console.log('📸 Capturing screenshot...');
      
      // Capture visible tab as base64 data URL
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(
        null,
        { format: 'png' }
      );
      
      console.log('✅ Screenshot captured successfully');
      return screenshotDataUrl;
    } catch (error) {
      console.error('❌ Screenshot capture failed:', error);
      throw new Error('Failed to capture screenshot: ' + error.message);
    }
  }

  async checkContentScriptLoaded(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.status === 'ready';
    } catch (error) {
      return false;
    }
  }

  async generateComment() {
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key first', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Platform detection and URL validation
      let platform = null;
      if (tab.url.includes('instagram.com')) {
        if (tab.url.includes('/p/') || tab.url.includes('/reel/')) {
          platform = 'instagram';
        } else {
          this.showStatus('Please navigate to a specific Instagram post or reel first', 'error');
          return;
        }
      } else if (tab.url.includes('x.com') || tab.url.includes('twitter.com')) {
        if (tab.url.includes('/status/')) {
          platform = 'x';
        } else {
          this.showStatus('Please navigate to a specific tweet page first', 'error');
          return;
        }
      } else {
        this.showStatus('Please navigate to an Instagram post or X tweet page first', 'error');
        return;
      }

      // Check if content script is loaded
      const contentScriptLoaded = await this.checkContentScriptLoaded(tab.id);
      if (!contentScriptLoaded) {
        this.showStatus('Content script not loaded. Please refresh the page and try again.', 'error');
        return;
      }

      this.showStatus('Taking screenshot and generating comment...', 'info');
      
      // Disable button during generation
      const generateBtn = document.getElementById('generateComment');
      generateBtn.disabled = true;
      generateBtn.textContent = 'Processing...';

      // Capture screenshot
      const screenshot = await this.captureScreenshot();
      
      this.showStatus('Analyzing with AI vision...', 'info');

      // Get custom instructions from storage
      const result = await chrome.storage.local.get(['systemInstructions']);
      const systemInstructions = result.systemInstructions || this.defaultInstructions;

      // Send screenshot to background script for OpenAI Vision API
      const response = await chrome.runtime.sendMessage({
        action: 'callOpenAI',
        screenshot: screenshot,
        apiKey: apiKey,
        systemInstructions: systemInstructions,
        platform: platform
      });

      if (response.success && response.comment) {
        this.showStatus('Comment generated! Injecting...', 'success');
        
        // Inject comment into page
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'injectComment',
            comment: response.comment,
            platform: platform
          });
          this.showStatus('✅ Comment injected successfully!', 'success');
        } catch (injectError) {
          console.error('Failed to inject comment:', injectError);
          this.showStatus('Comment generated but failed to inject. Try refreshing the page.', 'error');
        }
      } else {
        this.showStatus(response.error || 'Failed to generate comment', 'error');
      }

    } catch (error) {
      console.error('Error generating comment:', error);
      this.showStatus('Error: ' + error.message, 'error');
    } finally {
      // Re-enable button
      const generateBtn = document.getElementById('generateComment');
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate AI Comment';
    }
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    // Auto-hide success and info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
