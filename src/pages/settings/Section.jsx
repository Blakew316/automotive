import { Card, CardHeader } from '../../components/ui';

export default function Section({ id, title, subtitle, actions, icon, children, flush }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      {flush ? children : <div className="p-4">{children}</div>}
    </Card>
  );
}
