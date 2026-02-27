// Content script for Instagram and X/Twitter comment injection
class CommentInjector {
  constructor() {
    this.init();
  }

  init() {
    const platform = this.detectPlatform();
    console.log(`🚀 Comment Injector loaded (${platform})`);

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ping') {
        console.log('🏓 Received ping - content script is ready');
        sendResponse({ status: 'ready' });
      } else if (request.action === 'injectComment') {
        console.log('📨 Received injectComment message');
        this.injectComment(request.comment, request.platform);
        sendResponse({ status: 'success' });
      }
      return true;
    });
  }

  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('x.com') || host.includes('twitter.com')) return 'x';
    return 'unknown';
  }

  findCommentInput(platform) {
    const effectivePlatform = platform || this.detectPlatform();

    if (effectivePlatform === 'instagram') {
      return this.findInstagramCommentInput();
    }
    if (effectivePlatform === 'x') {
      return this.findXReplyInput();
    }

    // Fallback: try both
    return this.findInstagramCommentInput() || this.findXReplyInput();
  }

  findInstagramCommentInput() {
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
      if (element && element.offsetParent !== null) {
        console.log(`✅ Found Instagram comment input with selector: ${selector}`);
        return { element, platform: 'instagram' };
      }
    }

    return null;
  }

  findXReplyInput() {
    const selectors = [
      'div[data-testid="tweetTextarea_0"]',
      'div[data-testid*="tweetTextarea"]',
      'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
      'div[contenteditable="true"][role="textbox"][aria-label*="Post"]',
      'div[contenteditable="true"][role="textbox"][aria-label*="Reply"]',
      '[aria-label*="Post your reply"]',
      '[aria-label*="Add another Tweet"]',
      'div[contenteditable="true"][role="textbox"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        console.log(`✅ Found X reply input with selector: ${selector}`);
        return { element, platform: 'x' };
      }
    }

    return null;
  }

  injectComment(commentText, platform) {
    const result = this.findCommentInput(platform);
    if (!result) {
      this.showNotification('Could not find comment input field', 'error');
      return;
    }

    const { element: commentInput, platform: detectedPlatform } = result;

    if (detectedPlatform === 'x') {
      this.injectIntoContentEditable(commentInput, commentText);
    } else {
      this.injectIntoTextarea(commentInput, commentText);
    }

    commentInput.focus();

    // Add visual indicator that this was generated
    commentInput.style.border = '2px solid #4CAF50';
    commentInput.style.backgroundColor = '#f0f8f0';

    this.showNotification('✅ Comment generated and inserted!', 'success');

    setTimeout(() => {
      commentInput.style.border = '';
      commentInput.style.backgroundColor = '';
    }, 3000);
  }

  injectIntoTextarea(element, text) {
    element.value = '';
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  injectIntoContentEditable(element, text) {
    element.focus();

    // Select all content so insertText replaces it (works with React-controlled contenteditable)
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    const success = document.execCommand('insertText', false, text);

    if (!success) {
      element.textContent = text;
    }

    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  showNotification(message, type) {
    const existing = document.getElementById('comment-generator-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'comment-generator-notification';
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

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CommentInjector();
  });
} else {
  new CommentInjector();
}
