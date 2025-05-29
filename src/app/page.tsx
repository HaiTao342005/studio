import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
  // The redirect function should handle the navigation.
  // Adding a return null or an empty fragment for completeness,
  // though it might not be strictly necessary depending on Next.js version and build process.
  return null;
}
