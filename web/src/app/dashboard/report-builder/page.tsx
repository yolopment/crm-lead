import { redirect } from 'next/navigation';

export default function ReportBuilderIndexPage() {
  redirect('/dashboard/report-builder/new');
}
