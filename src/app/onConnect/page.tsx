import { Suspense } from 'react';
import OnConnectClient from './OnConnectClient';

export default function OnConnectPage() {
  return (
    <Suspense fallback={<div>Loading Phantom connection...</div>}>
      <OnConnectClient />
    </Suspense>
  );
}
