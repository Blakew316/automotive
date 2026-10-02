/**
 * On-screen keyboard presets for staff forms: the right keys (numbers, @, phone pad), caps where
 * they belong, and no autocorrect or contact AutoFill on things like VINs, plates and customer names.
 */
export const keyboard = {
  code: { autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false, autoComplete: 'off' },
  name: { autoCapitalize: 'words', autoCorrect: 'off', spellCheck: false, autoComplete: 'off' },
  words: { autoCapitalize: 'words' },
  email: { type: 'email', inputMode: 'email', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, autoComplete: 'off' },
  phone: { type: 'tel', inputMode: 'tel', autoComplete: 'off' },
  number: { inputMode: 'numeric', autoComplete: 'off' },
};
