import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={Compass}
      title="Page not found"
      body="That page doesn’t exist. Try search (⌘K) to find a customer, vehicle or repair order."
      action={<Link to="/" className="btn-secondary">Back to Today</Link>}
    />
  );
}
