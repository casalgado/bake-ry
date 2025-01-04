const fs = require('fs');
const path = require('path');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'request_logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

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

  console.log('\n=== Response ===');

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

    // Try to parse and log response body if present
    if (chunks.length) {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        let logData;

        try {
          const parsed = JSON.parse(body);
          console.log('Response Body:', JSON.stringify(parsed, null, 2));
          logData = parsed;
        } catch (e) {
          // If response is not JSON, store as plain text
          console.log('Response Body:', e);
          logData = body.length > 1000 ? body.substring(0, 1000) + '...' : body;
          console.log('Response Body:', logData);
        }

        // Create log entry with request and response data
        const logEntry = {
          timestamp: new Date().toISOString(),
          request: {
            method: req.method,
            url: req.originalUrl,
            body: req.body,
            query: req.query,
            params: req.params,
          },
          response: {
            statusCode: res.statusCode,
            body: logData,
            responseTime: Date.now() - startTime,
          },
        };

        // Write log entry to file
        try {
          const filename = `request_${Date.now()}.json`;
          fs.writeFileSync(
            path.join(logsDir, filename),
            JSON.stringify(logEntry, null, 2),
          );
          console.log(`Request log saved to ${filename}`);
        } catch (error) {
          console.error('Error saving request log:', error);
        }

      } catch (e) {
        console.log('Error processing response body:', e.message);
      }
    }

    // Log response details
    const responseTime = Date.now() - startTime;
    console.log(`\nURL: ${req.originalUrl}`);
    console.log(`Method: ${req.method}`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log('=== End ===\n');

    return oldEnd.apply(res, arguments);
  };

  next();
};

module.exports = requestLogger;
