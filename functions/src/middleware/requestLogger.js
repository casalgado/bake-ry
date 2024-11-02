const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request details
  console.log('\n=== Incoming Request ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.originalUrl}`);

  // Log request body if present
  if (Object.keys(req.body || {}).length) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }

  // Log query parameters if present
  if (Object.keys(req.query || {}).length) {
    console.log('Query:', JSON.stringify(req.query, null, 2));
  }

  // Log route parameters if present
  if (Object.keys(req.params || {}).length) {
    console.log('Params:', JSON.stringify(req.params, null, 2));
  }

  // Capture response data
  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks = [];

  res.write = function (chunk) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    // Log response details
    const responseTime = Date.now() - startTime;
    console.log('\n=== Response ===');
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response Time: ${responseTime}ms`);

    // Try to parse and log response body if present
    if (chunks.length) {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = JSON.parse(body);
          console.log('Response Body:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          // If response is not JSON, log first 1000 characters
          void e;
          console.log('Response Body:', body.length > 1000 ? body.substring(0, 1000) + '...' : body);
        }
      } catch (e) {
        console.log('Error processing response body:', e.message);
      }
    }

    console.log('=== End ===\n');

    return oldEnd.apply(res, arguments);
  };

  next();
};

module.exports = requestLogger;
