import type { ThemeContract, FilledSlide } from '../types';

export interface LayoutProps {
  slide: FilledSlide;
  contract: ThemeContract;
  width: number;
  height: number;
  slideNumber?: number;
  backgroundImageBase64?: string;
}
