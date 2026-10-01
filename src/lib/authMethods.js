import { PenLine, Phone, MessageSquare, Mail, Globe } from 'lucide-react';

export const AUTH_METHODS = {
  'in-person': { label: 'In person', icon: PenLine },
  phone: { label: 'Phone', icon: Phone },
  text: { label: 'Text', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  online: { label: 'Online', icon: Globe },
};
