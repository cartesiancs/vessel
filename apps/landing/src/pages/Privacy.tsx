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
import { ImageSection } from "@/components/sections/Image";
import { ThreeCardsSection } from "@/components/sections/ThreeCards";
import { SecurityCTASection } from "@/components/sections/SecurityCta";

export function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        <section className='flex min-h-[400px] flex-col items-center justify-center px-4'>
          <div className='flex flex-col items-start gap-y-6'>
            <h1 className='self-center text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
              Privacy
            </h1>
          </div>
        </section>

        <SecurityCTASection />
      </main>
      <Footer />
    </>
  );
}
