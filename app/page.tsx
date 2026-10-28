import BabyScheduleApp from "@/app/ui/BabyScheduleApp";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f5f0e9] text-sm font-semibold text-[#8a8179]">
          正在整理今天的作息…
        </main>
      }
    >
      <BabyScheduleApp />
    </Suspense>
  );
}
