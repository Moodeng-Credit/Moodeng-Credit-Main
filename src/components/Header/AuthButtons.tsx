import Link from 'next/link';

export default function AuthButtons() {
   return (
      <div className="flex items-center gap-4">
         <Link href="/login#login" className="text-white text-xl sm:text-2xl bg-black px-4 py-2 rounded-full">
            Log in
         </Link>
         <Link href="/login" className="text-white text-xl sm:text-2xl bg-[#6d57ff] px-4 py-2 rounded-full">
            Sign up
         </Link>
      </div>
   );
}
