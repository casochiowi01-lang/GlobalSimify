import { redirect } from 'next/navigation';

// The dashboard now lives at /admin (Overview). Keep this path working.
export default function AdminDashboardRedirect() {
  redirect('/admin');
}
