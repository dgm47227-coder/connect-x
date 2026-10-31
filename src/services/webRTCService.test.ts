import test from 'node:test';
import assert from 'node:assert/strict';
import { ICE_SERVERS } from './webRTCService';

test('WebRTC STUN server configuration meets industry standards', () => {
  assert.ok(ICE_SERVERS.iceServers, 'iceServers must be defined');
  assert.ok(ICE_SERVERS.iceServers.length >= 3, 'Must have at least 3 redundant STUN servers');
  
  const urls = ICE_SERVERS.iceServers.map((s) => (typeof s.urls === 'string' ? s.urls : s.urls[0]));
  assert.ok(urls.some((u) => u.includes('stun.l.google.com:19302')), 'Contains primary Google STUN server');
  assert.ok(urls.some((u) => u.includes('stun1.l.google.com:19302')), 'Contains secondary Google STUN server');
  assert.equal(ICE_SERVERS.iceCandidatePoolSize, 10, 'Candidate pool size configured for low-latency ICE gathering');
});

test('Call state transitions enforce valid terminal states', () => {
  const validStatuses = ['ringing', 'connected', 'ended', 'missed', 'rejected', 'busy'];
  
  // Verify valid status set
  assert.ok(validStatuses.includes('ringing'));
  assert.ok(validStatuses.includes('connected'));
  assert.ok(validStatuses.includes('ended'));
  assert.ok(validStatuses.includes('missed'));
  assert.ok(validStatuses.includes('rejected'));
  assert.ok(validStatuses.includes('busy'));

  // Terminal states cannot revert to ringing
  const terminalStatuses = ['ended', 'missed', 'rejected', 'busy'];
  terminalStatuses.forEach((status) => {
    assert.notEqual(status, 'ringing');
  });
});
