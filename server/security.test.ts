import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  hashPassword,
  isSafeHttpOrLocalUrl,
  safeResolveInside,
  sanitizeFileName,
  signToken,
  verifyPassword,
  verifyToken,
} from './security';

test('hashPassword and verifyPassword use salted scrypt and constant-time comparison', () => {
  const hash1 = hashPassword('PharmD2026!');
  const hash2 = hashPassword('PharmD2026!');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('PharmD2026!', hash1), true);
  assert.equal(verifyPassword('WrongPass1', hash1), false);
});

test('signToken and verifyToken validate HMAC signature and expiry', () => {
  const secret = 'test-signing-secret-123';
  const token = signToken({ sub: 42, email: 'student@rxorbit.edu', role: 'student' }, secret, 60);
  const decoded = verifyToken(token, secret);
  assert.ok(decoded);
  assert.equal(decoded.sub, 42);
  assert.equal(decoded.role, 'student');
  assert.equal(verifyToken(token, 'wrong-secret'), null);

  const expired = signToken({ sub: 1, email: 'a@b.com', role: 'admin' }, secret, -10);
  assert.equal(verifyToken(expired, secret), null);
});

test('safeResolveInside blocks path traversal outside baseDir', () => {
  const base = path.resolve('/tmp/rxorbit-uploads');
  assert.ok(safeResolveInside(base, 'materials/notes.pdf'));
  assert.equal(safeResolveInside(base, '../etc/passwd'), null);
  assert.equal(safeResolveInside(base, '../../secret.txt'), null);
});

test('sanitizeFileName and isSafeHttpOrLocalUrl block unsafe inputs', () => {
  assert.equal(sanitizeFileName('../../evil<script>.pdf'), 'evil_script_.pdf');
  assert.equal(isSafeHttpOrLocalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpOrLocalUrl('https://linkedin.com/in/rxorbit'), true);
  assert.equal(isSafeHttpOrLocalUrl('/uploads/materials/doc.pdf'), true);
});
