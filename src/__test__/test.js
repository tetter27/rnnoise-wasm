/**
 * @jest-environment jsdom
 */

import { add } from '../processor';

test('add 1 + 2', () => {
    expect(add(1, 2)).toBe(3);
  });