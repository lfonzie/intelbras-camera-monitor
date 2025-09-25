'use client';

import { SessionProvider } from 'next-auth/react';
import CameraGrid from '@/components/CameraGrid';

export default function Home() {
  return (
    <SessionProvider>
      <CameraGrid />
    </SessionProvider>
  );
}