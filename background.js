// Background script for handling OpenAI API calls with Vision

// Hardcoded clarification to reduce model refusals - always prepended to system instructions
const SYSTEM_CONTEXT_PREFIX = `**Context:** The user owns this account and is asking you to help them draft a reply. They will decide whether to post it. You are a writing assistant, not automating their account. The user always controls what gets posted. Generate the draft reply as requested.

---

`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callOpenAI') {
    handleOpenAICall(request, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function handleOpenAICall(request, sendResponse) {
  try {
    const { screenshot, apiKey, systemInstructions, platform } = request;
    
    if (!apiKey) {
      sendResponse({ success: false, error: 'OpenAI API key not provided' });
      return;
    }

    if (!screenshot) {
      sendResponse({ success: false, error: 'No screenshot provided' });
      return;
    }

    if (!systemInstructions) {
      sendResponse({ success: false, error: 'System instructions not provided' });
      return;
    }

    // Platform-specific user message for the API call (framed as human-assisted drafting)
    const userMessageText = platform === 'x'
      ? 'The user owns this account and is asking for help drafting their reply. This screenshot shows a tweet they want to respond to. Please read the tweet text, then write a draft reply using the system instructions. The user will review and post it themselves. Output only the reply text (or "skip" if irrelevant). Keep under 280 characters.'
      : 'The user owns this account and is asking for help drafting their comment. This screenshot shows an Instagram post they want to respond to. Please read the post caption, then write a draft comment using the system instructions. The user will review and post it themselves. Output only the comment text (or "skip" if irrelevant).';

    const systemContent = SYSTEM_CONTEXT_PREFIX + systemInstructions;

    // Prepare the messages for the API call
    const messages = [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessageText
          },
          {
            type: 'image_url',
            image_url: {
              url: screenshot,
              detail: 'high'
            }
          }
        ]
      }
    ];

    // Log the full prompt being sent
    console.log('🤖 SENDING PROMPT TO OPENAI:');
    console.log('System Instructions:', systemInstructions);
    console.log('User Message:', messages[1].content[0].text);
    console.log('Full Messages Array:', JSON.stringify(messages, null, 2));

    // Call GPT-4o Vision API with Chat Completions
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = `API request failed: ${response.status}`;
      
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      }
      
      sendResponse({ success: false, error: errorMessage });
      return;
    }

    const data = await response.json();
    
    // Log the full response from OpenAI
    console.log('🤖 RECEIVED RESPONSE FROM OPENAI:');
    console.log('Full Response:', JSON.stringify(data, null, 2));
    console.log('Generated Comment (raw):', data.choices?.[0]?.message?.content);
    
    if (data.choices && data.choices[0]?.message?.content) {
      let generatedComment = data.choices[0].message.content.trim();
      
      // Log the comment before and after processing
      console.log('📝 COMMENT PROCESSING:');
      console.log('Raw comment from AI:', generatedComment);
      
      // Strip outer quotation marks if present
      if ((generatedComment.startsWith('"') && generatedComment.endsWith('"')) || 
          (generatedComment.startsWith("'") && generatedComment.endsWith("'"))) {
        generatedComment = generatedComment.slice(1, -1).trim();
        console.log('After removing outer quotes:', generatedComment);
      }
      
      // Replace em dashes with ellipsis to look more natural
      generatedComment = generatedComment.replace(/—/g, '...');
      
      // Truncate for X/Twitter 280-character limit
      if (platform === 'x' && generatedComment.length > 280) {
        generatedComment = generatedComment.slice(0, 277) + '...';
        console.log('Truncated for X 280-char limit:', generatedComment);
      }
      
      console.log('After em dash replacement:', generatedComment);
      console.log('Final comment being sent to popup:', generatedComment);
      
      sendResponse({ success: true, comment: generatedComment });
    } else {
      console.log('❌ No valid response from OpenAI');
      sendResponse({ success: false, error: 'No response generated from AI' });
    }

  } catch (error) {
    console.error('OpenAI Vision API Error:', error);
    sendResponse({ 
      success: false, 
      error: error.message.includes('fetch') ? 'Network error. Please check your internet connection.' : error.message 
    });
  }
}
