const fetch = require("node-fetch");
const admin = require("firebase-admin");

async function createCustomToken(uid) {
  try {
    // First, create a custom token
    const customToken = await admin.auth().createCustomToken(uid);

    // Then, exchange it for an ID token (this step simulates client-side auth)
    const idToken = await getIdTokenFromCustomToken(customToken);

    return idToken;
  } catch (error) {
    console.error("Error generating token:", error);
  }
}

// This function simulates exchanging a custom token for an ID token
// In a real app, this would happen on the client side
async function getIdTokenFromCustomToken(customToken) {
  const firebaseApiKey = process.env.BAKERY_API_KEY;

  if (!firebaseApiKey) {
    throw new Error("Firebase API key is not set in environment variables");
  }

  const response = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${firebaseApiKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  const data = await response.json();
  return data.idToken;
}

module.exports = { createCustomToken };
