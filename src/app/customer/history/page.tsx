import { redirect } from 'next/navigation';
export default function HistoryRedirect() {
  redirect('/customer/invoices');
}
