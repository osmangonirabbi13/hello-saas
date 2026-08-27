'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MarketingMotion({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline().from('[data-hero]', { y: 24, opacity: 0, duration: 0.65, stagger: 0.1 });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 20,
            opacity: 0,
            duration: 0.55,
            scrollTrigger: { trigger: element, start: 'top 88%', once: true },
          });
        });
      });
      return () => media.revert();
    },
    { scope },
  );
  return <div ref={scope}>{children}</div>;
}
