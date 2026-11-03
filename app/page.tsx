import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { Roadmap } from "@/components/landing/roadmap";
import { Workflow } from "@/components/landing/workflow";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1">
        <Hero />
        <Features />
        <Workflow />
        <Roadmap />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
