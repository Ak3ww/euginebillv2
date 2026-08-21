import { redirect } from 'next/navigation';

export default function OntRemoteRedirectPage() {
  redirect('/admin/sessions/pppoe');
}

