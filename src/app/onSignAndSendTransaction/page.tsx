import { Suspense } from 'react';
import ClientProcessPayment from './ClientProcessPayment';

export default function Page() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <ClientProcessPayment />
    </Suspense>
  );
}
