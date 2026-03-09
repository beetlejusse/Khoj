"use client";

import { HeroSection } from "./components/landing/HeroSection";
import { FeatureTabsSection } from "./components/landing/FeatureTabsSection";
import { SocialProofSection } from "./components/landing/SocialProofSection";
import { BentoGridSection } from "./components/landing/BentoGridSection";
import DocumentationSection from "@/components/documentation-section";
import TestimonialsSection from "@/components/testimonials-section";
import FAQSection from "@/components/faq-section";
import PricingSection from "@/components/pricing-section";
import CTASection from "@/components/cta-section";
import FooterSection from "@/components/footer-section";

export default function LandingPage() {
  return (
    <div className="w-full bg-[#F8FAFC] selection:bg-blue-100/30 overflow-x-hidden flex flex-col justify-start items-center relative">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[120px] pointer-events-none mix-blend-multiply animate-pulse duration-10000" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-300/20 blur-[120px] pointer-events-none mix-blend-multiply animate-pulse duration-10000" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-300/20 blur-[120px] pointer-events-none mix-blend-multiply animate-pulse duration-700" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none"></div>

      <div className="relative flex flex-col justify-start items-center w-full z-10">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-0 lg:max-w-[1060px] lg:w-[1060px] relative flex flex-col justify-start items-start">
          <div className="w-px h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-[rgba(15,23,42,0.06)] shadow-[1px_0px_0px_white] z-0"></div>
          <div className="w-px h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-[rgba(15,23,42,0.06)] shadow-[1px_0px_0px_white] z-0"></div>

          <div className="self-stretch overflow-hidden border-b border-[rgba(55,50,47,0.06)] flex flex-col justify-center items-center gap-4 sm:gap-6 md:gap-8 lg:gap-[66px] relative z-10 w-full">
            <HeroSection />
            <FeatureTabsSection />
            <SocialProofSection />
            <BentoGridSection />
            <DocumentationSection />
            <TestimonialsSection />
            <FAQSection />
            <PricingSection />
            <CTASection />
            <FooterSection />
          </div>
        </div>
      </div>
    </div>
  );
}
