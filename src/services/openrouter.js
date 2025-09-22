export async function generateImage(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "AI NFT Minter"
    },
    body: JSON.stringify({
      model: "google/gemini-pro-vision", // This model can handle image generation requests
      messages: [
        {
          role: "user", 
          content: `Create a detailed visual description for: ${prompt}. Please be very specific about colors, style, composition, and artistic elements.`
        }
      ],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter failed (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  console.log("Gemini Pro Vision response:", JSON.stringify(data, null, 2));
  
  // For now, we'll use a placeholder image service
  // Since OpenRouter doesn't have many free image generation models
  return await generatePlaceholderImage(prompt);
}

// Fallback: Generate using a free image API
export async function generatePlaceholderImage(prompt) {
  try {
    // Using a free placeholder service that generates images based on text
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://via.placeholder.com/1024x1024/4a90e2/ffffff?text=${encodedPrompt}`;
    
    return {
      image_base64: null,
      image_url: imageUrl,
      raw: { message: "Generated placeholder image" }
    };
  } catch (error) {
    throw new Error(`Placeholder generation failed: ${error.message}`);
  }
}

// Alternative: Try using Pollinations AI (free image generation API)
export async function generateImageWithPollinations(prompt) {
  try {
    // Pollinations AI - free image generation
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${Date.now()}&nologo=true`;
    
    // Download the image immediately to check if it works and convert to blob
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Pollinations API not accessible');
    }
    
    // Convert to blob and create object URL for display
    const blob = await response.blob();
    const displayUrl = URL.createObjectURL(blob);
    
    return {
      image_base64: null,
      image_url: imageUrl,
      display_url: displayUrl, // Add display URL for preview
      blob: blob, // Include blob for IPFS upload
      raw: { message: "Generated with Pollinations AI" }
    };
  } catch (error) {
    throw new Error(`Pollinations generation failed: ${error.message}`);
  }
}
// Alternative: Try with a working OpenRouter model
export async function generateImageWithWorkingModel(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "AI NFT Minter"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.2-90b-vision-instruct", // Free model that might work
      messages: [
        {
          role: "user", 
          content: `Generate an image description for: ${prompt}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Model failed (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  
  // Since this doesn't generate actual images, use Pollinations as fallback
  return await generateImageWithPollinations(prompt);
}

export async function uploadToIPFS(imageBuffer, filename = "generated.png") {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  formData.append("file", blob, filename);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.REACT_APP_PINATA_JWT}` },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IPFS upload failed: ${errorText}`);
  }
  const result = await response.json();
  return result.IpfsHash;
}

export async function uploadMetadata(metadata) {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Metadata upload failed: ${errorText}`);
  }
  const result = await response.json();
  return result.IpfsHash;
}

export function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
