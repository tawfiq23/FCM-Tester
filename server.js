const express = require('express');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/send', async (req, res) => {
  const { serviceAccount, tokens, title, body, imageUrl } = req.body;

  if (!serviceAccount) {
    return res.status(400).json({ error: 'Service account JSON is required' });
  }
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'At least one FCM token is required' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'Notification title and body are required' });
  }

  let credentials;
  try {
    credentials = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid service account JSON format' });
  }

  const projectId = credentials.project_id;
  if (!projectId) {
    return res.status(400).json({ error: 'project_id missing from service account JSON' });
  }

  const logs = [];
  const logMsg = (type, message, data = null) => {
    logs.push({
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    });
  };

  logMsg('info', `Initializing Google Auth for project: ${projectId}`);

  let accessToken;
  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    accessToken = tokenResponse.token;
    logMsg('success', 'OAuth2 access token successfully generated');
  } catch (error) {
    logMsg('error', 'Failed to generate OAuth2 access token', { error: error.message });
    return res.status(500).json({ error: 'Authentication failed', logs });
  }

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  
  for (const token of tokens) {
    const trimmedToken = token.trim();
    if (!trimmedToken) continue;

    // Build standard FCM v1 request body
    const messagePayload = {
      message: {
        token: trimmedToken,
        notification: {
          title,
          body
        },
        data: {
          title,
          body,
          itemType: "0",
          itemId: "0"
        }
      }
    };

    if (imageUrl && imageUrl.trim()) {
      const url = imageUrl.trim();
      messagePayload.message.data.bigPicture = url;
      messagePayload.message.android = {
        notification: {
          image: url
        }
      };
      messagePayload.message.apns = {
        payload: {
          aps: {
            "mutable-content": 1
          }
        },
        fcm_options: {
          image: url
        }
      };
    }

    logMsg('info', `Sending notification to token: ${trimmedToken.substring(0, 15)}...`, {
      endpoint: fcmUrl,
      requestBody: messagePayload
    });

    try {
      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(messagePayload)
      });

      const responseText = await response.text();
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        responseJson = responseText;
      }

      if (response.ok) {
        logMsg('success', `Successfully sent to token: ${trimmedToken.substring(0, 15)}...`, {
          status: response.status,
          response: responseJson
        });
      } else {
        logMsg('error', `Failed to send to token: ${trimmedToken.substring(0, 15)}...`, {
          status: response.status,
          response: responseJson
        });
      }
    } catch (err) {
      logMsg('error', `Network error sending to token: ${trimmedToken.substring(0, 15)}...`, {
        error: err.message
      });
    }
  }

  res.json({ logs });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FCM Tester Server running at http://localhost:${PORT}`);
});
