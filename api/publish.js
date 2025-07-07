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
    let publishRequest;

    // Read request body manually
    if (!req.body) {
      // For Vercel functions, we need to read the raw stream
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString();
      console.log('Raw body:', rawBody);
      
      if (rawBody) {
        try {
          publishRequest = JSON.parse(rawBody);
        } catch (parseError) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      }
    } else {
      publishRequest = req.body;
    }

    console.log('Parsed request:', publishRequest);
    
    if (!publishRequest) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: "Request body is required" }));
    }

    // Test response with the received data
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