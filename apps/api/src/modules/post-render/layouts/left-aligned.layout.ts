import { resolveVisualBackground, resolveVisualBackgroundStyle, resolveAccent, resolveTextColor, slideIndicatorText, getSlot, renderDecorations, renderHeadline, ctaStyle as buildCtaStyle } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function leftAlignedLayout({ slide, contract, width, height, slideNumber, backgroundImageBase64, visualSpec }: LayoutProps): object {
  const bg = resolveVisualBackground(slide.styleRules, contract, visualSpec);
  const textColor = resolveTextColor(bg, contract);
  const accent = resolveAccent(contract, visualSpec);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');
  const cta = getSlot(slide, 'cta');

  const topChildren: object[] = [];

  // Left stripe accent
  if (slide.styleRules.accentType === 'left-stripe') {
    topChildren.push({
      type: 'div',
      props: {
        style: { width: 6, backgroundColor: accent, borderRadius: 3, marginRight: 24, alignSelf: 'stretch', flexShrink: 0 },
      },
    });
  }

  const textChildren: object[] = [];
  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    textChildren.push({
      type: 'div',
      props: { style: { fontSize: 13, color: accent, fontWeight: 700, marginBottom: 12 }, children: slideIndicatorText(slideNumber, contract.totalSlides) },
    });
  }
  if (headline) {
    textChildren.push(renderHeadline(headline, contract, textColor, contract.headingSize, visualSpec));
  }
  if (body) {
    textChildren.push({
      type: 'div',
      props: {
        style: { fontSize: contract.bodySize, color: mutedColor, marginTop: 20, lineHeight: contract.lineHeight, fontFamily: contract.bodyFont },
        children: body,
      },
    });
  }

  if (cta) {
    textChildren.push({
      type: 'div',
      props: { style: buildCtaStyle(cta, contract, visualSpec) },
    });
  }

  topChildren.push({
    type: 'div',
    props: { style: { display: 'flex', flexDirection: 'column' }, children: textChildren },
  });

  const bottomChildren: object[] = [];
  if (slide.styleRules.showLogo && contract.logo?.base64) {
    bottomChildren.push({
      type: 'img',
      props: { src: contract.logo.base64, style: { height: contract.logo.heightPx, objectFit: 'contain' } },
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
        padding: `${contract.paddingY}px ${contract.paddingX}px`,
        overflow: 'hidden',
      },
      children: [...decorationDivs,
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'row', flex: 1, alignItems: 'flex-start' },
            children: topChildren,
          },
        },
        ...(bottomChildren.length > 0 ? [{
          type: 'div',
          props: { style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-start' }, children: bottomChildren },
        }] : []),
      ],
    },
  };
}
