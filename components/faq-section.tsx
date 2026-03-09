"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is Khoj and who is it for?",
    answer:
      "Khoj is a comprehensive travel planning platform designed for explorers who want to manage their trips effortlessly. It's perfect for solo travelers, backpackers, groups of friends, and anyone looking to streamline their travel itineraries.",
  },
  {
    question: "How does the itinerary planning work?",
    answer:
      "Our platform allows you to visually map out your journey. You can add destinations, set schedules, and easily track distances to generate optimal daily travel paths. Everything syncs in real-time.",
  },
  {
    question: "Can I integrate Instagram Reels?",
    answer:
      "Yes! Khoj lets you save Instagram reels directly into the platform to automatically curate maps and routes based on the places you've discovered online.",
  },
  {
    question: "Can I collaborate with my friends?",
    answer:
      "Absolutely. Khoj is built for group travel. Any updates to the itinerary, budget, or newly added locations flow instantly across your entire travel group seamlessly.",
  },
  {
    question: "How do I track my travel budget?",
    answer:
      "Khoj features a Smart Budgeting dashboard where you can log expenses, categorize spending, and generate actionable insights instantly to make sure everyone stays on track.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "Khoj is fully responsive and designed to work perfectly on your mobile browser, ensuring you have access to your travel plans, maps, and tickets no matter where you are in the world.",
  },
];

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FAQSection() {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <div className="w-full flex justify-center items-start">
      <div className="flex-1 px-4 md:px-12 py-16 md:py-20 flex flex-col lg:flex-row justify-start items-start gap-6 lg:gap-12">
        {/* Left Column - Header */}
        <div className="w-full lg:flex-1 flex flex-col justify-center items-start gap-4 lg:py-5">
          <div className="w-full flex flex-col justify-center text-[#49423D] font-semibold leading-tight md:leading-[44px] font-sans text-4xl tracking-tight">
            Frequently Asked Questions
          </div>
          <div className="w-full text-[#605A57] text-base font-normal leading-7 font-sans">
            Everything you need to know about
            <br className="hidden md:block" />
            planning your next big adventure.
          </div>
        </div>

        {/* Right Column - FAQ Items */}
        <div className="w-full lg:flex-1 flex flex-col justify-center items-center">
          <div className="w-full flex flex-col">
            {faqData.map((item, index) => {
              const isOpen = openItems.includes(index);

              return (
                <div
                  key={index}
                  className="w-full border-b border-[rgba(73,66,61,0.16)] overflow-hidden"
                >
                  <button
                    onClick={() => toggleItem(index)}
                    className="w-full px-5 py-[18px] flex justify-between items-center gap-5 text-left hover:bg-[rgba(73,66,61,0.02)] transition-colors duration-200"
                    aria-expanded={isOpen}
                  >
                    <div className="flex-1 text-[#49423D] text-base font-medium leading-6 font-sans">
                      {item.question}
                    </div>
                    <div className="flex justify-center items-center">
                      <ChevronDownIcon
                        className={`w-6 h-6 text-[rgba(73,66,61,0.60)] transition-transform duration-300 ease-in-out ${
                          isOpen ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-5 pb-[18px] text-[#605A57] text-sm font-normal leading-6 font-sans">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
