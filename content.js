// Content script for Instagram comment injection
class InstagramCommentInjector {
  constructor() {
    this.init();
  }

  init() {
    console.log('🚀 Instagram Comment Injector loaded');
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ping') {
        console.log('🏓 Received ping - content script is ready');
        sendResponse({status: 'ready'});
      } else if (request.action === 'injectComment') {
        console.log('📨 Received injectComment message');
        this.injectComment(request.comment);
        sendResponse({status: 'success'});
      }
      return true;
    });
  }

  findCommentInput() {
    // Multiple selectors for the comment input field
    const selectors = [
      'textarea[placeholder*="comment"]',
      'textarea[aria-label*="comment"]',
      'textarea[aria-label*="Add a comment"]',
      'div[contenteditable="true"][data-testid="comment-input"]',
      'textarea[placeholder*="Add a comment"]',
      'div[role="textbox"][aria-label*="comment"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // Element is visible
        console.log(`✅ Found comment input with selector: ${selector}`);
        return element;
      }
    }

    console.log('❌ Could not find comment input field');
    return null;
  }

  injectComment(commentText) {
    const commentInput = this.findCommentInput();
    if (!commentInput) {
      this.showNotification('Could not find comment input field', 'error');
      return;
    }

    // Clear existing content
    commentInput.value = '';
    commentInput.textContent = '';
    
    // Set the comment text
    if (commentInput.tagName === 'TEXTAREA') {
      commentInput.value = commentText;
    } else {
      commentInput.textContent = commentText;
    }

    // Trigger input events to notify Instagram
    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
    commentInput.dispatchEvent(new Event('change', { bubbles: true }));
    commentInput.focus();

    // Add visual indicator that this was generated
    commentInput.style.border = '2px solid #4CAF50';
    commentInput.style.backgroundColor = '#f0f8f0';
    
    // Show success notification
    this.showNotification('✅ Comment generated and inserted!', 'success');
    
    // Remove visual indicator after 3 seconds
    setTimeout(() => {
      commentInput.style.border = '';
      commentInput.style.backgroundColor = '';
    }, 3000);
  }

  showNotification(message, type) {
    // Remove any existing notification
    const existing = document.getElementById('ig-comment-generator-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'ig-comment-generator-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : '#28a745'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      ">
        ${message}
      </div>
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

// Initialize the injector
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new InstagramCommentInjector();
  });
} else {
  new InstagramCommentInjector();
}
