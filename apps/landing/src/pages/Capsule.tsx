import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CapsuleHero } from "@/components/sections/capsule/CapsuleHero";
import { CapsuleSubheading } from "@/components/sections/capsule/CapsuleSubheading";
import { CapsuleFeatures } from "@/components/sections/capsule/CapsuleFeatures";
import { CapsuleHowItWorks } from "@/components/sections/capsule/CapsuleHowItWorks";
import { CapsuleArchitecture } from "@/components/sections/capsule/CapsuleArchitecture";
import { CapsuleFaq } from "@/components/sections/capsule/CapsuleFaq";
import { CapsuleFooterCta } from "@/components/sections/capsule/CapsuleFooterCta";

function CapsulePage() {
  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        <CapsuleHero />
        <CapsuleSubheading />
        <CapsuleFeatures />
        <CapsuleHowItWorks />
        <CapsuleArchitecture />
        <CapsuleFaq />
        <CapsuleFooterCta />
      </main>
      <Footer />
    </>
  );
}

export default CapsulePage;
