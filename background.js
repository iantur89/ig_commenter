// Background script for handling OpenAI API calls with Vision
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

    // Platform-specific user message for the API call
    const userMessageText = platform === 'x'
      ? 'Please read the tweet/reply content from this screenshot and generate an appropriate reply following the instructions. Keep replies under 280 characters for X/Twitter.'
      : 'Please read the Instagram post caption from this screenshot and generate an appropriate comment following the instructions.';

    // Prepare the messages for the API call
    const messages = [
      {
        role: 'system',
        content: systemInstructions
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
