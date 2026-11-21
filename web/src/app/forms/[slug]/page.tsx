import PublicFormClient from './client';

export function generateStaticParams() {
  return [{ slug: 'default' }];
}

export default function Page() {
  return <PublicFormClient />;
}
