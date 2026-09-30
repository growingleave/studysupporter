import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
