import { resolveBackground, resolveTextColor, slideIndicatorText, getSlot } from './layout-helpers';
import type { LayoutProps } from './layout.types';

export function leftAlignedLayout({ slide, contract, width, height, slideNumber }: LayoutProps): object {
  const bg = resolveBackground(slide.styleRules, contract);
  const textColor = resolveTextColor(bg, contract);
  const mutedColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  const headline = getSlot(slide, 'headline');
  const body = getSlot(slide, 'body');

  const topChildren: object[] = [];

  // Left stripe accent
  if (slide.styleRules.accentType === 'left-stripe') {
    topChildren.push({
      type: 'div',
      props: {
        style: { width: 6, backgroundColor: contract.accentColor, borderRadius: 3, marginRight: 24, alignSelf: 'stretch', flexShrink: 0 },
        children: null,
      },
    });
  }

  const textChildren: object[] = [];
  if (slide.styleRules.showSlideIndicator && slideNumber != null) {
    textChildren.push({
      type: 'div',
      props: { style: { fontSize: 13, color: contract.accentColor, fontWeight: 700, marginBottom: 12 }, children: slideIndicatorText(slideNumber, contract.totalSlides) },
    });
  }
  if (headline) {
    textChildren.push({
      type: 'div',
      props: {
        style: { fontSize: contract.headingSize, fontWeight: 700, color: textColor, lineHeight: contract.lineHeight, fontFamily: contract.headingFont },
        children: headline,
      },
    });
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

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        backgroundColor: bg,
        fontFamily: contract.bodyFont,
        padding: `${contract.paddingY}px ${contract.paddingX}px`,
      },
      children: [
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
