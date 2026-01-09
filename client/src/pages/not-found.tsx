import { Link } from "wouter";
import { Scanlines } from "@/components/Scanlines";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground font-mono relative overflow-hidden">
      <Scanlines />
      <h1 className="text-9xl font-black text-destructive opacity-20">404</h1>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <h2 className="text-2xl font-bold mb-4">SECTOR NOT FOUND</h2>
        <p className="text-muted-foreground mb-8">The coordinates you specified do not exist in this system.</p>
        <Link href="/" className="px-6 py-3 border border-primary text-primary hover:bg-primary hover:text-black transition-colors uppercase tracking-widest">
          Return to Base
        </Link>
      </div>
    </div>
  );
}
