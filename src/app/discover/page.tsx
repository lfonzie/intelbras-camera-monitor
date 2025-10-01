import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import CameraDiscovery from '@/components/CameraDiscovery';

export default async function DiscoverPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <CameraDiscovery />
      </div>
    </div>
  );
}
