export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Get image data from request
    const contentType = request.headers.get('content-type');
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the image file from the request
    const formData = await request.formData();
    const imageFile = formData.get('image_file');
    
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size exceeds 10MB limit' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create form data for remove.bg API
    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', imageFile);
    removeBgFormData.append('size', 'auto');
    
    // Call remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': env.REMOVE_BG_API_KEY,
      },
      body: removeBgFormData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Remove.bg API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Background removal failed: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the result image
    const resultBlob = await response.blob();
    const arrayBuffer = await resultBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Return the result
    return new Response(JSON.stringify({
      success: true,
      result_url: `data:image/png;base64,${base64Image}`,
      message: 'Background removed successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err) {
    console.error('Background removal error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}