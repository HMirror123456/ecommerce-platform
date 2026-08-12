import client from './client';

export function fetchChatThreads(params) {
  return client.get('/chat/threads', { params }).then((r) => r.data);
}

export function fetchChatMessages(threadId, params) {
  return client.get(`/chat/threads/${threadId}/messages`, { params }).then((r) => r.data);
}

export function sendChatMessage(threadId, payload) {
  return client.post(`/chat/threads/${threadId}/messages`, payload).then((r) => r.data);
}

export function runChatAction(threadId, actionKey, body) {
  return client.post(`/chat/threads/${threadId}/actions/${actionKey}`, body || {}).then((r) => r.data);
}
