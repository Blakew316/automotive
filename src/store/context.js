import { createContext } from 'react';

export const ShopContext = createContext(null);
export const UIContext = createContext(null);
export const SyncContext = createContext(null);
// The business phone line (texting & calls through the shop's Twilio number); see PhoneLine.jsx.
export const PhoneContext = createContext(null);
// Online payments through the shop's Stripe account; see PayLine.jsx.
export const PayContext = createContext(null);
