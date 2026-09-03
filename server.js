const express = require('express');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/send', async (req, res) => {
  const { serviceAccount, tokens, topic, title, body, imageUrl, customData } = req.body;

  if (!serviceAccount) {
    return res.status(400).json({ error: 'Service account JSON is required' });
  }
  const trimmedTopic = typeof topic === 'string' ? topic.trim() : '';
  const hasTokens = Array.isArray(tokens) && tokens.length > 0;
  if (!hasTokens && !trimmedTopic) {
    return res.status(400).json({ error: 'At least one FCM token or a topic is required' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'Notification title and body are required' });
  }
  if (customData !== undefined && customData !== null &&
      (typeof customData !== 'object' || Array.isArray(customData))) {
    return res.status(400).json({ error: 'customData must be a JSON object' });
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

  // Targets are either a single topic, or a list of device tokens
  const targets = trimmedTopic
    ? [{ type: 'topic', value: trimmedTopic }]
    : tokens.map(t => t.trim()).filter(t => t).map(t => ({ type: 'token', value: t }));

  for (const target of targets) {
    const targetLabel = target.type === 'topic'
      ? `topic: ${target.value}`
      : `token: ${target.value.substring(0, 15)}...`;

    // Build standard FCM v1 request body
    const messagePayload = {
      message: {
        [target.type]: target.value,
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

    if (customData && typeof customData === 'object') {
      for (const [key, value] of Object.entries(customData)) {
        // FCM data payload values must all be strings
        messagePayload.message.data[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

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

    logMsg('info', `Sending notification to ${targetLabel}`, {
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
        logMsg('success', `Successfully sent to ${targetLabel}`, {
          status: response.status,
          response: responseJson
        });
      } else {
        logMsg('error', `Failed to send to ${targetLabel}`, {
          status: response.status,
          response: responseJson
        });
      }
    } catch (err) {
      logMsg('error', `Network error sending to ${targetLabel}`, {
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
