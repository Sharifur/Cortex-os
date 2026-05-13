import { resolveVisualBackground, resolveVisualBackgroundStyle, resolveAccent, resolveTextColor, slideIndicatorText, getSlot, renderDecorations, ctaStyle as buildCtaStyle } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function centeredLayout({ slide, contract, width, height, slideNumber, backgroundImageBase64, visualSpec }: LayoutProps): object {
  const bg = resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const textColor = resolveTextColor(bg, contract);
  const accent = resolveAccent(contract, visualSpec);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const cta = getSlot(slide, 'cta');
  const quote = getSlot(slide, 'quote');
  const attribution = getSlot(slide, 'attribution');
  const displayText = quote || headline;

  const children: object[] = [];

  // Accent top bar
  if (slide.styleRules.accentType === 'top-bar') {
    children.push({
      type: 'div',
      props: {
        style: { height: contract.accentBar.thickness, width: '100%', backgroundColor: contract.accentColor, marginBottom: 40, flexShrink: 0 },
      },
    });
  }

  // Main content area
  const contentChildren: object[] = [];
  if (quote) {
    contentChildren.push({
      type: 'div',
      props: { style: { fontSize: 14, color: accent, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }, children: 'QUOTE' },
    });
  }

  if (displayText) {
    contentChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: quote ? Math.min(contract.headingSize, 48) : contract.headingSize,
          fontWeight: 700,
          color: textColor,
          lineHeight: contract.lineHeight,
          fontFamily: contract.headingFont,
        },
        children: displayText,
      },
    });
  }

  if (attribution) {
    contentChildren.push({
      type: 'div',
      props: { style: { fontSize: 14, color: mutedColor, marginTop: 16, fontStyle: 'italic' }, children: `— ${attribution}` },
    });
  }

  if (body && !quote) {
    contentChildren.push({
      type: 'div',
      props: {
        style: { fontSize: contract.bodySize, color: mutedColor, marginTop: 24, lineHeight: contract.lineHeight, fontFamily: contract.bodyFont },
        children: body,
      },
    });
  }

  if (cta) {
    contentChildren.push({
      type: 'div',
      props: { style: buildCtaStyle(cta, contract, visualSpec) },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', paddingLeft: contract.paddingX, paddingRight: contract.paddingX },
      children: contentChildren,
    },
  });

  // Bottom bar: logo + indicator
  const bottomChildren: object[] = [];
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    bottomChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain' } },
    });
  }
  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    bottomChildren.push({
      type: 'div',
      props: { style: { fontSize: 13, color: mutedColor, marginLeft: 'auto' }, children: slideIndicatorText(slideNumber, contract.totalSlides) },
    });
  }
  if (bottomChildren.length > 0) {
    children.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: contract.paddingX, paddingRight: contract.paddingX, paddingBottom: contract.paddingY, flexShrink: 0 },
        children: bottomChildren,
      },
    });
  }

  const decorationDivs = !backgroundImageBase64 ? renderDecorations(contract, width, height, visualSpec) : [];

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        ...(backgroundImageBase64
          ? { backgroundImage: `url(${backgroundImageBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : resolveVisualBackgroundStyle(slide.styleRules, contract, visualSpec)),
        fontFamily: contract.bodyFont,
        paddingTop: contract.paddingY,
        overflow: 'hidden',
      },
      children: [...decorationDivs, ...children],
    },
  };
}
