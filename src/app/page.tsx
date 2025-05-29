import { redirect } from 'next/navigation';

interface HomePageProps {
  params: {}; // Static route, params is empty
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function HomePage({ params, searchParams }: HomePageProps) {
  redirect('/dashboard');
  // The redirect function should handle the navigation.
  // Adding a return null or an empty fragment for completeness,
  // though it might not be strictly necessary depending on Next.js version and build process.
  return null;
}
