import { useLayoutEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FeaturesSection } from "@/components/sections/Features";
import { UsecaseSection } from "@/components/sections/Usecase";
import { Button } from "@/components/ui/button";
import { BookText } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { MidCTASection } from "@/components/sections/MidCta";
import { FAQSection } from "@/components/sections/Faqs";
import { FooterCtaSection } from "@/components/sections/FooterCta";
import { ThreeCardsSection } from "@/components/sections/ThreeCards";
import { SecurityCTASection } from "@/components/sections/SecurityCta";
import { IntegrationSection } from "@/components/sections/IntegrationImage";
import { ListCardsSection } from "@/components/sections/ListCards";
import { CapsulePromoSection } from "@/components/sections/CapsulePromo";
import { ScrollTextRevealSection } from "@/components/sections/ScrollTextReveal";
import { HeroSceneSection } from "@/components/sections/HeroScene/HeroScene";
import { UsecaseAIAssistantSection } from "@/components/sections/UsecaseAI";
import { cn } from "@/lib/utils";

const HERO_BG_SRC = "/videos/back.webp";

/** Matches previous Tailwind inset-10 / md:16 / lg:24 / xl:28 (px). */
function maxHeroInsetForWidth(width: number): number {
  if (width >= 1280) return 112;
  if (width >= 1024) return 96;
  if (width >= 768) return 64;
  return 40;
}

/** Scroll this fraction of viewport height to go from max inset to 0. */
const HERO_INSET_SCROLL_RANGE = 0.72;

/** Below Tailwind `md` — no hero background media (save bandwidth & battery). */
const MOBILE_BG_OFF_MEDIA = "(max-width: 767px)";

function LandingPage() {
  const [heroBgReady, setHeroBgReady] = useState(false);
  const [heroBgFailed, setHeroBgFailed] = useState(false);
  const [heroInsetPx, setHeroInsetPx] = useState(40);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_BG_OFF_MEDIA).matches
      : false,
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_BG_OFF_MEDIA);
    let rafId = 0;

    const updateHeroInset = () => {
      const maxInset = maxHeroInsetForWidth(window.innerWidth);
      const range = Math.max(1, window.innerHeight * HERO_INSET_SCROLL_RANGE);
      const t = Math.min(1, Math.max(0, window.scrollY / range));
      setHeroInsetPx(maxInset * (1 - t));
    };

    const onScrollOrResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeroInset);
    };

    const detachScroll = () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };

    const syncMobileAndScroll = () => {
      const mobile = mq.matches;
      setIsMobileViewport(mobile);
      detachScroll();
      if (!mobile) {
        updateHeroInset();
        window.addEventListener("scroll", onScrollOrResize, { passive: true });
        window.addEventListener("resize", onScrollOrResize);
      }
    };

    mq.addEventListener("change", syncMobileAndScroll);
    syncMobileAndScroll();

    return () => {
      mq.removeEventListener("change", syncMobileAndScroll);
      detachScroll();
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className='w-screen bg-background text-foreground'>
        <section className='relative flex h-svh flex-col items-center justify-center overflow-hidden bg-black px-5 md:px-10'>
          {!heroBgFailed && !isMobileViewport && (
            <div
              className={cn(
                "pointer-events-none absolute transition-opacity duration-[1400ms] ease-out",
                heroBgReady ? "opacity-100" : "opacity-0",
              )}
              style={{
                top: heroInsetPx,
                right: heroInsetPx,
                bottom: heroInsetPx,
                left: heroInsetPx,
              }}
            >
              <div className='relative h-full w-full overflow-hidden'>
                {/* <img
                  src={HERO_BG_SRC}
                  alt=''
                  aria-hidden
                  loading='eager'
                  fetchPriority='high'
                  decoding='async'
                  onLoad={() => {
                    requestAnimationFrame(() => setHeroBgReady(true));
                  }}
                  onError={() => setHeroBgFailed(true)}
                  className='h-full w-full object-cover brightness-[0.92]'
                /> */}
                <div className='absolute inset-0 bg-black/35' aria-hidden />
              </div>
            </div>
          )}
          <div className='relative z-10 flex flex-col items-start gap-y-6'>
            <h1 className='self-center text-4xl md:text-6xl lg:text-6xl md:leading-17 leading-10 md:font-bold font-semibold tracking-tight text-center'>
              Personal C2 platform <br /> for Physical AI
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

        {/* <SubheadingSection /> */}
        <FeaturesSection />
        <ScrollTextRevealSection />
        <UsecaseSection />
        <ListCardsSection />
        <MidCTASection />
        <IntegrationSection />
        <ThreeCardsSection />
        <UsecaseAIAssistantSection />
        <SecurityCTASection />
        <CapsulePromoSection />
        <FAQSection />
        <FooterCtaSection />
      </main>
      <Footer />
      <HeroSceneSection />
    </>
  );
}

export default LandingPage;
