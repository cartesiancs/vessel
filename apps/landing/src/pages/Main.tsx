import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FeaturesSection } from "@/components/sections/Features";
import { UsecaseSection } from "@/components/sections/Usecase";
import { Button } from "@/components/ui/button";
import { BookText } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { SubheadingSection } from "@/components/sections/SubheadingSection";
import { MidCTASection } from "@/components/sections/MidCta";
import { FAQSection } from "@/components/sections/Faqs";
import { FooterCtaSection } from "@/components/sections/FooterCta";
import { ThreeCardsSection } from "@/components/sections/ThreeCards";
import { SecurityCTASection } from "@/components/sections/SecurityCta";
import { IntegrationSection } from "@/components/sections/IntegrationImage";
import { ListCardsSection } from "@/components/sections/ListCards";
import { CapsulePromoSection } from "@/components/sections/CapsulePromo";
import { ScrollTextRevealSection } from "@/components/sections/ScrollTextReveal";
import { ScrollBoxSection } from "@/components/sections/ScrollBox";

function LandingPage() {
  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        <section className='flex h-dvh flex-col items-center justify-center px-8 md:px-10'>
          <div className='flex flex-col items-start gap-y-6'>
            <h1 className='self-center text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
              The open source <br /> alternative to Anduril
            </h1>
            <div className='flex items-center gap-x-4 pt-2 self-center'>
              <Button
                variant='default'
                onClick={() => window.open("/docs/introduction")}
              >
                <BookText /> Docs
              </Button>
              <Button
                onClick={() =>
                  window.open("https://github.com/cartesiancs/vessel")
                }
                variant='outline'
              >
                <FaGithub />
                GitHub
              </Button>
            </div>
          </div>
        </section>

        <SubheadingSection />
        <FeaturesSection />
        <ScrollTextRevealSection />
        <UsecaseSection />
        <ListCardsSection />
        <MidCTASection />
        <IntegrationSection />
        <ThreeCardsSection />
        <ScrollBoxSection />
        <SecurityCTASection />
        <CapsulePromoSection />
        <FAQSection />
        <FooterCtaSection />
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;
