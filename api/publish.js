/**
 * Vercel API function for external project publishing
 */
module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const publishRequest = req.body;

    // Debug log
    console.log('Request body:', publishRequest);
    console.log('Request method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    
    if (!publishRequest) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ 
        error: "Request body is required",
        debug: {
          bodyType: typeof publishRequest,
          body: publishRequest,
          headers: req.headers
        }
      }));
    }

    // For now, just return a success message to test if body parsing works
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      message: "Request received successfully",
      received: publishRequest
    }));

  } catch (error) {
    console.error("Publish API error:", error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: "Internal server error",
      message: error.message || String(error),
    }));
  }
}; 