import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyKeyToInputValue,
  ARABIC_KEYBOARD_ROWS,
  ENGLISH_KEYBOARD_ROWS,
  NUMERIC_SYMBOL_ROWS,
} from './androidKeyboard';

test('applyKeyToInputValue inserts Arabic and English characters at cursor position accurately', () => {
  const step1 = applyKeyToInputValue('', 0, 0, { type: 'insert', text: 'أ' });
  assert.equal(step1.value, 'أ');
  assert.equal(step1.cursor, 1);

  const step2 = applyKeyToInputValue('أمد', 1, 1, { type: 'insert', text: 'ح' });
  assert.equal(step2.value, 'أحمد');
  assert.equal(step2.cursor, 2);

  const step3 = applyKeyToInputValue('أحمد', 4, 4, { type: 'space' });
  assert.equal(step3.value, 'أحمد ');
  assert.equal(step3.cursor, 5);
});

test('applyKeyToInputValue replaces selected ranges and handles backspace & clear safely', () => {
  const replaced = applyKeyToInputValue('admin123', 5, 8, { type: 'insert', text: '99' });
  assert.equal(replaced.value, 'admin99');
  assert.equal(replaced.cursor, 7);

  const back1 = applyKeyToInputValue('خردوات', 6, 6, { type: 'backspace' });
  assert.equal(back1.value, 'خردوا');
  assert.equal(back1.cursor, 5);

  const backStart = applyKeyToInputValue('abc', 0, 0, { type: 'backspace' });
  assert.equal(backStart.value, 'abc');
  assert.equal(backStart.cursor, 0);

  const cleared = applyKeyToInputValue('secret', 2, 4, { type: 'clear' });
  assert.equal(cleared.value, '');
  assert.equal(cleared.cursor, 0);
});

test('Android soft keyboard layouts include complete Arabic, English, and numeric rows', () => {
  const flatArabic = ARABIC_KEYBOARD_ROWS.flat();
  assert.ok(flatArabic.includes('ض'));
  assert.ok(flatArabic.includes('م'));
  assert.ok(flatArabic.includes('0'));

  const flatEnglish = ENGLISH_KEYBOARD_ROWS.flat();
  assert.ok(flatEnglish.includes('a'));
  assert.ok(flatEnglish.includes('z'));

  const flatNumeric = NUMERIC_SYMBOL_ROWS.flat();
  assert.ok(flatNumeric.includes('@'));
  assert.ok(flatNumeric.includes('5'));
});
