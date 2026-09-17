document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('fcmForm');
  const serviceFileInput = document.getElementById('serviceFile');
  const dropZone = document.getElementById('dropZone');
  const fileInfo = document.getElementById('fileInfo');
  const fileNameSpan = fileInfo.querySelector('.file-name');
  const removeFileBtn = document.getElementById('removeFile');
  const consoleBody = document.getElementById('consoleBody');
  const clearConsoleBtn = document.getElementById('clearConsole');
  const copyConsoleBtn = document.getElementById('copyConsole');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = submitBtn.querySelector('.spinner');
  const submitText = submitBtn.querySelector('.btn-text');
  const tokensGroup = document.getElementById('tokensGroup');
  const topicGroup = document.getElementById('topicGroup');
  const tokensTextarea = document.getElementById('tokens');
  const topicInput = document.getElementById('topic');
  const targetModeRadios = document.querySelectorAll('input[name="targetMode"]');

  let serviceAccountJsonText = null;

  // Target Mode Toggle (Tokens vs Topic)
  const updateTargetMode = () => {
    const mode = document.querySelector('input[name="targetMode"]:checked').value;
    if (mode === 'topic') {
      tokensGroup.classList.add('hidden');
      topicGroup.classList.remove('hidden');
      tokensTextarea.required = false;
      topicInput.required = true;
    } else {
      tokensGroup.classList.remove('hidden');
      topicGroup.classList.add('hidden');
      tokensTextarea.required = true;
      topicInput.required = false;
    }
  };
  targetModeRadios.forEach(radio => radio.addEventListener('change', updateTargetMode));
  updateTargetMode();

  // File Handling
  const processFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      addLog('error', 'Invalid file type. Please select a Google service account JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
          addLog('error', 'Missing critical fields (project_id, private_key, client_email) in JSON.');
          return;
        }
        serviceAccountJsonText = e.target.result;
        fileNameSpan.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        addLog('success', `Loaded service account for project: ${parsed.project_id}`);
      } catch (err) {
        addLog('error', 'Error parsing JSON file. Check file encoding.');
      }
    };
    reader.readAsText(file);
  };

  serviceFileInput.addEventListener('change', (e) => {
    processFile(e.target.files[0]);
  });

  removeFileBtn.addEventListener('click', () => {
    serviceFileInput.value = '';
    serviceAccountJsonText = null;
    fileInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
    addLog('info', 'Service account key removed.');
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    processFile(file);
  });

  // Console log functions
  const addLog = (type, message, detailObj = null) => {
    const line = document.createElement('div');
    line.className = `console-line ${type}-line`;
    
    const timestamp = new Date().toLocaleTimeString();
    let text = `[${timestamp}] `;
    
    if (type === 'success') text += '✔ ';
    if (type === 'error') text += '✖ ';
    if (type === 'info') text += 'ℹ ';
    
    text += message;
    line.textContent = text;
    
    consoleBody.appendChild(line);
    
    if (detailObj) {
      const pre = document.createElement('pre');
      pre.className = 'json-block';
      pre.textContent = JSON.stringify(detailObj, null, 2);
      consoleBody.appendChild(pre);
    }
    
    consoleBody.scrollTop = consoleBody.scrollHeight;
  };

  clearConsoleBtn.addEventListener('click', () => {
    consoleBody.innerHTML = '';
    addLog('system', 'Console cleared.');
  });

  copyConsoleBtn.addEventListener('click', () => {
    const lines = Array.from(consoleBody.childNodes).map(node => {
      if (node.className && node.className.includes('json-block')) {
        return node.textContent;
      }
      return node.textContent;
    }).join('\n');
    
    navigator.clipboard.writeText(lines).then(() => {
      const originalText = copyConsoleBtn.textContent;
      copyConsoleBtn.textContent = '📋 Copied!';
      setTimeout(() => {
        copyConsoleBtn.textContent = originalText;
      }, 1500);
    }).catch(err => {
      alert('Failed to copy console logs');
    });
  });

  // Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!serviceAccountJsonText) {
      addLog('error', 'Please upload a Google service account JSON file first.');
      return;
    }

    const targetMode = document.querySelector('input[name="targetMode"]:checked').value;
    let tokens = [];
    let topic = null;

    if (targetMode === 'topic') {
      topic = topicInput.value.trim();
      if (!topic) {
        addLog('error', 'Please enter a topic name.');
        return;
      }
    } else {
      const tokensText = tokensTextarea.value;
      tokens = tokensText.split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (tokens.length === 0) {
        addLog('error', 'Please enter at least one registration token.');
        return;
      }
    }

    const title = document.getElementById('title').value.trim();
    const body = document.getElementById('body').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();

    const customDataText = document.getElementById('customData').value.trim();
    let customData = null;
    if (customDataText) {
      try {
        customData = JSON.parse(customDataText);
        if (typeof customData !== 'object' || customData === null || Array.isArray(customData)) {
          addLog('error', 'Custom data payload must be a JSON object.');
          return;
        }
      } catch (err) {
        addLog('error', `Invalid custom data payload JSON: ${err.message}`);
        return;
      }
    }

    const customApnsText = document.getElementById('customApns').value.trim();
    let customApns = null;
    if (customApnsText) {
      try {
        customApns = JSON.parse(customApnsText);
        if (typeof customApns !== 'object' || customApns === null || Array.isArray(customApns)) {
          addLog('error', 'Custom APNS payload must be a JSON object.');
          return;
        }
      } catch (err) {
        addLog('error', `Invalid custom APNS payload JSON: ${err.message}`);
        return;
      }
    }

    // UI Loading State
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');
    submitText.textContent = 'Sending...';

    if (targetMode === 'topic') {
      addLog('info', `Starting notification request for topic "${topic}"...`);
    } else {
      addLog('info', `Starting notification request batch for ${tokens.length} token(s)...`);
    }

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceAccount: serviceAccountJsonText,
          tokens,
          topic,
          title,
          body,
          imageUrl,
          customData,
          customApns
        })
      });

      const result = await response.json();
      
      if (result.logs && Array.isArray(result.logs)) {
        result.logs.forEach(logEntry => {
          addLog(logEntry.type, logEntry.message, logEntry.data);
        });
      }

      if (!response.ok) {
        addLog('error', `Batch failed with HTTP status ${response.status}`);
      } else {
        addLog('success', 'Batch notification request finished.');
      }
    } catch (err) {
      addLog('error', `Failed to contact server: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
      submitText.textContent = 'Send Notification';
    }
  });
});
